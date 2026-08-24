"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, Banknote, BarChart3, Building2, CheckCircle2, Clock,
  ImagePlus, Lock, Package, PackageOpen, Plus, Send, Settings, ShieldCheck,
  Store, Trash2, TrendingUp, Truck, Wallet, Zap,
} from "lucide-react";

import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../lib/api";
import {
  DELIVERY_LABEL, ORDER_STATUS_UI, PRODUCT_TYPE_LABEL, formatClp, formatDate,
  type MarketDeliveryMethod, type MarketOrder, type MarketProduct, type MarketProductType,
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
  { key: "productos", label: "Artículos", icon: Package },
  { key: "pedidos", label: "Pedidos", icon: PackageOpen },
  { key: "ganancias", label: "Ganancias", icon: Wallet },
  { key: "config", label: "Mi tienda", icon: Settings },
];

const TYPES: MarketProductType[] = ["PHOTO_SET", "VIDEO", "CLOTHING", "FETISH", "CUSTOM", "OTHER"];
const DIGITAL_TYPES: MarketProductType[] = ["PHOTO_SET", "VIDEO"];

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

  const loadAll = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [loadState]);

  useEffect(() => { if (!meLoading) loadAll(); }, [loadAll, meLoading]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  if (meLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando tu tienda...</div>;
  }

  if (!me?.user?.id) {
    return (
      <EmptyState
        title="Inicia sesión para vender"
        text="Necesitas tu cuenta profesional para publicar artículos en el marketplace."
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
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/15 via-violet-600/10 to-transparent p-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(me.user.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-12 w-12 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-white">{seller.storeName || me.user.displayName || me.user.username}</h1>
            <p className="truncate text-xs text-white/45">{seller.tagline || "Tu tienda en el marketplace de UZEED"}</p>
          </div>
          <Link
            href={`/marketplace/tienda/${me.user.username}`}
            className="hidden shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white sm:block"
          >
            Ver mi vitrina
          </Link>
        </div>

        {seller.isBanned && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            Tu tienda está suspendida. Escríbenos para revisarlo.
          </p>
        )}
      </header>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === item.key ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" /> {item.label}
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
            busy={busy}
            setBusy={setBusy}
            onError={setError}
            onNotice={flash}
            reload={loadAll}
          />
        )}
        {tab === "pedidos" && <OrdersTab orders={orders} busy={busy} setBusy={setBusy} onError={setError} onNotice={flash} reload={loadAll} />}
        {tab === "ganancias" && <EarningsTab earnings={earnings} seller={seller} onError={setError} onNotice={flash} reload={loadAll} />}
        {tab === "config" && <SettingsTab seller={seller} onError={setError} onNotice={flash} reload={loadAll} />}
      </div>
    </div>
  );
}

/* ══════════════════════ Alta de tienda ══════════════════════ */

function Onboarding({ state, onDone }: { state: SellerState; onDone: () => void }) {
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.canSell) {
    return (
      <EmptyState
        title="El marketplace es para perfiles profesionales"
        text="Convierte tu cuenta en perfil profesional y podrás vender packs, videos y artículos personales con pago protegido."
        action={
          <Link href="/cuenta/convertir-profesional" className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white">
            Convertir mi cuenta
          </Link>
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/market/seller/onboard", {
        method: "POST",
        body: JSON.stringify({ storeName, tagline, bio }),
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
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/15 to-transparent p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200">
          <Store className="h-3.5 w-3.5" /> Abrir mi tienda
        </span>
        <h1 className="mt-3 text-2xl font-bold text-white">Vende lo tuyo, cobra seguro</h1>
        <p className="mt-2 text-sm text-white/60">
          Publica packs de fotos, videos, ropa o lo que quieras ofrecer. Tus clientes pagan dentro de UZEED y el contenido
          digital se entrega solo, al instante.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-white/65">
          <Bullet icon={Zap}>Entrega automática de fotos y videos apenas se confirma el pago.</Bullet>
          <Bullet icon={ShieldCheck}>El contenido se ve protegido: sin descargas y con marca de agua del comprador.</Bullet>
          <Bullet icon={Truck}>Envíos con tarifa por región o entrega acordada por chat.</Bullet>
          <Bullet icon={Wallet}>
            Recibes {100 - state.commissionPercent}% de cada venta; el pago se libera al confirmar la entrega o a los {state.holdDays} días.
          </Bullet>
        </ul>

        <div className="mt-5 space-y-3">
          <Input label="Nombre de tu tienda" value={storeName} onChange={setStoreName} placeholder="Ej: El clóset de Sofía" />
          <Input label="Frase corta" value={tagline} onChange={setTagline} placeholder="Packs exclusivos y envíos discretos" />
          <TextArea label="Descripción" value={bio} onChange={setBio} rows={3} placeholder="Cuéntale a tus clientes qué vendes" />
        </div>

        {error && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Abriendo..." : "Abrir mi tienda"}
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
  const bankMissing = !seller.bankName || !seller.bankAccountNumber;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Disponible" value={formatClp(earnings?.balance.availableClp)} accent="emerald" />
        <StatCard icon={Clock} label="Retenido" value={formatClp(earnings?.balance.heldClp)} accent="amber" />
        <StatCard icon={TrendingUp} label="Ventas" value={String(seller.totalSales)} accent="fuchsia" />
      </div>

      {bankMissing && (
        <button
          type="button"
          onClick={() => onGo("config")}
          className="flex w-full items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-left"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">Carga tus datos bancarios</p>
            <p className="text-xs text-amber-100/60">Sin ellos no podemos transferirte lo que ganes.</p>
          </div>
        </button>
      )}

      {pending.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Pedidos por atender</h2>
            <button type="button" onClick={() => onGo("pedidos")} className="text-xs font-semibold text-fuchsia-300">Ver todos</button>
          </div>
          <div className="mt-3 space-y-2">
            {pending.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{order.productTitle}</p>
                  <p className="text-[11px] text-white/40">{order.code} · {DELIVERY_LABEL[order.deliveryMethod]}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-300">{formatClp(order.sellerNetClp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Tus artículos</h2>
          <button type="button" onClick={() => onGo("productos")} className="text-xs font-semibold text-fuchsia-300">Administrar</button>
        </div>
        <p className="mt-1 text-xs text-white/45">
          {products.length === 0
            ? "Aún no publicas nada. Sube tu primer pack y empieza a vender."
            : `${products.length} publicado${products.length === 1 ? "" : "s"} · ${products.filter((p) => p.isActive).length} activo${products.filter((p) => p.isActive).length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-bold text-white">Cómo cobras</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-white/55">
          <li>• UZEED cobra {state.commissionPercent}% de comisión por venta; el envío se te paga íntegro.</li>
          <li>• El dinero queda retenido hasta que la clienta confirma o pasan {state.holdDays} días.</li>
          <li>• Cuando se libera, lo pides a retiro y lo transferimos a tu cuenta.</li>
        </ul>
      </div>
    </div>
  );
}

/* ══════════════════════ Artículos ══════════════════════ */

function ProductsTab({
  products, state, busy, setBusy, onError, onNotice, reload,
}: {
  products: MarketProduct[];
  state: SellerState;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onNotice: (v: string) => void;
  reload: () => Promise<void> | void;
}) {
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setCreating((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white"
      >
        <Plus className="h-4 w-4" /> {creating ? "Cerrar" : "Publicar un artículo"}
      </button>

      {creating && (
        <ProductForm
          state={state}
          onCancel={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await reload(); onNotice("Artículo publicado"); }}
          onError={onError}
        />
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          Todavía no publicaste artículos.
        </div>
      ) : (
        products.map((product) => (
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
        ))
      )}
    </div>
  );
}

function ProductForm({
  state, onCancel, onCreated, onError,
}: {
  state: SellerState;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
  onError: (v: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceClp, setPriceClp] = useState("");
  const [type, setType] = useState<MarketProductType>("PHOTO_SET");
  const [methods, setMethods] = useState<MarketDeliveryMethod[]>(["DIGITAL"]);
  const [autoDeliver, setAutoDeliver] = useState(true);
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);

  const isDigital = DIGITAL_TYPES.includes(type);

  const toggleMethod = (method: MarketDeliveryMethod) => {
    setMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  };

  const submit = async () => {
    setBusy(true);
    onError(null);
    try {
      await apiFetch("/market/seller/products", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          priceClp: Number(priceClp) || 0,
          type,
          deliveryMethods: methods,
          autoDeliver,
          stock: isDigital ? null : stock === "" ? null : Number(stock),
        }),
      });
      await onCreated();
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <Input label="Título" value={title} onChange={setTitle} placeholder="Pack 20 fotos exclusivas" />
      <TextArea label="Descripción" value={description} onChange={setDescription} rows={3} placeholder="Qué incluye, cuántas fotos, duración..." />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/50">Tipo</span>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as MarketProductType;
              setType(next);
              setMethods(DIGITAL_TYPES.includes(next) ? ["DIGITAL"] : ["SHIPPING", "MEET"]);
            }}
            className="w-full rounded-xl border border-white/10 bg-[#12101f] px-3 py-3 text-sm text-white outline-none focus:border-fuchsia-500/40"
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>{PRODUCT_TYPE_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <Input
          label={`Precio (${formatClp(state.minPriceClp)} - ${formatClp(state.maxPriceClp)})`}
          value={priceClp}
          onChange={setPriceClp}
          type="number"
          placeholder="15000"
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-white/50">Formas de entrega</p>
        <div className="flex flex-wrap gap-2">
          {(["DIGITAL", "SHIPPING", "MEET"] as MarketDeliveryMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => toggleMethod(method)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                methods.includes(method) ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.03] text-white/55"
              }`}
            >
              {DELIVERY_LABEL[method]}
            </button>
          ))}
        </div>
      </div>

      {!isDigital && <Input label="Stock (vacío = ilimitado)" value={stock} onChange={setStock} type="number" placeholder="1" />}

      {methods.includes("DIGITAL") && (
        <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <input type="checkbox" checked={autoDeliver} onChange={(e) => setAutoDeliver(e.target.checked)} className="mt-0.5 accent-fuchsia-500" />
          <span className="text-xs text-white/60">
            <strong className="text-white">Entrega automática.</strong> Apenas se confirma el pago, la clienta recibe los archivos sin que
            tengas que hacer nada.
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !title || !priceClp || methods.length === 0}
          onClick={submit}
          className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Publicando..." : "Publicar"}
        </button>
      </div>
    </div>
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
  const previewRef = useRef<HTMLInputElement | null>(null);
  const assetRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<Array<{ id: string; type: string; sizeBytes: number }>>([]);

  const loadAssets = useCallback(async () => {
    try {
      const response = await apiFetch<{ assets: Array<{ id: string; type: string; sizeBytes: number }> }>(
        `/market/seller/products/${product.id}/assets`,
      );
      setAssets(response.assets);
    } catch {
      // Sin archivos cargados todavía.
    }
  }, [product.id]);

  useEffect(() => { if (expanded) loadAssets(); }, [expanded, loadAssets]);

  const uploadFiles = async (files: FileList, kind: "media" | "assets") => {
    setBusy(true);
    onError(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const res = await fetch(`${getApiBase()}/market/seller/products/${product.id}/${kind}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "UPLOAD_FAILED");
      onNotice(kind === "media" ? "Vitrina actualizada" : "Contenido cargado");
      if (kind === "assets") await loadAssets();
      await reload();
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      await apiFetch(`/market/seller/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      await reload();
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("¿Quitar este artículo del marketplace?")) return;
    setBusy(true);
    try {
      await apiFetch(`/market/seller/products/${product.id}`, { method: "DELETE" });
      await reload();
      onNotice("Artículo retirado");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const needsAssets = product.deliveryMethods.includes("DIGITAL") && (product.assetCount ?? 0) === 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(product.coverUrl) || ""} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-lg">📦</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{product.title}</p>
          <p className="text-[11px] text-white/40">
            {formatClp(product.priceClp)} · {product.salesCount} vendidos {product.isActive ? "" : "· pausado"}
          </p>
          {needsAssets && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3" /> Falta subir el contenido
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.06] p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input ref={previewRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files, "media"); e.target.value = ""; }} />
            <button
              type="button"
              disabled={busy}
              onClick={() => previewRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" /> Fotos de vitrina ({product.media.length})
            </button>

            <input ref={assetRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files, "assets"); e.target.value = ""; }} />
            <button
              type="button"
              disabled={busy}
              onClick={() => assetRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-200 disabled:opacity-40"
            >
              <Lock className="h-4 w-4" /> Contenido a entregar ({assets.length || product.assetCount || 0})
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-white/40">
            Las fotos de vitrina son públicas y sirven de anzuelo. El contenido a entregar queda guardado en privado y solo lo
            ve quien pagó, dentro de UZEED, sin poder descargarlo.
          </p>

          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={toggleActive} className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70">
              {product.isActive ? "Pausar" : "Activar"}
            </button>
            <Link href={`/marketplace/producto/${product.id}`} className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-semibold text-white/70">
              Ver ficha
            </Link>
            <button type="button" disabled={busy} onClick={remove} className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-rose-200">
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
  orders, busy, setBusy, onError, onNotice, reload,
}: {
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
      onNotice("Pedido actualizado");
    } catch (err: any) {
      onError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (orders.length === 0) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">Todavía no tienes ventas.</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const status = ORDER_STATUS_UI[order.status];
        return (
          <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{order.productTitle}</p>
                <p className="text-[11px] text-white/40">{order.code} · {formatDate(order.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
            </div>

            <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
              <Detail label="Recibes" value={formatClp(order.sellerNetClp)} strong />
              <Detail label="Comisión UZEED" value={formatClp(order.commissionClp)} />
              <Detail label="Entrega" value={DELIVERY_LABEL[order.deliveryMethod]} />
              <Detail label="Compradora" value={order.buyer?.displayName || order.buyer?.username || "—"} />
            </div>

            {order.deliveryMethod === "SHIPPING" && order.shipAddress && (
              <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3 text-xs text-sky-100/80">
                <p className="font-semibold text-sky-100">Enviar a</p>
                <p>{order.shipName} · {order.shipPhone}</p>
                <p>{order.shipAddress}{order.shipCity ? `, ${order.shipCity}` : ""}</p>
                <p className="text-sky-200/60">{order.shippingRegion} · envío {formatClp(order.shippingClp)}</p>
              </div>
            )}

            {order.deliveryMethod === "MEET" && (
              <p className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-3 text-xs text-fuchsia-100/80">
                Entrega acordada: coordina con la clienta desde el chat del pedido.
              </p>
            )}

            {order.shipNotes && <p className="mt-2 text-xs text-white/50">Nota: {order.shipNotes}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {order.status === "PAID" && (
                <button type="button" disabled={busy} onClick={() => act(order.id, "accept")} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white">
                  Estoy preparándolo
                </button>
              )}
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
                  onClick={() => {
                    const tracking = order.deliveryMethod === "SHIPPING" ? window.prompt("Código de seguimiento (opcional)") : null;
                    act(order.id, "deliver", tracking ? { trackingCode: tracking } : {});
                  }}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-2 text-xs font-bold text-white"
                >
                  Marcar entregado
                </button>
              )}
              <Link href={`/marketplace/vender/pedidos/${order.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/60">
                Abrir chat
              </Link>
            </div>

            {order.status === "DELIVERED" && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock className="h-3 w-3" /> Esperando que la clienta confirme para liberar tu pago.
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
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard icon={Wallet} label="Disponible para retirar" value={formatClp(earnings.balance.availableClp)} accent="emerald" />
        <StatCard icon={Clock} label={`Retenido (${earnings.holdDays} días)`} value={formatClp(earnings.balance.heldClp)} accent="amber" />
        <StatCard icon={TrendingUp} label="Total liberado" value={formatClp(earnings.balance.releasedClp)} accent="fuchsia" />
        <StatCard icon={Banknote} label="Ya retirado" value={formatClp(earnings.balance.withdrawnClp)} accent="violet" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-bold text-white">Solicitar retiro</h2>
        {!bankReady ? (
          <p className="mt-2 text-xs text-amber-200">Carga tus datos bancarios en "Mi tienda" para poder retirar.</p>
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
              <div key={withdrawal.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                <span className="text-white/60">{formatDate(withdrawal.createdAt)}</span>
                <span className="text-white">{formatClp(withdrawal.amountClp)}</span>
                <span className="text-white/45">{withdrawal.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-bold text-white">Movimientos</h2>
        <div className="mt-3 space-y-1.5">
          {earnings.ledger.length === 0 ? (
            <p className="text-xs text-white/40">Todavía no hay movimientos.</p>
          ) : (
            earnings.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
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
  const [storeName, setStoreName] = useState(seller.storeName || "");
  const [tagline, setTagline] = useState(seller.tagline || "");
  const [bio, setBio] = useState(seller.bio || "");
  const [region, setRegion] = useState(seller.region || "");
  const [autoDeliver, setAutoDeliver] = useState(seller.autoDeliverDigital);
  const [acceptsShipping, setAcceptsShipping] = useState(seller.acceptsShipping);
  const [acceptsMeet, setAcceptsMeet] = useState(seller.acceptsMeet);

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
        body: JSON.stringify({ storeName, tagline, bio, region, autoDeliverDigital: autoDeliver, acceptsShipping, acceptsMeet }),
      });
      await reload();
      onNotice("Tienda actualizada");
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
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Store className="h-4 w-4 text-fuchsia-300" /> Mi tienda</h2>
        <Input label="Nombre de la tienda" value={storeName} onChange={setStoreName} />
        <Input label="Frase corta" value={tagline} onChange={setTagline} />
        <TextArea label="Descripción" value={bio} onChange={setBio} rows={3} />
        <Input label="Región desde donde envías" value={region} onChange={setRegion} />

        <Toggle checked={autoDeliver} onChange={setAutoDeliver} title="Entrega automática de contenido digital"
          text="Las fotos y videos se envían solos apenas se confirma el pago." />
        <Toggle checked={acceptsShipping} onChange={setAcceptsShipping} title="Acepto envíos" text="Los artículos físicos se despachan a domicilio." />
        <Toggle checked={acceptsMeet} onChange={setAcceptsMeet} title="Acepto entrega acordada" text="Coordinas la entrega por el chat del pedido." />

        <button type="button" disabled={busy} onClick={saveStore} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
          Guardar tienda
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Building2 className="h-4 w-4 text-emerald-300" /> Dónde te transferimos</h2>
        <p className="text-xs text-white/45">Estos datos los usa administración para pagarte lo que retires. No se muestran a los clientes.</p>
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

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-fuchsia-500" />
      <span className="text-xs text-white/60">
        <strong className="block text-white">{title}</strong>
        {text}
      </span>
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
