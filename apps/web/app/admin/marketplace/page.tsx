"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote, CheckCircle2, Clock, DollarSign, Eye, EyeOff, MessageCircle,
  Package, Percent, Save, Settings, ShieldCheck, ShoppingBag, Store, Truck,
  Users, XCircle,
} from "lucide-react";

import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";
import ProtectedGallery from "../../../components/marketplace/ProtectedGallery";
import { StatRow } from "../../../components/marketplace/ui";
import {
  ORDER_STATUS_UI, DELIVERY_LABEL, formatClp, formatDate,
  type MarketOrderAsset, type MarketOrderStatus,
} from "../../../lib/marketplace";

type Settings = {
  id: string;
  isEnabled: boolean;
  commissionPercent: number;
  holdDays: number;
  minPriceClp: number;
  maxPriceClp: number;
  gatewayEnabled: boolean;
  transferEnabled: boolean;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankHolderName: string | null;
  bankHolderRut: string | null;
  bankEmail: string | null;
  transferNote: string | null;
};

type ShippingRate = { id: string; region: string; priceClp: number; etaText: string | null; isActive: boolean };

type Overview = {
  settings: Settings;
  metrics: {
    grossClp: number;
    commissionClp: number;
    heldClp: number;
    paidOrders: number;
    sellers: number;
    products: number;
    pendingWithdrawals: number;
    pendingTransfers: number;
    byStatus: Record<string, number>;
  };
};

type AdminOrder = {
  id: string;
  code: string;
  status: MarketOrderStatus;
  productTitle: string;
  totalClp: number;
  commissionClp: number;
  sellerNetClp: number;
  deliveryMethod: keyof typeof DELIVERY_LABEL;
  paymentMethod: string;
  transferReceiptUrl: string | null;
  shippingRegion: string | null;
  createdAt: string;
  payoutStatus: string;
  buyer: { id: string; username: string; displayName: string | null; email: string } | null;
  seller: { id: string; username: string; displayName: string | null; email: string } | null;
  _count?: { assets: number; messages: number };
};

type Tab = "resumen" | "pedidos" | "envios" | "retiros" | "tiendas" | "config";

const TABS: Array<{ key: Tab; label: string; icon: typeof Store }> = [
  { key: "resumen", label: "Resumen", icon: DollarSign },
  { key: "pedidos", label: "Pedidos", icon: Package },
  { key: "envios", label: "Envíos", icon: Truck },
  { key: "retiros", label: "Retiros", icon: Banknote },
  { key: "tiendas", label: "Tiendas", icon: Store },
  { key: "config", label: "Configuración", icon: Settings },
];

const ORDER_FILTERS: Array<{ value: string; label: string }> = [
  { value: "PAYMENT_REVIEW", label: "Transferencias por validar" },
  { value: "PAID", label: "Pagados" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "COMPLETED", label: "Completados" },
  { value: "ALL", label: "Todos" },
];

export default function AdminMarketplacePage() {
  const [tab, setTab] = useState<Tab>("resumen");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await apiFetch<Overview>("/admin/market/overview"));
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
      <header className="border-b border-white/[0.07] pb-4">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Marketplace</h1>
        <p className="mt-1 text-sm text-white/45">Pedidos, comisiones, envíos y contenido vendido</p>
      </header>

      <nav className="-mb-px mt-5 flex gap-5 overflow-x-auto border-b border-white/[0.07]">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 border-b-2 pb-2.5 text-sm transition ${
              tab === item.key ? "border-fuchsia-400 text-white" : "border-transparent text-white/45 hover:text-white/75"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      <div className="mt-5">
        {tab === "resumen" && <OverviewTab overview={overview} />}
        {tab === "pedidos" && <OrdersTab onError={setError} onNotice={flash} reload={loadOverview} />}
        {tab === "envios" && <ShippingTab onError={setError} onNotice={flash} />}
        {tab === "retiros" && <WithdrawalsTab onError={setError} onNotice={flash} reload={loadOverview} />}
        {tab === "tiendas" && <SellersTab onError={setError} onNotice={flash} />}
        {tab === "config" && overview && <SettingsTab settings={overview.settings} onError={setError} onNotice={flash} reload={loadOverview} />}
      </div>
    </div>
  );
}

/* ─────────── Resumen ─────────── */

function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview) return <p className="text-sm text-white/45">Cargando métricas...</p>;
  const { metrics } = overview;

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: "Vendido (bruto)", value: formatClp(metrics.grossClp) },
          { label: "Comisión UZEED", value: formatClp(metrics.commissionClp), accent: "positive" },
          { label: "Retenido", value: formatClp(metrics.heldClp) },
          { label: "Pedidos pagados", value: String(metrics.paidOrders) },
        ]}
      />

      <StatRow
        items={[
          { label: "Tiendas", value: String(metrics.sellers) },
          { label: "Artículos activos", value: String(metrics.products) },
          { label: "Retiros pendientes", value: String(metrics.pendingWithdrawals), accent: metrics.pendingWithdrawals ? undefined : "muted" },
        ]}
      />

      {metrics.pendingTransfers > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100">
          Hay {metrics.pendingTransfers} transferencia(s) esperando validación en la pestaña Pedidos.
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-white/70">Pedidos por estado</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(metrics.byStatus).map(([status, count]) => (
            <span key={status} className={`rounded-lg border px-2.5 py-1 text-[11px] ${ORDER_STATUS_UI[status as MarketOrderStatus]?.className || "border-white/10 text-white/60"}`}>
              {ORDER_STATUS_UI[status as MarketOrderStatus]?.label || status}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Pedidos ─────────── */

function OrdersTab({
  onError, onNotice, reload,
}: { onError: (v: string | null) => void; onNotice: (v: string) => void; reload: () => void }) {
  const [status, setStatus] = useState("PAYMENT_REVIEW");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ orders: AdminOrder[] }>(`/admin/market/orders?status=${status}&limit=80`);
      setOrders(response.orders);
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [onError, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (orderId: string, action: string, body?: any) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/market/orders/${orderId}/${action}`, { method: "POST", body: JSON.stringify(body || {}) });
      onNotice("Pedido actualizado");
      await load();
      reload();
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ORDER_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatus(filter.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              status === filter.value ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-white/45">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="py-14 text-center text-sm text-white/45">Sin pedidos en este estado.</p>
      ) : (
        orders.map((order) => {
          const ui = ORDER_STATUS_UI[order.status];
          return (
            <div key={order.id} className="border-b border-white/[0.06] py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{order.productTitle}</p>
                  <p className="text-[11px] text-white/40">
                    {order.code} · {formatDate(order.createdAt)} · {DELIVERY_LABEL[order.deliveryMethod]}
                  </p>
                  <p className="mt-1 text-[11px] text-white/50">
                    {order.buyer?.username} → {order.seller?.username}
                  </p>
                </div>
                <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${ui.className}`}>{ui.label}</span>
              </div>

              <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-3">
                <Detail label="Total" value={formatClp(order.totalClp)} />
                <Detail label="Comisión" value={formatClp(order.commissionClp)} />
                <Detail label="Vendedora" value={formatClp(order.sellerNetClp)} />
              </div>

              {order.transferReceiptUrl && (
                <a
                  href={resolveMediaUrl(order.transferReceiptUrl) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver comprobante
                </a>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {["PAYMENT_REVIEW", "PENDING_PAYMENT"].includes(order.status) && (
                  <>
                    <button type="button" disabled={busy} onClick={() => act(order.id, "approve-transfer")} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar pago
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Motivo del rechazo") || "";
                        if (reason) act(order.id, "reject-transfer", { reason });
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </>
                )}
                {order.payoutStatus === "HELD" && ["PAID", "PREPARING", "DELIVERED"].includes(order.status) && (
                  <>
                    <button type="button" disabled={busy} onClick={() => act(order.id, "release")} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white">
                      Liberar pago
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Motivo del reembolso") || "";
                        if (reason) act(order.id, "refund", { reason });
                      }}
                      className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
                    >
                      Reembolsar
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setOpenId(openId === order.id ? null : order.id)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/60"
                >
                  {openId === order.id ? "Ocultar detalle" : "Ver contenido y chat"}
                </button>
              </div>

              {openId === order.id && <OrderInspector orderId={order.id} onError={onError} />}
            </div>
          );
        })
      )}
    </div>
  );
}

/** Vista completa del pedido: lo que se entregó y lo que se conversó. */
function OrderInspector({ orderId, onError }: { orderId: string; onError: (v: string | null) => void }) {
  const [assets, setAssets] = useState<MarketOrderAsset[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; body: string; createdAt: string; sender: { username: string } }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; type: string; note: string | null; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ assets: MarketOrderAsset[]; messages: any[]; events: any[] }>(`/admin/market/orders/${orderId}`)
      .then((response) => {
        if (cancelled) return;
        setAssets(response.assets || []);
        setMessages(response.messages || []);
        setEvents(response.events || []);
      })
      .catch((err) => onError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [onError, orderId]);

  if (loading) return <p className="mt-3 text-xs text-white/45">Cargando detalle...</p>;

  return (
    <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/60">
          <ShieldCheck className="h-3.5 w-3.5" /> Contenido entregado ({assets.length})
        </p>
        {assets.length > 0 ? (
          <ProtectedGallery assets={assets} watermark="UZEED · Revisión admin" />
        ) : (
          <p className="text-xs text-white/35">Este pedido no entregó archivos digitales.</p>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/60">
          <MessageCircle className="h-3.5 w-3.5" /> Chat ({messages.length})
        </p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-white/35">Sin mensajes.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] text-white/35">{message.sender.username} · {formatDate(message.createdAt)}</p>
                <p className="text-xs text-white/75">{message.body}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-white/60">Bitácora</p>
        <div className="space-y-1">
          {events.map((event) => (
            <p key={event.id} className="text-[11px] text-white/45">
              {formatDate(event.createdAt)} — {event.type}{event.note ? `: ${event.note}` : ""}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Envíos ─────────── */

function ShippingTab({ onError, onNotice }: { onError: (v: string | null) => void; onNotice: (v: string) => void }) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [region, setRegion] = useState("");
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ shippingRates: ShippingRate[] }>("/admin/market/settings");
      setRates(response.shippingRates);
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    }
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const save = async (rate: ShippingRate, changes: Partial<ShippingRate>) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/market/shipping-rates/${rate.id}`, { method: "PUT", body: JSON.stringify(changes) });
      await load();
      onNotice("Tarifa actualizada");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await apiFetch("/admin/market/shipping-rates", {
        method: "POST",
        body: JSON.stringify({ region, priceClp: Number(price) || 0, etaText: eta }),
      });
      setRegion(""); setPrice(""); setEta("");
      await load();
      onNotice("Región agregada");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white/70">Agregar región</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Región" className={inputClass} />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio CLP" type="number" className={inputClass} />
          <input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="2 a 4 días hábiles" className={inputClass} />
          <button type="button" disabled={busy || !region} onClick={create} className="rounded-xl bg-fuchsia-500/20 px-4 py-2.5 text-sm font-semibold text-fuchsia-200 disabled:opacity-40">
            Agregar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rates.map((rate) => (
          <div key={rate.id} className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] py-3">
            <span className="min-w-[140px] flex-1 text-sm text-white">{rate.region}</span>
            <input
              type="number"
              defaultValue={rate.priceClp}
              onBlur={(e) => {
                const value = Number(e.target.value) || 0;
                if (value !== rate.priceClp) save(rate, { priceClp: value });
              }}
              className="w-28 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
            />
            <input
              defaultValue={rate.etaText || ""}
              onBlur={(e) => {
                if (e.target.value !== (rate.etaText || "")) save(rate, { etaText: e.target.value });
              }}
              className="w-44 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => save(rate, { isActive: !rate.isActive })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                rate.isActive ? "bg-emerald-500/15 text-emerald-200" : "bg-white/[0.06] text-white/45"
              }`}
            >
              {rate.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {rate.isActive ? "Activa" : "Inactiva"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Retiros ─────────── */

function WithdrawalsTab({
  onError, onNotice, reload,
}: { onError: (v: string | null) => void; onNotice: (v: string) => void; reload: () => void }) {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ withdrawals: any[] }>(`/admin/market/withdrawals?status=${status}`);
      setWithdrawals(response.withdrawals);
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    }
  }, [onError, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    setBusy(true);
    try {
      const note = action === "REJECT" ? window.prompt("Motivo del rechazo") || "" : undefined;
      await apiFetch(`/admin/market/withdrawals/${id}`, { method: "PUT", body: JSON.stringify({ action, note }) });
      await load();
      reload();
      onNotice("Retiro actualizado");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "PAID", "REJECTED", "ALL"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              status === value ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/[0.04] text-white/55"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {withdrawals.length === 0 ? (
        <p className="py-14 text-center text-sm text-white/45">Sin retiros en este estado.</p>
      ) : (
        withdrawals.map((withdrawal) => (
          <div key={withdrawal.id} className="border-b border-white/[0.06] py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{formatClp(withdrawal.amountClp)}</p>
                <p className="text-[11px] text-white/45">
                  {withdrawal.user?.username} · {formatDate(withdrawal.createdAt)}
                </p>
              </div>
              <span className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] text-white/60">{withdrawal.status}</span>
            </div>

            {withdrawal.bankSnapshot && (
              <div className="mt-3 grid gap-1 text-[11px] text-white/55 sm:grid-cols-2">
                <span>Banco: {withdrawal.bankSnapshot.bankName}</span>
                <span>Cuenta: {withdrawal.bankSnapshot.accountNumber}</span>
                <span>Titular: {withdrawal.bankSnapshot.holderName}</span>
                <span>RUT: {withdrawal.bankSnapshot.holderRut}</span>
              </div>
            )}

            {withdrawal.status === "PENDING" && (
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={() => act(withdrawal.id, "APPROVE")} className="rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                  Aprobar
                </button>
                <button type="button" disabled={busy} onClick={() => act(withdrawal.id, "REJECT")} className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
                  Rechazar
                </button>
              </div>
            )}
            {withdrawal.status === "APPROVED" && (
              <button type="button" disabled={busy} onClick={() => act(withdrawal.id, "PAY")} className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white">
                Marcar transferido
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────── Tiendas ─────────── */

function SellersTab({ onError, onNotice }: { onError: (v: string | null) => void; onNotice: (v: string) => void }) {
  const [sellers, setSellers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ sellers: any[] }>("/admin/market/sellers");
      setSellers(response.sellers);
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    }
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (seller: any) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/market/sellers/${seller.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ isBanned: !seller.isBanned }),
      });
      await load();
      onNotice(seller.isBanned ? "Tienda habilitada" : "Tienda suspendida");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {sellers.map((seller) => (
        <div key={seller.id} className="flex items-center gap-3 border-b border-white/[0.06] py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(seller.user?.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-10 w-10 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{seller.storeName || seller.user?.username}</p>
            <p className="text-[11px] text-white/40">
              {seller._count?.products || 0} artículos · {seller.totalSales} ventas · {formatClp(seller.totalEarnedClp)}
            </p>
          </div>
          <Link href={`/marketplace/tienda/${seller.user?.username}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60">
            Ver
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => toggleBan(seller)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${seller.isBanned ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}
          >
            {seller.isBanned ? "Habilitar" : "Suspender"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────── Configuración ─────────── */

function SettingsTab({
  settings, onError, onNotice, reload,
}: { settings: Settings; onError: (v: string | null) => void; onNotice: (v: string) => void; reload: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

  const update = (changes: Partial<Settings>) => setForm((prev) => ({ ...prev, ...changes }));

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("/admin/market/settings", { method: "PUT", body: JSON.stringify(form) });
      reload();
      onNotice("Configuración guardada");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70">Reglas del marketplace</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Comisión UZEED (%)" value={form.commissionPercent} onChange={(v) => update({ commissionPercent: v })} />
          <NumberField label="Días de retención del pago" value={form.holdDays} onChange={(v) => update({ holdDays: v })} />
          <NumberField label="Precio mínimo (CLP)" value={form.minPriceClp} onChange={(v) => update({ minPriceClp: v })} />
          <NumberField label="Precio máximo (CLP)" value={form.maxPriceClp} onChange={(v) => update({ maxPriceClp: v })} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Check label="Marketplace activo" checked={form.isEnabled} onChange={(v) => update({ isEnabled: v })} />
          <Check label="Pago con pasarela" checked={form.gatewayEnabled} onChange={(v) => update({ gatewayEnabled: v })} />
          <Check label="Pago por transferencia" checked={form.transferEnabled} onChange={(v) => update({ transferEnabled: v })} />
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.07] pt-6">
        <h2 className="text-sm font-semibold text-white/70">Datos de transferencia de UZEED</h2>
        <p className="text-xs text-white/45">Son los datos que ve la clienta cuando elige pagar por transferencia.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Banco" value={form.bankName} onChange={(v) => update({ bankName: v })} />
          <TextField label="Tipo de cuenta" value={form.bankAccountType} onChange={(v) => update({ bankAccountType: v })} />
          <TextField label="N° de cuenta" value={form.bankAccountNumber} onChange={(v) => update({ bankAccountNumber: v })} />
          <TextField label="Titular" value={form.bankHolderName} onChange={(v) => update({ bankHolderName: v })} />
          <TextField label="RUT" value={form.bankHolderRut} onChange={(v) => update({ bankHolderRut: v })} />
          <TextField label="Correo" value={form.bankEmail} onChange={(v) => update({ bankEmail: v })} />
        </div>
        <TextField label="Nota para la clienta" value={form.transferNote} onChange={(v) => update({ transferNote: v })} />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        <Save className="h-4 w-4" /> Guardar configuración
      </button>
    </div>
  );
}

/* ─────────── UI ─────────── */

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40";

function Metric({ icon: Icon, label, value, accent }: { icon: typeof Store; label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]",
    amber: "text-amber-300 border-amber-500/20 bg-amber-500/[0.06]",
    fuchsia: "text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/[0.06]",
    violet: "text-violet-300 border-violet-500/20 bg-violet-500/[0.06]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[accent] || colors.fuchsia}`}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/45">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className={inputClass} />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-fuchsia-500" />
      {label}
    </label>
  );
}
