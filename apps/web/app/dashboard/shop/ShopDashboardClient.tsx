"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useMe from "../../../hooks/useMe";
import MapboxMap from "../../../components/MapboxMap";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";

/* ── Types ── */
type ProductMedia = { id: string; url: string; pos: number };
type ShopCategory = { id: string; slug: string; name: string };
type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  media?: ProductMedia[];
  shopCategory?: ShopCategory | null;
};

type TabKey = "overview" | "branding" | "categories" | "products" | "location";

const tabsMeta: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "overview", label: "Resumen", icon: "📊" },
  { key: "branding", label: "Branding", icon: "🎨" },
  { key: "categories", label: "Categorías", icon: "📂" },
  { key: "products", label: "Productos", icon: "📦" },
  { key: "location", label: "Ubicación", icon: "📍" },
];

/* ── Helpers ── */
function formatMoney(value?: number | null) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

/* ── Glass input ── */
function GlassInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-xs font-medium text-white/50 transition-colors group-focus-within:text-fuchsia-400">{label}</span>
      <input
        {...props}
        className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-fuchsia-500/20 [color-scheme:dark] ${props.className || ""}`}
      />
    </label>
  );
}
function GlassTextarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-xs font-medium text-white/50 transition-colors group-focus-within:text-fuchsia-400">{label}</span>
      <textarea
        {...props}
        className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-fuchsia-500/20 resize-none ${props.className || ""}`}
      />
    </label>
  );
}

export default function ShopDashboardClient() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const user = me?.user ?? null;

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const productFilesRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Profile fields */
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationVerified, setLocationVerified] = useState(false);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  /* Category form */
  const [newCategoryName, setNewCategoryName] = useState("");

  /* Product form */
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  /* ── Load data ── */
  async function loadData() {
    setError(null);
    try {
      const [meRes, prodsRes, catsRes] = await Promise.all([
        apiFetch<{ user: any }>("/auth/me"),
        apiFetch<{ products: Product[] }>("/shop/products"),
        apiFetch<{ categories: ShopCategory[] }>("/shop/categories"),
      ]);
      const u = meRes?.user;
      if (u) {
        setDisplayName(u.displayName || "");
        setBio(u.bio || "");
        setServiceDescription(u.serviceDescription || "");
        setAddress(u.address || "");
        setCity(u.city || "");
        setLatitude(u.latitude != null ? String(u.latitude) : "");
        setLongitude(u.longitude != null ? String(u.longitude) : "");
        setLocationVerified(Boolean(u.latitude && u.longitude));
      }
      setProducts(prodsRes?.products ?? []);
      setShopCategories(catsRes?.categories ?? []);
    } catch {
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!meLoading && user?.id) loadData();
  }, [meLoading, user?.id]);

  /* Toast auto-dismiss */
  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [msg]);

  /* ── KPIs ── */
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const totalCategories = shopCategories.length;
  const inventoryValue = useMemo(() => products.reduce((sum, p) => sum + p.price * p.stock, 0), [products]);
  const totalStock = useMemo(() => products.reduce((sum, p) => sum + p.stock, 0), [products]);
  const productsWithMedia = products.filter((p) => p.media && p.media.length > 0).length;

  /* Products grouped by category */
  const grouped = useMemo(() => {
    const g: Record<string, Product[]> = {};
    for (const p of products) {
      const k = p.shopCategory?.name || "Sin categoría";
      if (!g[k]) g[k] = [];
      g[k].push(p);
    }
    return Object.entries(g);
  }, [products]);

  /* ── Profile save ── */
  async function saveProfile() {
    setBusy(true);
    try {
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          bio,
          serviceDescription,
          address,
          city,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        }),
      });
      setMsg("Perfil actualizado.");
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /* ── Image uploads ── */
  async function uploadImage(type: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/profile/${type}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      setMsg(`${type === "avatar" ? "Avatar" : "Portada"} actualizado.`);
      await loadData();
    } catch {
      setError("No se pudo actualizar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Geocode ── */
  async function geocodeAddress() {
    const q = address.trim();
    if (!q) { setGeocodeError("Ingresa una dirección."); return; }
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) { setGeocodeError("Token de Mapbox no configurado."); return; }
    setGeocodeBusy(true);
    setGeocodeError(null);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=1&language=es`);
      if (!res.ok) throw new Error("GEOCODE_FAILED");
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature?.center) throw new Error("NO_RESULTS");
      const contexts: Array<{ id: string; text: string }> = feature.context || [];
      const loc =
        contexts.find((c) => c.id.includes("neighborhood"))?.text ||
        contexts.find((c) => c.id.includes("locality"))?.text ||
        contexts.find((c) => c.id.includes("place"))?.text ||
        "";
      setLongitude(String(feature.center[0]));
      setLatitude(String(feature.center[1]));
      setAddress(feature.place_name || q);
      if (loc) setCity(loc);
      setLocationVerified(true);
    } catch {
      setGeocodeError("No se encontró la dirección.");
    } finally {
      setGeocodeBusy(false);
    }
  }

  /* ── Category management ── */
  async function createCategory() {
    if (!newCategoryName.trim()) return;
    try {
      await apiFetch("/shop/categories", { method: "POST", body: JSON.stringify({ name: newCategoryName.trim() }) });
      setNewCategoryName("");
      setMsg("Categoría creada.");
      await loadData();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function removeCategory(id: string) {
    try {
      await apiFetch(`/shop/categories/${id}`, { method: "DELETE" });
      setMsg("Categoría eliminada.");
      await loadData();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  }

  /* ── Product management ── */
  function resetProductForm() {
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setProductStock("");
    setProductCategoryId("");
    setEditingProductId(null);
  }

  function startEditProduct(p: Product) {
    setProductName(p.name);
    setProductDescription(p.description || "");
    setProductPrice(String(p.price || ""));
    setProductStock(String(p.stock || ""));
    setProductCategoryId(p.shopCategory?.id || "");
    setEditingProductId(p.id);
    setTab("products");
  }

  async function saveProduct() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: productName,
        description: productDescription,
        price: productPrice ? Number(productPrice) : 0,
        stock: productStock ? Number(productStock) : 0,
        shopCategoryId: productCategoryId || undefined,
        isActive: true,
      };
      if (editingProductId) {
        await apiFetch(`/shop/products/${editingProductId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMsg("Producto actualizado.");
      } else {
        await apiFetch("/shop/products", { method: "POST", body: JSON.stringify(payload) });
        setMsg("Producto creado.");
      }
      resetProductForm();
      await loadData();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/shop/products/${id}`, { method: "DELETE" });
      setMsg("Producto eliminado.");
      await loadData();
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadProductMedia(productId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/shop/products/${productId}/media`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      setMsg("Fotos actualizadas.");
      await loadData();
    } catch {
      setError("No se pudieron subir las fotos.");
    } finally {
      setUploadingProductId(null);
    }
  }

  async function removeProductMedia(mediaId: string) {
    try {
      await apiFetch(`/shop/products/media/${mediaId}`, { method: "DELETE" });
      setMsg("Foto eliminada.");
      await loadData();
    } catch {
      setError("No se pudo eliminar la foto.");
    }
  }

  /* ── Guards ── */
  if (meLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500/20 border-t-fuchsia-500" />
          <p className="text-sm text-white/60">Cargando panel de tienda...</p>
        </div>
      </div>
    );
  }
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;

  const coverUrl = resolveMediaUrl(user.coverUrl);
  const avatarUrl = resolveMediaUrl(user.avatarUrl);

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <div className="relative min-h-screen bg-[#070816] pb-12 text-white -mx-4 -mt-2">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.06),transparent_50%)]" />

      {/* ── Hero ── */}
      <header className="relative h-52 overflow-hidden sm:h-64">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070816] via-[#070816]/70 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="mx-auto flex max-w-5xl items-end gap-4">
            {/* Avatar */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-black/40 shadow-2xl transition-all hover:border-fuchsia-400/50 sm:h-24 sm:w-24"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-2xl font-bold text-white/60">
                  {displayName?.charAt(0) || "T"}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage("avatar", e)} />
            </button>

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{displayName || user.username}</h1>
              <p className="mt-0.5 text-sm text-white/60">Panel de administración · Tienda</p>
            </div>

            <button
              onClick={() => coverInputRef.current?.click()}
              className="hidden shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.08] sm:flex"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Cambiar portada
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage("cover", e)} />
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#070816]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl overflow-x-auto">
          <div className="flex min-w-max px-5 sm:px-8">
            {tabsMeta.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative whitespace-nowrap px-4 py-4 text-sm font-medium transition-colors ${
                  tab === t.key ? "text-white" : "text-white/50 hover:text-white/70"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
                {tab === t.key && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="mx-auto max-w-5xl space-y-6 px-5 pt-6 sm:px-8">

        {/* ════ Overview ════ */}
        {tab === "overview" && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Productos", value: String(totalProducts), sub: `${activeProducts} activos`, color: "border-fuchsia-500/30" },
                { label: "Categorías", value: String(totalCategories), sub: "organizando", color: "border-violet-500/30" },
                { label: "Stock total", value: String(totalStock), sub: "unidades", color: "border-emerald-500/30" },
                { label: "Valor inventario", value: formatMoney(inventoryValue), sub: "referencial", color: "border-amber-500/30" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={`rounded-2xl border ${kpi.color} bg-white/[0.03] p-4 transition-all hover:bg-white/[0.05]`}
                >
                  <p className="text-xs font-medium text-white/50">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
                  <p className="mt-0.5 text-xs text-white/40">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Completeness hints */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-3 text-sm font-semibold text-white/80">Estado de tu tienda</h3>
              <div className="space-y-2">
                {[
                  { done: !!displayName, text: "Nombre de tienda configurado" },
                  { done: !!avatarUrl, text: "Logo / avatar subido" },
                  { done: !!coverUrl, text: "Imagen de portada" },
                  { done: shopCategories.length > 0, text: "Al menos 1 categoría creada" },
                  { done: products.length > 0, text: "Al menos 1 producto publicado" },
                  { done: productsWithMedia > 0, text: "Productos con fotos" },
                  { done: locationVerified, text: "Ubicación verificada" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2.5">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/20"}`}>
                      {item.done ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      )}
                    </div>
                    <span className={`text-sm ${item.done ? "text-white/70" : "text-white/40"}`}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent products */}
            {products.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/80">Últimos productos</h3>
                  <button onClick={() => setTab("products")} className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                    Ver todos →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {products.slice(0, 4).map((p) => {
                    const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                    return (
                      <div key={p.id} className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
                        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02]">
                          {img ? (
                            <img src={img} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/15">
                              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                          )}
                          {p.shopCategory && (
                            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                              {p.shopCategory.name}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate text-sm font-medium text-white/90">{p.name}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-sm font-semibold text-fuchsia-400">{formatMoney(p.price)}</span>
                            <span className="text-xs text-white/40">Stock {p.stock}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {grouped.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white/80">Productos por categoría</h3>
                <div className="space-y-2.5">
                  {grouped.map(([catName, items]) => (
                    <div key={catName} className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all"
                          style={{ width: `${Math.max(5, (items.length / totalProducts) * 100)}%` }}
                        />
                      </div>
                      <span className="w-20 truncate text-right text-xs text-white/60">{catName}</span>
                      <span className="w-8 text-right text-xs font-semibold text-white/80">{items.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setTab("products")} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-fuchsia-500/10 transition-all hover:brightness-110">
                + Nuevo producto
              </button>
              <button onClick={() => setTab("categories")} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.08]">
                + Categoría
              </button>
              <Link href={`/sexshop/${user.username}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.08]">
                Ver mi tienda →
              </Link>
            </div>
          </>
        )}

        {/* ════ Branding ════ */}
        {tab === "branding" && (
          <>
            {/* Cover & avatar */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-semibold text-white/80">Imágenes de marca</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="group relative h-40 overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/[0.02] transition-all hover:border-fuchsia-400/40"
                >
                  {coverUrl ? (
                    <img src={coverUrl} alt="Portada" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all ${coverUrl ? "bg-black/60 opacity-0 group-hover:opacity-100" : ""}`}>
                    <svg className="h-8 w-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-white/50">{coverUrl ? "Cambiar portada" : "Subir portada"}</span>
                  </div>
                </button>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative flex h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/[0.02] transition-all hover:border-fuchsia-400/40"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-2xl border border-white/20 object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-2xl font-bold text-white/30">
                      {displayName?.charAt(0) || "?"}
                    </div>
                  )}
                  <span className="text-xs text-white/50">{avatarUrl ? "Cambiar logo" : "Subir logo"}</span>
                </button>
              </div>
            </div>

            {/* Profile info */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-semibold text-white/80">Información de la tienda</h3>
              <div className="grid gap-4">
                <GlassInput label="Nombre de la tienda" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nombre visible para clientes" />
                <GlassTextarea label="Descripción / Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuéntale a tus clientes sobre tu tienda..." rows={4} />
                <GlassTextarea label="Descripción de servicios" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="Describe lo que ofreces..." rows={3} />
                <button
                  onClick={saveProfile}
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold shadow-lg shadow-fuchsia-500/10 transition-all hover:brightness-110 disabled:opacity-40 sm:w-fit sm:px-8"
                >
                  {busy ? "Guardando..." : "Guardar perfil"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ════ Categories ════ */}
        {tab === "categories" && (
          <>
            {/* Create category */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-1 text-sm font-semibold text-white/80">Nueva categoría</h3>
              <p className="mb-4 text-xs text-white/40">Organiza tus productos en categorías para que los clientes naveguen fácilmente.</p>
              <div className="flex gap-3">
                <GlassInput label="Nombre" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Juguetes premium" className="flex-1" />
                <button
                  onClick={createCategory}
                  disabled={!newCategoryName.trim()}
                  className="mt-6 shrink-0 self-start rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                >
                  Crear
                </button>
              </div>
            </div>

            {/* Existing categories */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-semibold text-white/80">Categorías existentes ({shopCategories.length})</h3>
              {shopCategories.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {shopCategories.map((cat) => {
                    const count = products.filter((p) => p.shopCategory?.id === cat.id).length;
                    return (
                      <div key={cat.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12]">
                        <div>
                          <p className="text-sm font-medium text-white/90">{cat.name}</p>
                          <p className="mt-0.5 text-xs text-white/40">{count} {count === 1 ? "producto" : "productos"}</p>
                        </div>
                        <button
                          onClick={() => removeCategory(cat.id)}
                          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-red-300/70 transition-all hover:bg-red-500/10 hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-10 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                    <svg className="h-7 w-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                  </div>
                  <p className="text-sm text-white/40">Aún no tienes categorías</p>
                  <p className="mt-1 text-xs text-white/25">Crea una arriba para organizar tus productos</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════ Products ════ */}
        {tab === "products" && (
          <>
            {/* Product form */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-1 text-sm font-semibold text-white/80">
                {editingProductId ? "Editar producto" : "Nuevo producto"}
              </h3>
              <p className="mb-4 text-xs text-white/40">Completa los datos y publica tu producto.</p>
              <div className="grid gap-4">
                <GlassInput label="Nombre del producto" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ej: Aceite de masaje premium" />
                <GlassTextarea label="Descripción" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Describe el producto..." rows={3} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-white/50">Categoría</span>
                    <select
                      value={productCategoryId}
                      onChange={(e) => setProductCategoryId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20 [color-scheme:dark]"
                    >
                      <option value="">Seleccionar...</option>
                      {shopCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <GlassInput label="Precio (CLP)" type="number" min="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="0" />
                  <GlassInput label="Stock" type="number" min="0" value={productStock} onChange={(e) => setProductStock(e.target.value)} placeholder="0" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={saveProduct}
                    disabled={busy || !productName.trim()}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-fuchsia-500/10 transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "Guardando..." : editingProductId ? "Guardar cambios" : "Publicar producto"}
                  </button>
                  {editingProductId && (
                    <button onClick={resetProductForm} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/60 transition-all hover:bg-white/[0.08]">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Product list */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">Todos los productos ({products.length})</h3>
              </div>
              {products.length ? (
                <div className="space-y-3">
                  {products.map((p) => {
                    const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                    return (
                      <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12]">
                        <div className="flex gap-4">
                          {/* Product image */}
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                            {img ? (
                              <img src={img} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-white/15">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                          </div>

                          {/* Product info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-white/90">{p.name}</p>
                                <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{p.description || "Sin descripción"}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${p.isActive ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border border-white/10 bg-white/5 text-white/40"}`}>
                                {p.isActive ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                              <span className="font-semibold text-fuchsia-400">{formatMoney(p.price)}</span>
                              <span>·</span>
                              <span>Stock {p.stock}</span>
                              {p.shopCategory && (
                                <>
                                  <span>·</span>
                                  <span className="rounded-full bg-white/5 px-2 py-0.5">{p.shopCategory.name}</span>
                                </>
                              )}
                              {p.media && p.media.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{p.media.length} {p.media.length === 1 ? "foto" : "fotos"}</span>
                                </>
                              )}
                            </div>

                            {/* Product media thumbnails */}
                            {p.media && p.media.length > 0 && (
                              <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
                                {p.media.map((m) => (
                                  <div key={m.id} className="group/thumb relative shrink-0">
                                    <img src={resolveMediaUrl(m.url) ?? undefined} alt="" className="h-12 w-12 rounded-lg border border-white/[0.06] object-cover" />
                                    <button
                                      onClick={() => removeProductMedia(m.id)}
                                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-[8px] text-white shadow group-hover/thumb:flex"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <label className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-all hover:bg-white/[0.06]">
                                {uploadingProductId === p.id ? "Subiendo..." : "📷 Fotos"}
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadProductMedia(p.id, e)} />
                              </label>
                              <button
                                onClick={() => startEditProduct(p)}
                                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-all hover:bg-white/[0.06]"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => removeProduct(p.id)}
                                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-red-300/70 transition-all hover:bg-red-500/10"
                              >
                                🗑 Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                    <svg className="h-8 w-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  </div>
                  <p className="text-sm text-white/40">Aún no tienes productos</p>
                  <p className="mt-1 text-xs text-white/25">Usa el formulario de arriba para publicar tu primer producto</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════ Location ════ */}
        {tab === "location" && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-1 text-sm font-semibold text-white/80">Dirección de la tienda</h3>
              <p className="mb-4 text-xs text-white/40">Los clientes verán tu ubicación en el mapa de tiendas cercanas.</p>
              <div className="grid gap-4">
                <GlassInput label="Dirección" value={address} onChange={(e) => { setAddress(e.target.value); setLocationVerified(false); }} placeholder="Ej: Av. Providencia 1234, Santiago" />
                <GlassInput label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Santiago" />
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={geocodeAddress}
                    disabled={geocodeBusy || !address.trim()}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {geocodeBusy ? "Buscando..." : "Verificar en mapa"}
                  </button>
                  {locationVerified && (
                    <span className="flex items-center gap-1.5 self-center text-xs text-emerald-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Ubicación verificada
                    </span>
                  )}
                </div>
                {geocodeError && <p className="text-sm text-red-400">{geocodeError}</p>}

                {locationVerified && latitude && longitude && (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <MapboxMap
                      height={256}
                      className="w-full"
                      userLocation={[Number(longitude), Number(latitude)]}
                      focusMarkerId="shop"
                      markers={[
                        {
                          id: "shop",
                          name: displayName || "Mi tienda",
                          lat: Number(latitude),
                          lng: Number(longitude)
                        }
                      ]}
                    />
                  </div>
                )}

                <button
                  onClick={saveProfile}
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold shadow-lg shadow-fuchsia-500/10 transition-all hover:brightness-110 disabled:opacity-40 sm:w-fit sm:px-8"
                >
                  {busy ? "Guardando..." : "Guardar ubicación"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Toast ── */}
      {msg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-200 shadow-2xl backdrop-blur-xl">
          {msg}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
