"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, Building2, ChevronLeft, ChevronRight, CreditCard,
  Lock, MapPin, PackageOpen, ShieldCheck, ShoppingBag, Star, Truck, Users, Zap,
} from "lucide-react";

import useMe from "../../../../hooks/useMe";
import BankData from "../../../../components/marketplace/BankData";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../../lib/api";
import {
  DELIVERY_HINT, DELIVERY_LABEL, PRODUCT_TYPE_EMOJI, PRODUCT_TYPE_LABEL, formatClp,
  type MarketConfig, type MarketDeliveryMethod, type MarketOrder, type MarketProduct, type MarketTransferData,
} from "../../../../lib/marketplace";

type Detail = {
  product: MarketProduct;
  seller: {
    id: string; username: string; displayName: string | null; avatarUrl: string | null; city: string | null;
    isVerified: boolean; storeName: string | null; tagline: string | null; bio: string | null; region: string | null;
    totalSales: number; acceptsShipping: boolean; acceptsMeet: boolean;
  };
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string; buyer: { username: string; displayName: string | null; avatarUrl: string | null } }>;
  holdDays: number;
};

export default function ProductClient({ productId }: { productId: string }) {
  const router = useRouter();
  const { me } = useMe();
  const [data, setData] = useState<Detail | null>(null);
  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, cfg] = await Promise.all([
        apiFetch<Detail>(`/market/products/${productId}`),
        apiFetch<MarketConfig>("/market/config"),
      ]);
      setData(detail);
      setConfig(cfg);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando artículo...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-white/60">{error || "No encontramos este artículo."}</p>
        <Link href="/marketplace" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300">
          <ArrowLeft className="h-4 w-4" /> Volver al marketplace
        </Link>
      </div>
    );
  }

  const { product, seller, reviews, holdDays } = data;
  const media = product.media.length ? product.media : [];
  const current = media[mediaIndex];
  const isOwner = me?.user?.id === seller.id;
  const isAuthed = Boolean(me?.user?.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Galería ── */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-black/40">
            {current ? (
              current.type === "VIDEO" ? (
                <video src={resolveMediaUrl(current.url) || ""} controls playsInline className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(current.url) || ""} alt={product.title} className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">{PRODUCT_TYPE_EMOJI[product.type]}</div>
            )}

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setMediaIndex((i) => (i - 1 + media.length) % media.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMediaIndex((i) => (i + 1) % media.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {product.type !== "CLOTHING" && product.type !== "FETISH" && (
              <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur">
                <Lock className="h-3 w-3" /> Vista previa — el contenido completo llega tras la compra
              </span>
            )}
          </div>

          {media.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {media.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMediaIndex(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition ${
                    index === mediaIndex ? "border-fuchsia-400" : "border-white/10 opacity-70"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveMediaUrl(item.thumbnailUrl || item.url) || ""} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Detalle y compra ── */}
        <div className="space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/60">
              {PRODUCT_TYPE_EMOJI[product.type]} {PRODUCT_TYPE_LABEL[product.type]}
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">{product.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-bold text-fuchsia-300">{formatClp(product.priceClp)}</span>
              {product.ratingCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" /> {product.ratingAvg?.toFixed(1)}
                  <span className="text-white/40">({product.ratingCount})</span>
                </span>
              )}
              {product.salesCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <Users className="h-3.5 w-3.5" /> {product.salesCount} vendidos
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/marketplace/tienda/${seller.username}`}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(seller.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-11 w-11 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                {seller.storeName || seller.displayName || seller.username}
                {seller.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-sky-400" />}
              </p>
              <p className="truncate text-[11px] text-white/45">
                {seller.city ? `${seller.city} · ` : ""}{seller.totalSales} venta{seller.totalSales === 1 ? "" : "s"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30" />
          </Link>

          {product.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{product.description}</p>
          )}

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Formas de entrega</p>
            {product.deliveryMethods.map((method) => (
              <div key={method} className="flex items-start gap-2.5">
                {method === "DIGITAL" ? <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  : method === "SHIPPING" ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />}
                <div>
                  <p className="text-sm font-medium text-white">{DELIVERY_LABEL[method]}</p>
                  <p className="text-[11px] text-white/45">{DELIVERY_HINT[method]}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-[11px] leading-relaxed text-emerald-100/80">
              Tu pago queda retenido por UZEED y se libera cuando marcas el pedido como recibido, o automáticamente a los{" "}
              {holdDays} días. Si algo sale mal, escríbenos antes de confirmar.
            </p>
          </div>

          {product.stock !== null && (
            <p className="text-xs text-white/45">
              {product.stock > 0 ? `Quedan ${product.stock} unidades` : "Sin stock por ahora"}
            </p>
          )}

          {isOwner ? (
            <Link
              href="/marketplace/vender?tab=productos"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white"
            >
              <PackageOpen className="h-4 w-4" /> Este es tu artículo — administrarlo
            </Link>
          ) : !isAuthed ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/marketplace/producto/${product.id}`)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white"
            >
              Inicia sesión para comprar
            </Link>
          ) : (
            <button
              type="button"
              disabled={product.stock !== null && product.stock <= 0}
              onClick={() => setCheckoutOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:opacity-40"
            >
              <ShoppingBag className="h-4 w-4" /> Comprar {formatClp(product.priceClp)}
            </button>
          )}
        </div>
      </div>

      {/* ── Reseñas ── */}
      {reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-white">Lo que dicen quienes compraron</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveMediaUrl(review.buyer.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{review.buyer.displayName || review.buyer.username}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-amber-300 text-amber-300" : "text-white/20"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                {review.comment && <p className="mt-2 text-sm text-white/60">{review.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {checkoutOpen && config && (
        <CheckoutDialog
          product={product}
          config={config}
          holdDays={holdDays}
          onClose={() => setCheckoutOpen(false)}
          onDone={(orderId) => router.push(`/marketplace/compras/${orderId}`)}
        />
      )}
    </div>
  );
}

/* ══════════════════════ Checkout ══════════════════════ */

function CheckoutDialog({
  product, config, holdDays, onClose, onDone,
}: {
  product: MarketProduct;
  config: MarketConfig;
  holdDays: number;
  onClose: () => void;
  onDone: (orderId: string) => void;
}) {
  const methods = product.deliveryMethods;
  const [delivery, setDelivery] = useState<MarketDeliveryMethod>(methods[0] || "DIGITAL");
  const [quantity, setQuantity] = useState(1);
  const [region, setRegion] = useState(config.shippingRates[0]?.region || "");
  const [shipName, setShipName] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [shipAddress, setShipAddress] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipNotes, setShipNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"FLOW" | "TRANSFER">(config.gatewayEnabled ? "FLOW" : "TRANSFER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{ order: MarketOrder; data: MarketTransferData } | null>(null);

  const shippingClp = useMemo(() => {
    if (delivery !== "SHIPPING") return 0;
    return config.shippingRates.find((r) => r.region === region)?.priceClp || 0;
  }, [config.shippingRates, delivery, region]);

  const itemTotal = product.priceClp * quantity;
  const total = itemTotal + shippingClp;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<{ order: MarketOrder; paymentMethod: string; paymentUrl?: string; transferData?: MarketTransferData }>(
        "/market/orders",
        {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            quantity,
            deliveryMethod: delivery,
            paymentMethod,
            shippingRegion: delivery === "SHIPPING" ? region : undefined,
            shipName: delivery === "SHIPPING" ? shipName : undefined,
            shipPhone: delivery === "SHIPPING" ? shipPhone : undefined,
            shipAddress: delivery === "SHIPPING" ? shipAddress : undefined,
            shipCity: delivery === "SHIPPING" ? shipCity : undefined,
            shipNotes: shipNotes || undefined,
          }),
        },
      );

      if (response.paymentMethod === "FLOW" && response.paymentUrl) {
        window.location.href = response.paymentUrl;
        return;
      }
      if (response.transferData) {
        setTransfer({ order: response.order, data: response.transferData });
        return;
      }
      onDone(response.order.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (transfer) {
    return (
      <Dialog onClose={onClose} title={`Pedido ${transfer.order.code} creado`}>
        <p className="text-sm text-white/60">
          Transfiere <strong className="text-white">{formatClp(transfer.order.totalClp)}</strong> a la cuenta de UZEED y sube el
          comprobante desde tu compra. Apenas lo validemos, la vendedora recibe la orden.
        </p>
        <BankData data={transfer.data} code={transfer.order.code} />
        <button
          type="button"
          onClick={() => onDone(transfer.order.id)}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white"
        >
          Ir a mi compra y subir el comprobante
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} title="Confirmar compra">
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-sm font-semibold text-white">{product.title}</p>
          <p className="text-xs text-white/45">{formatClp(product.priceClp)} por unidad</p>
        </div>

        {product.stock !== null && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/50">Cantidad</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, product.stock)}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock || 1, Number(e.target.value) || 1)))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-500/40"
            />
          </label>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-white/50">¿Cómo lo quieres recibir?</p>
          <div className="space-y-2">
            {methods.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setDelivery(method)}
                className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                  delivery === method ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                {method === "DIGITAL" ? <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  : method === "SHIPPING" ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />}
                <div>
                  <p className="text-sm font-medium text-white">{DELIVERY_LABEL[method]}</p>
                  <p className="text-[11px] text-white/45">{DELIVERY_HINT[method]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {delivery === "SHIPPING" && (
          <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">Región</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#12101f] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/40"
              >
                {config.shippingRates.map((rate) => (
                  <option key={rate.id} value={rate.region}>
                    {rate.region} — {formatClp(rate.priceClp)}{rate.etaText ? ` (${rate.etaText})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Nombre de quien recibe" value={shipName} onChange={setShipName} />
            <Field label="Teléfono de contacto" value={shipPhone} onChange={setShipPhone} />
            <Field label="Dirección" value={shipAddress} onChange={setShipAddress} />
            <Field label="Comuna / ciudad" value={shipCity} onChange={setShipCity} />
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/50">Nota para la vendedora (opcional)</span>
          <textarea
            value={shipNotes}
            onChange={(e) => setShipNotes(e.target.value)}
            rows={2}
            placeholder={delivery === "MEET" ? "Cuéntale cuándo y dónde te acomoda la entrega" : "Algo que deba saber"}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-medium text-white/50">Forma de pago</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!config.gatewayEnabled}
              onClick={() => setPaymentMethod("FLOW")}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition disabled:opacity-30 ${
                paymentMethod === "FLOW" ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-white" : "border-white/10 bg-white/[0.02] text-white/60"
              }`}
            >
              <CreditCard className="h-4 w-4" /> Pasarela
            </button>
            <button
              type="button"
              disabled={!config.transferEnabled}
              onClick={() => setPaymentMethod("TRANSFER")}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition disabled:opacity-30 ${
                paymentMethod === "TRANSFER" ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-white" : "border-white/10 bg-white/[0.02] text-white/60"
              }`}
            >
              <Building2 className="h-4 w-4" /> Transferencia
            </button>
          </div>
        </div>

        <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <Row label="Artículo" value={formatClp(itemTotal)} />
          {delivery === "SHIPPING" && <Row label="Envío" value={formatClp(shippingClp)} />}
          <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-semibold text-white">Total</span>
            <span className="text-lg font-bold text-fuchsia-300">{formatClp(total)}</span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-white/40">
          Al comprar aceptas que el pago quede retenido hasta que confirmes la recepción o pasen {holdDays} días.
        </p>

        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy || (delivery === "SHIPPING" && (!region || !shipName || !shipPhone || !shipAddress))}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Generando pedido..." : paymentMethod === "FLOW" ? "Ir a pagar" : "Generar pedido"}
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b0a16] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/40"
      />
    </label>
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
