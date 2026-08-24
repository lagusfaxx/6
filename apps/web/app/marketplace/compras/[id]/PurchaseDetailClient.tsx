"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, CreditCard, MapPin, MessageCircle, Send,
  ShieldCheck, Star, Truck, Upload, Zap,
} from "lucide-react";

import useMe from "../../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../../lib/api";
import ProtectedGallery from "../../../../components/marketplace/ProtectedGallery";
import BankData from "../../../../components/marketplace/BankData";
import {
  DELIVERY_LABEL, ORDER_STATUS_UI, formatClp, formatDate, timeUntil,
  type MarketOrder, type MarketOrderAsset, type MarketTransferData,
} from "../../../../lib/marketplace";

type OrderDetail = {
  order: MarketOrder;
  assets: MarketOrderAsset[];
  events: Array<{ id: string; type: string; note: string | null; createdAt: string }>;
  review: { id: string; rating: number; comment: string | null } | null;
  holdDays: number;
  transferData: MarketTransferData | null;
};

type OrderMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

export default function PurchaseDetailClient({ orderId }: { orderId: string }) {
  const { me } = useMe();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const receiptRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, chat] = await Promise.all([
        apiFetch<OrderDetail>(`/market/orders/${orderId}`),
        apiFetch<{ messages: OrderMessage[] }>(`/market/orders/${orderId}/messages`),
      ]);
      setData(detail);
      setMessages(chat.messages);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  /* Las URLs del contenido caducan a los 15 minutos: se renuevan solas. */
  const refreshAssets = useCallback(async () => {
    try {
      const response = await apiFetch<{ assets: MarketOrderAsset[] }>(`/market/orders/${orderId}/assets`);
      setData((prev) => (prev ? { ...prev, assets: response.assets } : prev));
    } catch {
      // Si falla, el visor muestra el error de carga y el usuario puede recargar.
    }
  }, [orderId]);

  useEffect(() => {
    if (!data?.assets.length) return;
    const timer = window.setInterval(refreshAssets, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [data?.assets.length, refreshAssets]);

  const act = async (path: string, body?: any) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/market/orders/${orderId}${path}`, { method: "POST", body: JSON.stringify(body || {}) });
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

  const uploadReceipt = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiBase()}/market/orders/${orderId}/receipt`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "UPLOAD_FAILED");
      setNotice("Comprobante enviado. Lo validamos y avisamos a la vendedora.");
      await load();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const retryPayment = async () => {
    setBusy(true);
    try {
      const response = await apiFetch<{ paymentUrl?: string }>(`/market/orders/${orderId}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: "FLOW" }),
      });
      if (response.paymentUrl) window.location.href = response.paymentUrl;
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
      setBusy(false);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando pedido...</div>;
  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-white/60">{error || "No encontramos este pedido."}</p>
        <Link href="/marketplace/compras" className="mt-4 inline-block text-sm font-semibold text-fuchsia-300">Volver a mis compras</Link>
      </div>
    );
  }

  const { order, assets, holdDays, transferData } = data;
  const status = ORDER_STATUS_UI[order.status];
  const watermark = `${me?.user?.username || "uzeed"} · ${order.code}`;
  const canConfirm = ["PAID", "PREPARING", "DELIVERED"].includes(order.status);
  const releaseIn = timeUntil(order.autoReleaseAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/marketplace/compras" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Mis compras
      </Link>

      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-white">{order.productTitle}</h1>
            <p className="mt-0.5 text-xs text-white/40">{order.code} · {formatDate(order.createdAt)}</p>
          </div>
          <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
        </div>

        <div className="mt-4 space-y-1.5 text-sm">
          <Row label="Artículo" value={formatClp(order.itemTotalClp)} />
          {order.shippingClp > 0 && <Row label={`Envío (${order.shippingRegion})`} value={formatClp(order.shippingClp)} />}
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-semibold text-white">Total</span>
            <span className="text-lg font-bold text-fuchsia-300">{formatClp(order.totalClp)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
            {order.deliveryMethod === "SHIPPING" ? <Truck className="h-3 w-3" /> : order.deliveryMethod === "MEET" ? <MapPin className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {DELIVERY_LABEL[order.deliveryMethod]}
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
            <CreditCard className="h-3 w-3" /> {order.paymentMethod === "TRANSFER" ? "Transferencia" : "Pasarela"}
          </span>
          {order.trackingCode && (
            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">Seguimiento: {order.trackingCode}</span>
          )}
        </div>

        {order.seller && (
          <Link
            href={`/marketplace/tienda/${order.seller.username}`}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(order.seller.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{order.seller.displayName || order.seller.username}</p>
              <p className="text-[11px] text-white/40">Vendedora</p>
            </div>
          </Link>
        )}
      </div>

      {/* ── Pago pendiente ── */}
      {["PENDING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status) && (
        <section className="mt-4 rounded-3xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-100">
            <Clock className="h-4 w-4" />
            {order.status === "PAYMENT_REVIEW" ? "Estamos validando tu transferencia" : "Falta completar el pago"}
          </h2>

          {order.paymentMethod === "TRANSFER" && transferData ? (
            <>
              <p className="mt-1 text-xs text-amber-100/70">
                Transfiere {formatClp(order.totalClp)} y sube el comprobante. Usa {order.code} como comentario.
              </p>
              <BankData data={transferData} code={order.code} />
              <input
                ref={receiptRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadReceipt(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => receiptRef.current?.click()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                <Upload className="h-4 w-4" /> {order.transferReceiptUrl ? "Subir otro comprobante" : "Subir comprobante"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={retryPayment}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <CreditCard className="h-4 w-4" /> Pagar ahora
            </button>
          )}

          {order.status === "PENDING_PAYMENT" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act("/cancel")}
              className="mt-2 w-full rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:bg-white/[0.05]"
            >
              Cancelar el pedido
            </button>
          )}
        </section>
      )}

      {/* ── Contenido comprado ── */}
      {assets.length > 0 && (
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Tu contenido
          </h2>
          <ProtectedGallery assets={assets} watermark={watermark} onRefreshUrls={refreshAssets} />
        </section>
      )}

      {/* ── Confirmar recepción ── */}
      {canConfirm && (
        <section className="mt-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-100">
            <CheckCircle2 className="h-4 w-4" /> Confirmar recepción
          </h2>
          <p className="mt-1 text-xs text-emerald-100/70">
            Al confirmar liberamos el pago a la vendedora.
            {releaseIn ? ` Si no lo haces, se libera solo en ${releaseIn}.` : ` Se libera solo a los ${holdDays} días del pago.`}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("/confirm")}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Recibí mi pedido
          </button>
        </section>
      )}

      {/* ── Reseña ── */}
      {order.status === "COMPLETED" && !data.review && <ReviewBox orderId={order.id} onDone={load} />}

      {/* ── Chat del pedido ── */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <MessageCircle className="h-4 w-4 text-fuchsia-300" /> Chat del pedido
        </h2>
        {order.deliveryMethod === "MEET" && (
          <p className="mb-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2.5 text-[11px] text-fuchsia-100/80">
            Coordina aquí día, hora y lugar de la entrega. Todo queda registrado dentro de UZEED.
          </p>
        )}

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
          <button
            type="button"
            onClick={sendMessage}
            className="rounded-xl bg-fuchsia-500/20 px-4 text-fuchsia-200 transition hover:bg-fuchsia-500/30"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>

      {notice && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    </div>
  );
}

function ReviewBox({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch(`/market/orders/${orderId}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-bold text-white">¿Cómo te fue?</h2>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} estrellas`}>
            <Star className={`h-6 w-6 ${i < rating ? "fill-amber-300 text-amber-300" : "text-white/20"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Cuéntale al resto cómo fue la compra (opcional)"
        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
      />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Enviar reseña
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
