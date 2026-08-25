"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock, MapPin, MessageCircle, Send, Truck, Zap } from "lucide-react";

import useMe from "../../../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../../../lib/api";
import { DELIVERY_LABEL, ORDER_STATUS_UI, formatClp, formatDate, type MarketOrder } from "../../../../../lib/marketplace";

type OrderMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

export default function SellerOrderClient({ orderId }: { orderId: string }) {
  const { me } = useMe();
  const [order, setOrder] = useState<MarketOrder | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, chat] = await Promise.all([
        apiFetch<{ order: MarketOrder }>(`/market/orders/${orderId}`),
        apiFetch<{ messages: OrderMessage[] }>(`/market/orders/${orderId}/messages`),
      ]);
      setOrder(detail.order);
      setMessages(chat.messages);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, body?: any) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/market/seller/orders/${orderId}/${action}`, { method: "POST", body: JSON.stringify(body || {}) });
      await load();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    try {
      const response = await apiFetch<{ message: OrderMessage }>(`/market/orders/${orderId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => [...prev, response.message]);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando pedido...</div>;
  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-white/60">{error || "No encontramos este pedido."}</p>
        <Link href="/marketplace/vender?tab=pedidos" className="mt-4 inline-block text-sm font-semibold text-fuchsia-300">Volver a mis pedidos</Link>
      </div>
    );
  }

  const status = ORDER_STATUS_UI[order.status];

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/marketplace/vender?tab=pedidos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Mis pedidos
      </Link>

      <div>
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-white">{order.productTitle}</h1>
            <p className="text-xs text-white/40">{order.code} · {formatDate(order.createdAt)}</p>
          </div>
          <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
        </div>

        <div className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
          <Row label="Recibes" value={formatClp(order.sellerNetClp)} strong />
          <Row label="Comisión UZEED" value={formatClp(order.commissionClp)} />
          <Row label="Total pagado" value={formatClp(order.totalClp)} />
          <Row label="Entrega" value={DELIVERY_LABEL[order.deliveryMethod]} />
        </div>

        {order.buyer && (
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(order.buyer.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{order.buyer.displayName || order.buyer.username}</p>
              <p className="text-[11px] text-white/40">Compradora</p>
            </div>
          </div>
        )}

        {order.deliveryMethod === "SHIPPING" && order.shipAddress && (
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] p-3 text-sm text-sky-100/85">
            <p className="flex items-center gap-1.5 font-semibold text-sky-100"><Truck className="h-4 w-4" /> Dónde entregar</p>
            <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
            <p>{order.shipAddress}{order.shipCity ? `, ${order.shipCity}` : ""}</p>
            <p className="text-xs text-sky-200/60">{order.shippingRegion} · envío {formatClp(order.shippingClp)}</p>
          </div>
        )}

        {order.deliveryMethod === "MEET" && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.07] p-3 text-sm text-fuchsia-100/85">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            Entrega acordada: ponte de acuerdo con la clienta por el chat de abajo.
          </p>
        )}

        {order.status === "DISPUTED" && (
          <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/[0.07] p-3 text-sm text-orange-100/85">
            <p className="flex items-center gap-1.5 font-semibold text-orange-100">
              <AlertTriangle className="h-4 w-4" /> La clienta abrió un reclamo
            </p>
            {order.disputeReason && <p className="mt-1">{order.disputeReason}</p>}
            <p className="mt-1 text-xs text-orange-100/60">
              El pago queda retenido hasta que administración resuelva. Responde por el chat con lo que tengas:
              comprobante de envío, seguimiento o lo que hayan acordado.
            </p>
          </div>
        )}

        {order.shipNotes && <p className="mt-3 text-sm text-white/55">Nota de la clienta: {order.shipNotes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === "PAID" && (
            <button type="button" disabled={busy} onClick={() => act("accept")} className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-white">
              Estoy preparándolo
            </button>
          )}
          {["PAID", "PREPARING"].includes(order.status) && order.deliveryMethod === "DIGITAL" && order.assetCount === 0 && (
            <button type="button" disabled={busy} onClick={() => act("send-assets")} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-200">
              <Zap className="h-3.5 w-3.5" /> Enviar contenido
            </button>
          )}
          {["PAID", "PREPARING"].includes(order.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const tracking = order.deliveryMethod === "SHIPPING" ? window.prompt("Código de seguimiento (opcional)") : null;
                act("deliver", tracking ? { trackingCode: tracking } : {});
              }}
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-xs font-bold text-white"
            >
              Marcar entregado
            </button>
          )}
        </div>

        {order.status === "DELIVERED" && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/45">
            <Clock className="h-3 w-3" /> Tu pago se libera cuando la clienta confirme, o solo al vencer la retención.
          </p>
        )}
      </div>

      <section className="mt-8 border-t border-white/[0.07] pt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
          <MessageCircle className="h-4 w-4 text-fuchsia-300" /> Chat con la clienta
        </h2>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/35">Todavía no hay mensajes.</p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === me?.user?.id;
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-fuchsia-500/20 text-white" : "bg-white/[0.06] text-white/80"}`}>
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p className="mt-0.5 text-[10px] text-white/35">{formatDate(message.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
          />
          <button type="button" onClick={sendMessage} className="rounded-xl bg-fuchsia-500/20 px-4 text-fuchsia-200" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>

      {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/45">{label}</span>
      <span className={strong ? "font-bold text-emerald-300" : "text-white/85"}>{value}</span>
    </div>
  );
}
