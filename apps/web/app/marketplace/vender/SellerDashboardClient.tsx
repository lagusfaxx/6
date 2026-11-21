"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, BarChart3, CheckCircle2, Clock,
  Image as ImageIcon, ImagePlus, Lock, Package, PackageOpen, Plus, Send, Settings, ShieldCheck,
  Store, Trash2, TrendingUp, Video, Wallet, X, Zap,
} from "lucide-react";

import useMe from "../../../hooks/useMe";
import { MediaThumb, StatRow } from "../../../components/marketplace/ui";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";
import {
  packFileKind, packFileProblem, summarizeFiles, uploadPackFiles, type UploadResult,
} from "../../../lib/marketUpload";
import {
  ORDER_STATUS_UI, formatClp, formatDate, productCoverMedia,
  type MarketOrder, type MarketProduct,
} from "../../../lib/marketplace";

type Seller = {
  id: string;
  storeName: string | null;
  tagline: string | null;
  bio: string | null;
  region: string | null;
  isActive: boolean;
  isBanned: boolean;
  acceptsShipping: boolean;
  acceptsMeet: boolean;
  autoDeliverDigital: boolean;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankHolderName: string | null;
  bankHolderRut: string | null;
  bankEmail: string | null;
  totalSales: number;
  totalEarnedClp: number;
};

type SellerState = {
  seller: Seller | null;
  canSell: boolean;
  profileType: string | null;
  commissionPercent: number;
  holdDays: number;
  minPriceClp: number;
  maxPriceClp: number;
  /* Primeras ventas sin comisión: sólo se descuenta el IVA. */
  freeSalesCount: number;
  freeSalesLeft: number;
  ivaPercent: number;
  ivaShareOfPrice: number;
  bankComplete: boolean;
};

type Earnings = {
  balance: { heldClp: number; releasedClp: number; withdrawnClp: number; pendingWithdrawalClp: number; availableClp: number };
  commissionPercent: number;
  holdDays: number;
  ledger: Array<{ id: string; type: string; amountClp: number; description: string | null; createdAt: string; orderCode: string | null }>;
  withdrawals: Array<{ id: string; amountClp: number; status: string; createdAt: string; adminNote: string | null }>;
  counts: Record<string, number>;
};

type Tab = "resumen" | "productos" | "pedidos" | "ganancias" | "config";

const TABS: Array<{ key: Tab; label: string; icon: typeof Store }> = [
  { key: "resumen", label: "Resumen", icon: BarChart3 },
  { key: "productos", label: "Packs", icon: Package },
  { key: "pedidos", label: "Ventas", icon: PackageOpen },
  { key: "ganancias", label: "Ganancias", icon: Wallet },
  { key: "config", label: "Banco", icon: Settings },
];

export default function SellerDashboardClient() {
  const searchParams = useSearchParams();
  const { me, loading: meLoading } = useMe();

  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "resumen");
  const [state, setState] = useState<SellerState | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    const response = await apiFetch<SellerState>("/market/seller/me");
    setState(response);
    return response;
  }, []);

  /* Sólo la primera carga tapa la pantalla. Las recargas posteriores (después
     de subir un archivo, pausar, etc.) son silenciosas: si no, el panel se
     desmontaba y el formulario de un pack a medio subir perdía lo elegido. */
  const loadedOnce = useRef(false);
  const loadAll = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const current = await loadState();
      if (current.seller) {
        const [prod, ord, earn] = await Promise.all([
          apiFetch<{ products: MarketProduct[] }>("/market/seller/products"),
          apiFetch<{ orders: MarketOrder[] }>("/market/seller/orders"),
          apiFetch<Earnings>("/market/seller/earnings"),
        ]);
        setProducts(prod.products);
        setOrders(ord.orders);
        setEarnings(earn);
      }
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [loadState]);

  useEffect(() => { if (!meLoading) loadAll(); }, [loadAll, meLoading]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  if (meLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando tus packs...</div>;
  }

  if (!me?.user?.id) {
    return (
      <EmptyState
        title="Inicia sesión para vender tus packs"
        text="Entra con tu cuenta de creadora para subir packs de fotos y videos."
        action={<Link href="/login?next=/marketplace/vender" className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white">Iniciar sesión</Link>}
      />
    );
  }

  if (state && !state.seller) {
    return <Onboarding state={state} onDone={loadAll} />;
  }

  const seller = state!.seller!;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/cuenta" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Mi cuenta
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/[0.07] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(me.user.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-11 w-11 rounded-xl object-cover" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">Mis packs</h1>
            <p className="truncate text-sm text-white/45">Se venden en la sección Contenido</p>
          </div>
        </div>
        <Link
          href={`/marketplace/tienda/${me.user.username}`}
          className="rounded-lg px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        >
          Ver cómo me ven
        </Link>
      </header>

      {seller.isBanned && (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          Tus ventas de packs están suspendidas. Escríbenos para revisarlo.
        </p>
      )}

      <nav className="-mb-px mt-5 flex gap-4 overflow-x-auto border-b border-white/[0.07] sm:gap-5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 border-b-2 pb-2.5 text-sm transition ${
              tab === item.key
                ? "border-fuchsia-400 text-white"
                : "border-transparent text-white/45 hover:text-white/75"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      <div className="mt-5">
        {tab === "resumen" && <Overview seller={seller} earnings={earnings} products={products} orders={orders} state={state!} onGo={setTab} />}
        {tab === "productos" && (
          <ProductsTab
            products={products}
            state={state!}
            onGo={setTab}
            busy={busy}
            setBusy={setBusy}
            onError={setError}
            onNotice={flash}
            reload={loadAll}
          />
        )}
        {tab === "pedidos" && <OrdersTab orders={orders} ivaShare={state!.ivaShareOfPrice} busy={busy} setBusy={setBusy} onError={setError} onNotice={flash} reload={loadAll} />}
        {tab === "ganancias" && <EarningsTab earnings={earnings} seller={seller} onError={setError} onNotice={flash} reload={loadAll} />}
        {tab === "config" && <SettingsTab seller={seller} onError={setError} onNotice={flash} reload={loadAll} />}
      </div>
    </div>
  );
}

/* ══════════════════════ Alta de tienda ══════════════════════ */

function Onboarding({ state, onDone }: { state: SellerState; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.canSell) {
    return (
      <EmptyState
        title="Vender packs es para creadoras"
        text="Convierte tu cuenta en perfil profesional y podrás vender packs de fotos y videos en la sección Contenido."
        action={
          <Link href="/cuenta/convertir-profesional" className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white">
            Convertir mi cuenta
          </Link>
        }
      />
    );
  }

  /* Ya no hay "tienda" que nombrar: la vitrina es su perfil de creadora. */
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/market/seller/onboard", {
        method: "POST",
        body: JSON.stringify({ autoDeliverDigital: true, acceptsShipping: false, acceptsMeet: false }),
      });
      onDone();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-white">Gana más con tus packs</h1>
        <p className="mt-2 text-sm text-white/50">
          Los clientes que entran a UZEED buscando contenido ven tus packs en la sección Contenido y en el inicio.
          Subes tus fotos y videos una vez y se venden solos, aunque no estés conectada.
        </p>

        {state.freeSalesCount > 0 && (
          <FreeSalesNote count={state.freeSalesCount} left={state.freeSalesLeft} className="mt-4" />
        )}

        <ul className="mt-4 space-y-2 text-sm text-white/65">
          <Bullet icon={Zap}>Entrega automática: apenas se confirma el pago, el cliente recibe tus fotos y videos.</Bullet>
          <Bullet icon={ShieldCheck}>El contenido se ve protegido: sin descargas y con marca de agua del comprador.</Bullet>
          <Bullet icon={TrendingUp}>Cada pack nuevo te vuelve a mostrar en Contenido: las que suben seguido venden más.</Bullet>
          <Bullet icon={Wallet}>
            Después recibes {100 - state.commissionPercent}% de cada venta. El pago se libera a los {state.holdDays} días y te lo transferimos a tu cuenta.
          </Bullet>
        </ul>

        <p className="mt-4 text-xs text-white/40">
          Para publicar vas a necesitar tu cuenta bancaria (ahí te transferimos) y, en cada pack, al menos 1 foto y 1 video.
        </p>

        {error && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Un momento..." : "Empezar a vender packs"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════ Resumen ══════════════════════ */

function Overview({
  seller, earnings, products, orders, state, onGo,
}: {
  seller: Seller;
  earnings: Earnings | null;
  products: MarketProduct[];
  orders: MarketOrder[];
  state: SellerState;
  onGo: (tab: Tab) => void;
}) {
  const pending = orders.filter((o) => ["PAID", "PREPARING"].includes(o.status));
  const bankMissing = !state.bankComplete;
  const forSale = products.filter((p) => p.publishStatus === "published").length;

  return (
    <div className="space-y-4">
      {/* Lo que la anima a subir más: dónde se ven sus packs y la promoción. */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.10] to-violet-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-300" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {forSale > 0 ? "Más packs, más ventas" : "Sube tu primer pack y empieza a ganar"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              Tus packs aparecen en la sección Contenido y en el inicio, frente a clientes que entran a comprar. Cada
              pack nuevo te vuelve a mostrar: las que suben seguido venden más.
            </p>
            {state.freeSalesCount > 0 && <FreeSalesNote count={state.freeSalesCount} left={state.freeSalesLeft} className="mt-3" />}
            <button
              type="button"
              onClick={() => onGo("productos")}
              className="mt-3 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2 text-xs font-bold text-white"
            >
              Subir un pack
            </button>
          </div>
        </div>
      </div>

      <StatRow
        items={[
          { label: "Disponible", value: formatClp(earnings?.balance.availableClp), accent: "positive" },
          { label: "Retenido", value: formatClp(earnings?.balance.heldClp), hint: `se libera a los ${state.holdDays} días` },
          { label: "Ventas", value: String(seller.totalSales) },
        ]}
      />

      {bankMissing && (
        <button
          type="button"
          onClick={() => onGo("productos")}
          className="flex w-full items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-left"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">Falta tu cuenta bancaria</p>
            <p className="text-xs text-amber-100/60">La pides una sola vez, al subir tu primer pack: ahí te transferimos lo que vendas.</p>
          </div>
        </button>
      )}

      {pending.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">Ventas por entregar</h2>
            <button type="button" onClick={() => onGo("pedidos")} className="text-xs text-fuchsia-300">Ver todos</button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {pending.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{order.productTitle}</p>
                  <p className="text-[11px] text-white/40">{order.code} · {formatDate(order.createdAt)}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-300">{formatClp(order.sellerNetClp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-white/[0.07] pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">Tus packs</h2>
          <button type="button" onClick={() => onGo("productos")} className="text-xs text-fuchsia-300">Administrar</button>
        </div>
        <p className="mt-1 text-xs text-white/45">
          {products.length === 0
            ? "Aún no subes nada. Sube tu primer pack y empieza a vender."
            : `${products.length} pack${products.length === 1 ? "" : "s"} · ${forSale} a la venta`}
        </p>
      </div>

      <p className="border-t border-white/[0.07] pt-5 text-xs leading-relaxed text-white/35">
        {state.freeSalesCount > 0 && `Tus primeras ${state.freeSalesCount} ventas no pagan comisión: sólo se descuenta el IVA (${state.ivaPercent}%). `}
        Después, UZEED cobra {state.commissionPercent}% de comisión por venta. El dinero queda retenido{" "}
        {state.holdDays} días; cuando se libera lo pides a retiro y lo transferimos a tu cuenta.
      </p>
    </div>
  );
}

/* ══════════════════════ Packs ══════════════════════ */

type AssetRow = { id: string; type: string; sizeBytes: number };
type Progress = { done: number; total: number; fraction: number; current: string } | null;

function formatMb(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

/* Precios sugeridos dentro del rango que permite el marketplace. */
function priceSuggestions(min: number, max: number) {
  return [5000, 10000, 15000, 20000, 30000].filter((p) => p >= min && p <= max).slice(0, 4);
}

function ProductsTab({
  products, state, busy, setBusy, onError, onNotice, reload,
}: {
  products: MarketProduct[];
  state: SellerState;
  onGo: (tab: Tab) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const [creating, setCreating] = useState(products.length === 0);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Subir un pack nuevo
        </button>
      )}

      {creating && (
        <NewPackForm
          state={state}
          onCancel={products.length > 0 ? () => setCreating(false) : undefined}
          onDone={async (message) => {
            setCreating(false);
            await reload();
            onNotice(message);
          }}
          onError={onError}
          reload={reload}
        />
      )}

      {products.length > 0 && <h2 className="pt-3 text-sm font-semibold text-white/70">Tus packs</h2>}

      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          expanded={expanded === product.id}
          onToggle={() => setExpanded(expanded === product.id ? null : product.id)}
          busy={busy}
          setBusy={setBusy}
          onError={onError}
          onNotice={onNotice}
          reload={reload}
        />
      ))}
    </div>
  );
}

/** Selector de archivos con vista previa y botón para quitar cada uno. */
function FilePicker({
  files, onChange, disabled, label, hint, accentClass,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  accentClass?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => (packFileKind(f) === "image" && !/\.(heic|heif)$/i.test(f.name) ? URL.createObjectURL(f) : ""));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    // Sin duplicados si eligen el mismo archivo dos veces.
    const key = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
    const seen = new Set(files.map(key));
    onChange([...files, ...incoming.filter((f) => !seen.has(key(f)))]);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v"
        multiple
        hidden
        onChange={(e) => { add(e.target.files); e.target.value = ""; }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition disabled:opacity-40 ${
          accentClass || "border-fuchsia-400/40 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.1]"
        }`}
      >
        <ImagePlus className="h-7 w-7 text-fuchsia-200" />
        <span className="text-sm font-semibold text-white">{label}</span>
        {hint && <span className="text-[11px] text-white/45">{hint}</span>}
      </button>

      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {files.map((file, index) => {
            const kind = packFileKind(file);
            const problem = packFileProblem(file);
            return (
              <div key={`${file.name}-${index}`} className={`relative aspect-square overflow-hidden rounded-xl border bg-black/40 ${problem ? "border-rose-500/60" : "border-white/10"}`}>
                {previews[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[index]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center">
                    {kind === "video" ? <Video className="h-5 w-5 text-white/50" /> : <ImageIcon className="h-5 w-5 text-white/50" />}
                    <span className="line-clamp-2 break-all text-[9px] text-white/40">{file.name}</span>
                  </div>
                )}
                {kind === "video" && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white">Video</span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    aria-label="Quitar"
                    onClick={() => onChange(files.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {files.map(packFileProblem).filter(Boolean).map((p) => (
        <p key={p} className="mt-1 text-[11px] text-rose-300">{p}</p>
      ))}
    </div>
  );
}

function ProgressBar({ progress, label }: { progress: NonNullable<Progress>; label: string }) {
  return (
    <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.07] p-3">
      <div className="flex items-center justify-between text-xs text-white/75">
        <span>{label} {Math.min(progress.done + 1, progress.total)} de {progress.total}</span>
        <span>{Math.round(progress.fraction * 100)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-white/45">No cierres esta página hasta que termine.</p>
    </div>
  );
}

/**
 * Alta de un pack en un solo paso: elige sus fotos y videos, pone precio y
 * listo. El título se completa solo si lo deja vacío, el tipo se deduce de lo
 * que sube y la portada pública se arma sola (difuminada) si no elige una.
 * Si le falta la cuenta bancaria la llena aquí mismo, sin cambiar de pestaña.
 */
function NewPackForm({
  state, onCancel, onDone, onError, reload,
}: {
  state: SellerState;
  onCancel?: () => void;
  onDone: (message: string) => void | Promise<void>;
  onError: (v: string | null) => void;
  reload: () => Promise<void> | void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [showCover, setShowCover] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceClp, setPriceClp] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [stepLabel, setStepLabel] = useState("Subiendo");
  const [localError, setLocalError] = useState<string | null>(null);
  /* Si la subida se corta, el pack ya existe: al reintentar se reutiliza en
     vez de crear un duplicado vacío. */
  const [createdId, setCreatedId] = useState<string | null>(null);
  /* Lo que ya quedó arriba en intentos anteriores cuenta para el mínimo. */
  const [uploaded, setUploaded] = useState({ images: 0, videos: 0 });

  const [bank, setBank] = useState({ bankName: "", bankAccountType: "", bankAccountNumber: "", bankHolderName: "", bankHolderRut: "", bankEmail: "" });
  const needsBank = !state.bankComplete;

  const pending = summarizeFiles(files);
  const images = pending.images + uploaded.images;
  const videos = pending.videos + uploaded.videos;
  const hasProblems = files.some((f) => packFileProblem(f)) || coverFiles.some((f) => packFileProblem(f));
  const price = Number(String(priceClp).replace(/\D/g, "")) || 0;
  const priceOk = price >= state.minPriceClp && price <= state.maxPriceClp;
  const bankOk = !needsBank || Boolean(bank.bankName.trim() && bank.bankAccountNumber.trim() && bank.bankHolderName.trim() && bank.bankHolderRut.trim());
  const contentOk = images >= 1 && videos >= 1;

  const missing: string[] = [];
  if (images < 1) missing.push("al menos 1 foto");
  if (videos < 1) missing.push("al menos 1 video");
  if (!priceOk) missing.push(`un precio entre ${formatClp(state.minPriceClp)} y ${formatClp(state.maxPriceClp)}`);
  if (!bankOk) missing.push("tu cuenta bancaria (banco, n° de cuenta, titular y RUT)");

  const autoTitle = () => {
    const parts = [];
    if (images) parts.push(`${images} foto${images === 1 ? "" : "s"}`);
    if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
    return `Pack ${parts.join(" + ")}`;
  };

  const fail = (message: string) => {
    setLocalError(message);
    onError(null);
  };

  const submit = async () => {
    if (missing.length || hasProblems) return;
    setBusy(true);
    setLocalError(null);
    onError(null);
    try {
      if (needsBank) {
        setStepLabel("Guardando tu cuenta");
        await apiFetch("/market/seller/bank", { method: "PUT", body: JSON.stringify(bank) });
      }

      let productId = createdId;
      if (!productId) {
        const created = await apiFetch<{ product: { id: string } }>("/market/seller/products", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim() || autoTitle(),
            description,
            priceClp: price,
            type: videos > images ? "VIDEO" : "PHOTO_SET",
            deliveryMethods: ["DIGITAL"],
            autoDeliver: true,
            stock: null,
          }),
        });
        productId = created.product.id;
        setCreatedId(productId);
      }

      setStepLabel("Subiendo archivo");
      const results = await uploadPackFiles(productId, "assets", files, setProgress);
      let coverResults: UploadResult[] = [];
      if (coverFiles.length) {
        setStepLabel("Subiendo portada");
        coverResults = await uploadPackFiles(productId, "media", coverFiles, setProgress);
      }
      setProgress(null);

      const failed = results.filter((r): r is Extract<UploadResult, { ok: false }> => !r.ok);
      const failedCover = coverResults.filter((r): r is Extract<UploadResult, { ok: false }> => !r.ok);
      const okNow = summarizeFiles(results.filter((r) => r.ok).map((r) => r.file));
      setUploaded((prev) => ({ images: prev.images + okNow.images, videos: prev.videos + okNow.videos }));
      if (failed.length || failedCover.length) {
        // Se dejan sólo los que fallaron, para reintentar con un toque.
        setFiles(failed.map((r) => r.file));
        setCoverFiles(failedCover.map((r) => r.file));
        await reload();
        const okCount = results.length - failed.length;
        fail(
          `${okCount ? `Se subieron ${okCount} archivo${okCount === 1 ? "" : "s"}. ` : ""}` +
          `No se pudieron subir ${failed.length + failedCover.length}: ${[...failed, ...failedCover][0].error} ` +
          "Toca \"Reintentar\" o quita esos archivos.",
        );
        return;
      }

      await onDone("¡Listo! Tu pack se está procesando y sale a la venta en breve.");
    } catch (err: any) {
      setProgress(null);
      fail(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const suggestions = priceSuggestions(state.minPriceClp, state.maxPriceClp);
  const retrying = Boolean(createdId);

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <h2 className="text-base font-semibold text-white">{retrying ? "Terminar de subir tu pack" : "Nuevo pack"}</h2>
        <p className="mt-0.5 text-xs text-white/45">3 pasos: tus fotos y videos, el precio y listo.</p>
      </div>

      {/* 1. Contenido */}
      <section>
        <StepTitle n={1} text="Elige las fotos y videos del pack" />
        <FilePicker
          files={files}
          onChange={setFiles}
          disabled={busy}
          label={files.length ? "Agregar más" : "Elegir de mi galería"}
          hint="Al menos 1 foto y 1 video · puedes elegir varios a la vez"
        />
        {files.length > 0 && (
          <p className={`mt-2 text-xs ${contentOk ? "text-emerald-300" : "text-amber-300"}`}>
            {images} foto{images === 1 ? "" : "s"} · {videos} video{videos === 1 ? "" : "s"}
            {!contentOk && ` · falta ${images < 1 ? "1 foto" : "1 video"}`}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-white/40">
          Esto lo recibe sólo quien paga, dentro de UZEED y sin poder descargarlo.
        </p>
      </section>

      {/* 2. Precio */}
      <section>
        <StepTitle n={2} text="¿Cuánto cobras?" />
        <div className="flex flex-wrap gap-2">
          {suggestions.map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy || retrying}
              onClick={() => setPriceClp(String(value))}
              className={`rounded-full border px-3.5 py-2 text-sm transition ${
                price === value ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-white" : "border-white/10 bg-white/[0.03] text-white/65"
              }`}
            >
              {formatClp(value)}
            </button>
          ))}
        </div>
        <input
          inputMode="numeric"
          value={priceClp}
          disabled={busy || retrying}
          onChange={(e) => setPriceClp(e.target.value.replace(/\D/g, ""))}
          placeholder="Otro monto"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
        />
        {priceClp && !priceOk && (
          <p className="mt-1 text-[11px] text-amber-300">Entre {formatClp(state.minPriceClp)} y {formatClp(state.maxPriceClp)}.</p>
        )}
      </section>

      {/* 3. Detalles opcionales */}
      <section className="space-y-3">
        <StepTitle n={3} text="Ponle nombre (opcional)" />
        <input
          value={title}
          disabled={busy || retrying}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={files.length ? autoTitle() : "Ej: Pack lencería roja"}
          maxLength={120}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
        />
        <textarea
          rows={2}
          value={description}
          disabled={busy || retrying}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional): qué incluye, duración de los videos..."
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-fuchsia-500/40"
        />

        {!showCover && coverFiles.length === 0 ? (
          <button type="button" disabled={busy} onClick={() => setShowCover(true)} className="text-xs text-fuchsia-300">
            + Elegir foto de portada (opcional)
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-white/50">
              Portada: lo que ven todos antes de comprar. Si no eliges, armamos una difuminada con tu contenido.
            </p>
            <FilePicker
              files={coverFiles}
              onChange={setCoverFiles}
              disabled={busy}
              label="Elegir portada"
              accentClass="border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            />
          </div>
        )}
      </section>

      {needsBank && (
        <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <div>
            <p className="text-sm font-semibold text-amber-100">¿Dónde te depositamos?</p>
            <p className="text-[11px] text-amber-100/60">Sólo la primera vez. No se muestra a los clientes.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input label="Banco" value={bank.bankName} onChange={(v) => setBank({ ...bank, bankName: v })} placeholder="BancoEstado" />
            <Input label="Tipo de cuenta" value={bank.bankAccountType} onChange={(v) => setBank({ ...bank, bankAccountType: v })} placeholder="Cuenta RUT / Vista / Corriente" />
            <Input label="N° de cuenta" value={bank.bankAccountNumber} onChange={(v) => setBank({ ...bank, bankAccountNumber: v })} />
            <Input label="Titular" value={bank.bankHolderName} onChange={(v) => setBank({ ...bank, bankHolderName: v })} />
            <Input label="RUT" value={bank.bankHolderRut} onChange={(v) => setBank({ ...bank, bankHolderRut: v })} placeholder="12.345.678-9" />
            <Input label="Correo (opcional)" value={bank.bankEmail} onChange={(v) => setBank({ ...bank, bankEmail: v })} />
          </div>
        </section>
      )}

      {progress && <ProgressBar progress={progress} label={stepLabel} />}
      {localError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{localError}</p>}

      {missing.length > 0 && !busy && (
        <p className="text-[11px] text-white/45">Para publicar falta: {missing.join(", ")}.</p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-3.5 text-sm text-white/60 disabled:opacity-40">
            {retrying ? "Cerrar" : "Cancelar"}
          </button>
        )}
        <button
          type="button"
          disabled={busy || missing.length > 0 || hasProblems}
          onClick={submit}
          className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Subiendo..." : retrying ? (files.length || coverFiles.length ? "Reintentar" : "Terminar") : "Publicar pack"}
        </button>
      </div>
    </div>
  );
}

function StepTitle({ n, text }: { n: number; text: string }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500/25 text-[11px] text-fuchsia-100">{n}</span>
      {text}
    </p>
  );
}

function ProductRow({
  product, expanded, onToggle, busy, setBusy, onError, onNotice, reload,
}: {
  product: MarketProduct;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const assetRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      const response = await apiFetch<{ assets: AssetRow[] }>(`/market/seller/products/${product.id}/assets`);
      setAssets(response.assets);
    } catch {
      // Sin archivos cargados todavía.
    }
  }, [product.id]);

  useEffect(() => { if (expanded) loadAssets(); }, [expanded, loadAssets]);

  const upload = async (list: FileList | null, kind: "assets" | "media") => {
    if (!list?.length) return;
    setBusy(true);
    setRowError(null);
    onError(null);
    try {
      const results = await uploadPackFiles(product.id, kind, Array.from(list), setProgress);
      const failed = results.filter((r): r is Extract<UploadResult, { ok: false }> => !r.ok);
      const ok = results.length - failed.length;
      if (kind === "assets") await loadAssets();
      await reload();
      if (failed.length) {
        setRowError(`${ok ? `Se subieron ${ok}. ` : ""}No se pudieron subir ${failed.length}: ${failed[0].error}`);
      } else {
        onNotice(kind === "media" ? "Portada actualizada" : `${ok} archivo${ok === 1 ? "" : "s"} agregado${ok === 1 ? "" : "s"}`);
      }
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setRowError(null);
    try {
      await fn();
      await reload();
      if (message) onNotice(message);
    } catch (err: any) {
      setRowError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = () =>
    run(() => apiFetch(`/market/seller/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !product.isActive }) }));

  const remove = () => {
    if (!window.confirm("¿Eliminar este pack? Deja de venderse en Contenido.")) return;
    run(() => apiFetch(`/market/seller/products/${product.id}`, { method: "DELETE" }), "Pack eliminado");
  };

  const removeAsset = (asset: AssetRow) => {
    if (!window.confirm("¿Quitar este archivo del pack? Quienes ya compraron lo conservan.")) return;
    run(async () => {
      await apiFetch(`/market/seller/assets/${asset.id}`, { method: "DELETE" });
      await loadAssets();
    });
  };

  const removeMedia = (mediaId: string) =>
    run(() => apiFetch(`/market/seller/media/${mediaId}`, { method: "DELETE" }));

  const status = product.publishStatus ? PUBLISH_STATUS_UI[product.publishStatus] : null;
  const cover = productCoverMedia(product);
  const assetImages = assets.filter((a) => a.type === "IMAGE").length;
  const assetVideos = assets.filter((a) => a.type === "VIDEO").length;

  return (
    <div className="border-b border-white/[0.06]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 py-3 text-left">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
          <MediaThumb
            url={resolveMediaUrl(cover?.url)}
            thumbnailUrl={resolveMediaUrl(cover?.thumbnailUrl)}
            type={cover?.type}
            fallback={<div className="flex h-full items-center justify-center text-[10px] text-white/25">Sin foto</div>}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{product.title}</p>
          <p className="text-[11px] text-white/40">
            {formatClp(product.priceClp)} · {product.salesCount} vendidos
          </p>
          {status && <p className={`mt-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</p>}
        </div>
        <span className="shrink-0 text-xs text-fuchsia-300">{expanded ? "Cerrar" : "Editar"}</span>
      </button>

      {expanded && (
        <div className="space-y-4 pb-4">
          <input ref={assetRef} type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v" multiple hidden onChange={(e) => { upload(e.target.files, "assets"); e.target.value = ""; }} />
          <input ref={coverRef} type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v" multiple hidden onChange={(e) => { upload(e.target.files, "media"); e.target.value = ""; }} />

          {progress && <ProgressBar progress={progress} label="Subiendo" />}
          {rowError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{rowError}</p>}

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white/70">
                <Lock className="mr-1 inline h-3.5 w-3.5" />
                Contenido del pack · {assetImages} foto{assetImages === 1 ? "" : "s"}, {assetVideos} video{assetVideos === 1 ? "" : "s"}
              </p>
            </div>
            {assets.length > 0 && (
              <div className="mt-2 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07]">
                {assets.map((asset, i) => (
                  <div key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-white/70">
                      {asset.type === "VIDEO" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      {asset.type === "VIDEO" ? "Video" : "Foto"} {i + 1}
                      <span className="text-white/35">· {formatMb(asset.sizeBytes)}</span>
                    </span>
                    <button type="button" disabled={busy} onClick={() => removeAsset(asset)} aria-label="Quitar" className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => assetRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-sm font-semibold text-emerald-200 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Agregar fotos o videos
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/70">Portada pública ({product.media.length})</p>
            <p className="text-[11px] text-white/40">Lo que ven todos antes de comprar. Usa tus mejores fotos.</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {product.media.map((item) => (
                <div key={item.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <MediaThumb url={resolveMediaUrl(item.url)} thumbnailUrl={resolveMediaUrl(item.thumbnailUrl)} type={item.type} />
                  {item.type === "VIDEO" && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white">Video</span>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Quitar"
                    onClick={() => removeMedia(item.id)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => coverRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 text-white/50 disabled:opacity-40"
                aria-label="Agregar portada"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={toggleActive} className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70 disabled:opacity-40">
              {product.isActive ? "Pausar" : "Activar"}
            </button>
            <Link href={`/marketplace/producto/${product.id}`} className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-semibold text-white/70">
              Ver pack
            </Link>
            <button type="button" disabled={busy} onClick={remove} aria-label="Eliminar pack" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-rose-200 disabled:opacity-40">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════ Pedidos ══════════════════════ */

function OrdersTab({
  orders, ivaShare, busy, setBusy, onError, onNotice, reload,
}: {
  ivaShare: number;
  orders: MarketOrder[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const act = async (orderId: string, action: string, body?: any) => {
    setBusy(true);
    onError(null);
    try {
      await apiFetch(`/market/seller/orders/${orderId}/${action}`, { method: "POST", body: JSON.stringify(body || {}) });
      await reload();
      onNotice("Venta actualizada");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (orders.length === 0) {
    return <p className="py-14 text-center text-sm text-white/45">Todavía no vendes packs. Cuando alguien compre, aparece aquí.</p>;
  }

  return (
    <div>
      {orders.map((order) => {
        const status = ORDER_STATUS_UI[order.status];
        return (
          <div key={order.id} className="border-b border-white/[0.06] py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{order.productTitle}</p>
                <p className="text-[11px] text-white/40">{order.code} · {formatDate(order.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
            </div>

            <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
              <Detail label="Recibes" value={formatClp(order.sellerNetClp)} strong />
              <Detail
                label={order.commissionPercent === ivaShare ? "IVA (venta sin comisión)" : "Comisión UZEED"}
                value={formatClp(order.commissionClp)}
              />
              <Detail label="Comprador" value={order.buyer?.displayName || order.buyer?.username || "—"} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {["PAID", "PREPARING"].includes(order.status) && order.deliveryMethod === "DIGITAL" && order.assetCount === 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(order.id, "send-assets")}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  <Send className="h-3.5 w-3.5" /> Enviar contenido
                </button>
              )}
              {["PAID", "PREPARING"].includes(order.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(order.id, "deliver")}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-2 text-xs font-bold text-white"
                >
                  Marcar entregado
                </button>
              )}
              <Link href={`/marketplace/vender/pedidos/${order.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/60">
                Abrir chat
              </Link>
            </div>

            {order.status === "DISPUTED" && (
              <p className="mt-2 rounded-lg border border-orange-500/25 bg-orange-500/[0.07] p-2.5 text-[11px] text-orange-100/80">
                El cliente abrió un reclamo{order.disputeReason ? `: ${order.disputeReason}` : ""}. El pago queda retenido
                hasta que lo resolvamos; responde por el chat de la venta.
              </p>
            )}
            {order.status === "DELIVERED" && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock className="h-3 w-3" /> Entregado. Tu pago se libera cuando el cliente confirma o al cumplirse el plazo.
              </p>
            )}
            {order.status === "COMPLETED" && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Pago liberado.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════ Ganancias ══════════════════════ */

function EarningsTab({
  earnings, seller, onError, onNotice, reload,
}: {
  earnings: Earnings | null;
  seller: Seller;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!earnings) return <div className="text-sm text-white/50">Sin datos todavía.</div>;

  const requestWithdrawal = async () => {
    setBusy(true);
    onError(null);
    try {
      await apiFetch("/market/seller/withdrawals", { method: "POST", body: JSON.stringify({ amountClp: Number(amount) || 0 }) });
      setAmount("");
      await reload();
      onNotice("Retiro solicitado. Lo revisamos y te transferimos.");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const bankReady = Boolean(seller.bankName && seller.bankAccountNumber && seller.bankHolderName);

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: "Disponible para retirar", value: formatClp(earnings.balance.availableClp), accent: "positive" },
          { label: `Retenido (${earnings.holdDays} días)`, value: formatClp(earnings.balance.heldClp) },
          { label: "Total liberado", value: formatClp(earnings.balance.releasedClp) },
          { label: "Ya retirado", value: formatClp(earnings.balance.withdrawnClp), accent: "muted" },
        ]}
      />

      <div>
        <h2 className="text-sm font-semibold text-white/70">Solicitar retiro</h2>
        {!bankReady ? (
          <p className="mt-2 text-xs text-amber-200">Carga tu cuenta bancaria en "Banco" para poder retirar.</p>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(earnings.balance.availableClp)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/40"
              />
              <button
                type="button"
                disabled={busy || !amount}
                onClick={requestWithdrawal}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                Retirar
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              Transferimos a {seller.bankName} · {seller.bankAccountNumber}
            </p>
          </>
        )}

        {earnings.withdrawals.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {earnings.withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="flex items-center justify-between border-t border-white/[0.06] py-2 text-xs">
                <span className="text-white/60">{formatDate(withdrawal.createdAt)}</span>
                <span className="text-white">{formatClp(withdrawal.amountClp)}</span>
                <span className="text-white/45">{withdrawal.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <h2 className="text-sm font-semibold text-white/70">Movimientos</h2>
        <div className="mt-1 divide-y divide-white/[0.06]">
          {earnings.ledger.length === 0 ? (
            <p className="text-xs text-white/40">Todavía no hay movimientos.</p>
          ) : (
            earnings.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs text-white">{entry.description || entry.type}</p>
                  <p className="text-[10px] text-white/35">{formatDate(entry.createdAt)}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${entry.amountClp < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                  {entry.amountClp < 0 ? "-" : "+"}{formatClp(Math.abs(entry.amountClp))}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ Configuración ══════════════════════ */

function SettingsTab({
  seller, onError, onNotice, reload,
}: {
  seller: Seller;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const [tagline, setTagline] = useState(seller.tagline || "");
  const [bio, setBio] = useState(seller.bio || "");

  const [bankName, setBankName] = useState(seller.bankName || "");
  const [bankAccountType, setBankAccountType] = useState(seller.bankAccountType || "");
  const [bankAccountNumber, setBankAccountNumber] = useState(seller.bankAccountNumber || "");
  const [bankHolderName, setBankHolderName] = useState(seller.bankHolderName || "");
  const [bankHolderRut, setBankHolderRut] = useState(seller.bankHolderRut || "");
  const [bankEmail, setBankEmail] = useState(seller.bankEmail || "");
  const [busy, setBusy] = useState(false);

  const saveStore = async () => {
    setBusy(true);
    onError(null);
    try {
      await apiFetch("/market/seller/onboard", {
        method: "POST",
        body: JSON.stringify({
          storeName: seller.storeName,
          tagline,
          bio,
          autoDeliverDigital: true,
          acceptsShipping: false,
          acceptsMeet: false,
        }),
      });
      await reload();
      onNotice("Presentación guardada");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveBank = async () => {
    setBusy(true);
    onError(null);
    try {
      await apiFetch("/market/seller/bank", {
        method: "PUT",
        body: JSON.stringify({ bankName, bankAccountType, bankAccountNumber, bankHolderName, bankHolderRut, bankEmail }),
      });
      await reload();
      onNotice("Datos bancarios guardados");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70">Dónde te transferimos</h2>
        <p className="text-xs text-white/45">Ahí te transferimos lo que vendas. Banco, número de cuenta, titular y RUT son obligatorios para publicar packs. No se muestran a los clientes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Banco" value={bankName} onChange={setBankName} />
          <Input label="Tipo de cuenta" value={bankAccountType} onChange={setBankAccountType} />
          <Input label="N° de cuenta" value={bankAccountNumber} onChange={setBankAccountNumber} />
          <Input label="Titular" value={bankHolderName} onChange={setBankHolderName} />
          <Input label="RUT" value={bankHolderRut} onChange={setBankHolderRut} />
          <Input label="Correo" value={bankEmail} onChange={setBankEmail} />
        </div>
        <button type="button" disabled={busy} onClick={saveBank} className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200 disabled:opacity-40">
          Guardar datos bancarios
        </button>
      </div>
      <div className="space-y-3 border-t border-white/[0.07] pt-6">
        <h2 className="text-sm font-semibold text-white/70">Tu presentación</h2>
        <p className="text-xs text-white/45">Sale junto a tus packs. Opcional.</p>
        <Input label="Frase corta" value={tagline} onChange={setTagline} placeholder="Fotos y videos exclusivos" />
        <TextArea label="Descripción" value={bio} onChange={setBio} rows={3} placeholder="Cuéntales qué encuentran en tus packs" />
        <button type="button" disabled={busy} onClick={saveStore} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-40">
          Guardar presentación
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════ UI compartida ══════════════════════ */

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Wallet; label: string; value: string; accent: string }) {
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

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/45">{label}</span>
      <span className={strong ? "font-bold text-emerald-300" : "text-white/80"}>{value}</span>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-fuchsia-500/40"
      />
    </label>
  );
}

function TextArea({
  label, value, onChange, rows = 3, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-fuchsia-500/40"
      />
    </label>
  );
}

function Bullet({ icon: Icon, children }: { icon: typeof Zap; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
      <span>{children}</span>
    </li>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Store className="mx-auto mb-3 h-9 w-9 text-white/25" />
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-white/55">{text}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

/* Estados del pack para la vendedora. "Procesando" cubre la revisión. */
const PUBLISH_STATUS_UI: Record<NonNullable<MarketProduct["publishStatus"]>, { label: string; className: string }> = {
  incomplete: { label: "Falta subir al menos 1 foto y 1 video", className: "text-amber-300" },
  processing: { label: "Procesando · se publica en breve", className: "text-sky-300" },
  published: { label: "A la venta", className: "text-emerald-300" },
  not_published: { label: "No se pudo publicar · escríbenos si tienes dudas", className: "text-rose-300" },
  paused: { label: "Pausado", className: "text-white/45" },
};

function FreeSalesNote({ count, left, className = "" }: { count: number; left: number; className?: string }) {
  return (
    <p className={`rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-100 ${className}`}>
      {left > 0 ? (
        <>
          <strong>Tus primeras {count} ventas sin comisión</strong> (sólo IVA).{" "}
          {left < count ? `Te quedan ${left}.` : "Empieza a vender y aprovéchalas."}
        </>
      ) : (
        <>Ya usaste tus {count} ventas sin comisión.</>
      )}
    </p>
  );
}
