"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, PackageOpen, ShoppingBag, Zap } from "lucide-react";

import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";
import { ORDER_STATUS_UI, formatClp, formatDate, type MarketOrder } from "../../../lib/marketplace";

export default function PurchasesPage() {
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ orders: MarketOrder[] }>("/market/orders");
      setOrders(response.orders);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <PackageOpen className="h-6 w-6 text-fuchsia-300" /> Mis compras
      </h1>
      <p className="mt-1 text-sm text-white/50">
        Aquí ves tu contenido, coordinas las entregas y confirmas la recepción para liberar el pago.
      </p>

      {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          ))
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-white/25" />
            <p className="text-sm text-white/60">Todavía no compraste nada en el marketplace.</p>
            <Link href="/marketplace" className="mt-4 inline-block text-sm font-semibold text-fuchsia-300">Ver artículos</Link>
          </div>
        ) : (
          orders.map((order) => {
            const status = ORDER_STATUS_UI[order.status];
            const cover = resolveMediaUrl(order.product?.coverUrl);
            return (
              <Link
                key={order.id}
                href={`/marketplace/compras/${order.id}`}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🎁</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{order.productTitle}</p>
                    <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {order.code} · {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-fuchsia-300">{formatClp(order.totalClp)}</p>
                  {order.assetCount > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-300">
                      <Zap className="h-3 w-3" /> {order.assetCount} archivo{order.assetCount === 1 ? "" : "s"} disponible{order.assetCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
