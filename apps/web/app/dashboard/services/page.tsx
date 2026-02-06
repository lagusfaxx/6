"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import Avatar from "../../../components/Avatar";

type ServiceMedia = { id: string; url: string; type: "IMAGE" | "VIDEO" };

type ServiceItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  categoryId?: string | null;
  price?: number | null;
  createdAt: string;
  media?: ServiceMedia[];
  categoryRel?: { id: string; slug: string; displayName?: string | null; name?: string | null } | null;
};

type ProductMedia = { id: string; url: string; pos: number };

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  media?: ProductMedia[];
  category?: { id: string; slug: string; displayName?: string | null; name?: string | null } | null;
};

type ProfileMedia = { id: string; url: string; type: string };

type Category = {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
};

type ProfileType = "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" | "CREATOR" | "VIEWER" | "CLIENT";

const labelsByProfile: Record<string, { item: string; panel: string; helper: string; listTitle: string }> = {
  PROFESSIONAL: {
    item: "servicio",
    panel: "Panel de experiencias",
    helper: "Gestiona tu perfil público y las experiencias que ofreces.",
    listTitle: "Servicios publicados"
  },
  ESTABLISHMENT: {
    item: "habitación/servicio",
    panel: "Panel de lugares",
    helper: "Publica habitaciones u ofertas y actualiza tu ficha comercial.",
    listTitle: "Habitaciones u ofertas"
  },
  SHOP: {
    item: "producto",
    panel: "Panel de tienda",
    helper: "Administra productos, stock y fotos para tu catálogo.",
    listTitle: "Productos publicados"
  }
};

function stripAge(source?: string | null) {
  const raw = source || "";
  return raw.replace(/^\[edad:(\d{1,2})\]\s*/i, "").trim();
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function categoryLabel(category?: { displayName?: string | null; name?: string | null } | null) {
  return category?.displayName || category?.name || "Sin categoría";
}

export default function DashboardServicesPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [tab, setTab] = useState("perfil");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [gallery, setGallery] = useState<ProfileMedia[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [price, setPrice] = useState<string>("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productPrice, setProductPrice] = useState<string>("");
  const [productStock, setProductStock] = useState<string>("0");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const profileType = (user?.profileType ?? "CLIENT") as ProfileType;
  const labels = labelsByProfile[profileType] ?? labelsByProfile.PROFESSIONAL;
  const canManage = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(profileType);

  const kindForProfile = profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const categoryOptions = useMemo(() => categories.filter((c) => c.kind === kindForProfile), [categories, kindForProfile]);

  useEffect(() => {
    if (!categoryOptions.length) return;
    setServiceCategoryId((prev) => prev || categoryOptions[0].id);
    if (profileType === "SHOP") {
      setProductCategoryId((prev) => prev || categoryOptions[0].id);
    }
  }, [categoryOptions, profileType]);

  useEffect(() => {
    if (!loading && user?.id) {
      apiFetch<Category[]>("/categories")
        .then((res) => setCategories(Array.isArray(res) ? res : []))
        .catch(() => setCategories([]));
    }
  }, [loading, user?.id]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function loadPanel(userId: string) {
    setError(null);
    try {
      const requests: Array<Promise<any>> = [
        apiFetch<{ user: any }>("/auth/me"),
        apiFetch<{ media: ProfileMedia[] }>("/profile/media")
      ];
      if (profileType !== "SHOP") {
        requests.push(apiFetch<{ items: ServiceItem[] }>(`/services/${userId}/items`));
      }
      if (profileType === "SHOP") {
        requests.push(apiFetch<{ products: Product[] }>("/shop/products"));
      }

      const results = await Promise.all(requests);
      const meRes = results[0];
      const galleryRes = results[1];
      let serviceRes: { items: ServiceItem[] } | undefined;
      let productRes: { products: Product[] } | undefined;
      let idx = 2;
      if (profileType !== "SHOP") {
        serviceRes = results[idx] as { items: ServiceItem[] };
        idx += 1;
      }
      if (profileType === "SHOP") {
        productRes = results[idx] as { products: Product[] };
      }
      setGallery(galleryRes?.media ?? []);
      setDisplayName(meRes?.user?.displayName ?? "");
      setBio(stripAge(meRes?.user?.bio));
      setBirthdate(toDateInputValue(meRes?.user?.birthdate));
      setServiceDescription(meRes?.user?.serviceDescription ?? "");
      setGender(meRes?.user?.gender || "FEMALE");
      setAddress(meRes?.user?.address || "");
      setCity(meRes?.user?.city || "");

      if (profileType !== "SHOP") {
        setItems(serviceRes?.items ?? []);
      }
      if (profileType === "SHOP") {
        setProducts(productRes?.products ?? []);
      }
    } catch {
      setError("No se pudieron cargar tus datos del panel.");
    }
  }

  useEffect(() => {
    if (!loading && user?.id) loadPanel(user.id);
  }, [loading, user?.id]);

  function showToast(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          bio: bio.trim(),
          serviceDescription,
          gender,
          address,
          city,
          birthdate: birthdate || null
        })
      });
      showToast("Guardado");
      router.refresh();
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudo guardar tu perfil.");
      showToast("No se pudo guardar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createService() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title,
        description: description || null,
        categoryId: serviceCategoryId,
        price: price ? parseInt(price, 10) : null
      };
      const endpoint = editingServiceId ? `/services/items/${editingServiceId}` : "/services/items";
      const method = editingServiceId ? "PUT" : "POST";
      await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      setTitle("");
      setDescription("");
      setPrice("");
      setEditingServiceId(null);
      if (user?.id) await loadPanel(user.id);
      showToast(editingServiceId ? "Servicio actualizado" : `Tu ${labels.item} fue creado.`);
      router.refresh();
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || `No se pudo guardar el ${labels.item}.`);
      showToast("No se pudo guardar.", "error");
    } finally {
      setBusy(false);
    }
  }

  function startEditService(item: ServiceItem) {
    setEditingServiceId(item.id);
    setTitle(item.title);
    setDescription(item.description || "");
    setPrice(item.price ? String(item.price) : "");
    setServiceCategoryId(item.categoryId || item.categoryRel?.id || serviceCategoryId);
    setTab("servicios");
  }

  async function removeService(id: string) {
    if (!confirm(`¿Eliminar este ${labels.item}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/services/items/${id}`, { method: "DELETE" });
      if (user?.id) await loadPanel(user.id);
      showToast("Eliminado");
    } catch {
      setError("No se pudo eliminar.");
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadServiceImage(itemId: string, files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setBusy(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/services/items/${itemId}/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await loadPanel(user.id);
      showToast("Fotos cargadas correctamente.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudieron subir las fotos.");
      showToast("No se pudieron subir las fotos.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createProduct() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: productName,
        description: productDescription || null,
        categoryId: productCategoryId,
        price: productPrice ? parseInt(productPrice, 10) : 0,
        stock: productStock ? parseInt(productStock, 10) : 0
      };
      const endpoint = editingProductId ? `/shop/products/${editingProductId}` : "/shop/products";
      const method = editingProductId ? "PATCH" : "POST";
      await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      setProductName("");
      setProductDescription("");
      setProductPrice("");
      setProductStock("0");
      setEditingProductId(null);
      if (user?.id) await loadPanel(user.id);
      showToast(editingProductId ? "Producto actualizado" : "Producto creado");
      router.refresh();
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudo guardar el producto.");
      showToast("No se pudo guardar.", "error");
    } finally {
      setBusy(false);
    }
  }

  function startEditProduct(item: Product) {
    setEditingProductId(item.id);
    setProductName(item.name);
    setProductDescription(item.description || "");
    setProductPrice(String(item.price));
    setProductStock(String(item.stock));
    setProductCategoryId(item.category?.id || productCategoryId);
    setTab("productos");
  }

  async function removeProduct(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/shop/products/${id}`, { method: "DELETE" });
      if (user?.id) await loadPanel(user.id);
      showToast("Producto eliminado");
    } catch {
      setError("No se pudo eliminar.");
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadProductImage(productId: string, files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setBusy(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/shop/products/${productId}/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await loadPanel(user.id);
      showToast("Fotos cargadas correctamente.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudieron subir las fotos.");
      showToast("No se pudieron subir las fotos.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadProfileImage(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (kind === "avatar") {
      setAvatarPreview(previewUrl);
      setAvatarUploading(true);
    } else {
      setCoverPreview(previewUrl);
      setCoverUploading(true);
    }

    const form = new FormData();
    form.append("file", file);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/profile/${kind}`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await loadPanel(user.id);
      showToast(kind === "avatar" ? "Foto de perfil actualizada." : "Foto de portada actualizada.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudo subir la imagen.");
      showToast("No se pudo subir la imagen.", "error");
    } finally {
      if (kind === "avatar") setAvatarUploading(false);
      if (kind === "cover") setCoverUploading(false);
      event.target.value = "";
    }
  }

  async function uploadGallery(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setBusy(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/profile/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await loadPanel(user.id);
      showToast("Galería actualizada.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudieron subir las fotos.");
      showToast("No se pudieron subir las fotos.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeGalleryItem(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/profile/media/${id}`, { method: "DELETE" });
      if (user?.id) await loadPanel(user.id);
      showToast("Foto eliminada");
    } catch {
      setError("No se pudo eliminar la foto.");
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!canManage) return <div className="p-6 text-white/70">Este panel es solo para experiencias, lugares y tiendas.</div>;

  const tabs = [
    { key: "perfil", label: "Perfil público" },
    ...(profileType !== "SHOP" ? [{ key: "servicios", label: "Servicios" }] : []),
    ...(profileType === "SHOP" ? [{ key: "productos", label: "Productos" }] : []),
    { key: "galeria", label: "Galería" },
    { key: "ubicacion", label: "Ubicación" }
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{labels.panel}</h1>
            <Badge>{profileType === "PROFESSIONAL" ? "Experiencia" : profileType === "ESTABLISHMENT" ? "Lugar" : "Tienda"}</Badge>
          </div>
          <p className="text-sm text-white/70">{labels.helper}</p>
        </div>
        <Link href="/cuenta" className="text-sm text-white/70 hover:text-white">Volver a cuenta</Link>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="perfil" className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">Perfil público</h2>
              <p className="mt-1 text-xs text-white/60">Información visible para clientes y buscadores.</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-xs text-white/60">
                  Nombre visible
                  <input className="input" placeholder="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs text-white/60">
                    Género
                    <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="FEMALE">Mujer</option>
                      <option value="MALE">Hombre</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-white/60">
                    Fecha de nacimiento
                    <input
                      className="input"
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      required
                    />
                    <span className="text-[11px] text-white/50">Debes ser mayor de 18 años.</span>
                  </label>
                </div>
                <label className="grid gap-2 text-xs text-white/60">
                  Descripción general
                  <textarea className="input min-h-[110px]" placeholder="Descripción" value={bio} onChange={(e) => setBio(e.target.value)} />
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Descripción de servicios
                  <textarea className="input min-h-[110px]" placeholder="Describe tu oferta" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} />
                </label>
                <button disabled={busy} onClick={saveProfile} className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50">
                  Guardar perfil
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">Imagen de perfil y portada</h2>
              <p className="mt-1 text-xs text-white/60">Actualiza tus imágenes con vista previa inmediata.</p>
              <div className="mt-4 grid gap-4">
                <div className="flex items-center gap-4">
                  <Avatar src={avatarPreview || user.avatarUrl} alt={user.displayName || user.username} size={64} />
                  <div>
                    <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer inline-flex">
                      {avatarUploading ? "Subiendo..." : "Subir foto de perfil"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e)} />
                    </label>
                    <div className="mt-1 text-xs text-white/50">Formato recomendado: JPG o PNG.</div>
                  </div>
                </div>
                <div>
                  <div className="h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {coverPreview || user.coverUrl ? (
                      <img src={resolveMediaUrl(coverPreview || user.coverUrl) || ""} alt="Portada" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-white/50">Sin portada</div>
                    )}
                  </div>
                  <label className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer">
                    {coverUploading ? "Subiendo..." : "Subir foto de portada"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e)} />
                  </label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="servicios" className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">{editingServiceId ? "Editar" : "Agregar"} {labels.item}</h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-2 text-xs text-white/60">
                  Título
                  <input className="input" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Categoría
                  <select className="input" value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)}>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Precio (CLP)
                  <input className="input" placeholder="Precio" value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Descripción
                  <textarea className="input min-h-[110px]" placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy || !title.trim() || !serviceCategoryId}
                    onClick={createService}
                    className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50"
                  >
                    {busy ? "Guardando..." : editingServiceId ? "Actualizar" : `Crear ${labels.item}`}
                  </button>
                  {editingServiceId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingServiceId(null);
                        setTitle("");
                        setDescription("");
                        setPrice("");
                      }}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">{labels.listTitle}</h2>
              <div className="mt-3 grid gap-3">
                {items.map((it) => (
                  <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{it.title}</div>
                        <div className="text-xs text-white/60">{categoryLabel(it.categoryRel)} • {it.price ? `$${it.price}` : "Precio a coordinar"}</div>
                        <div className="mt-2 text-xs text-white/50">Estado: Activo</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => startEditService(it)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10">Editar</button>
                        <button onClick={() => removeService(it.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10">Eliminar</button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs hover:bg-black/30 cursor-pointer w-fit">
                        Subir fotos
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadServiceImage(it.id, e.target.files)} />
                      </label>
                      {it.media?.length ? (
                        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                          {it.media.map((m) => (
                            <div key={m.id} className="h-20 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                              <img src={resolveMediaUrl(m.url) || ""} alt={it.title} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-white/60">Sin fotos todavía.</div>
                      )}
                    </div>
                  </div>
                ))}
                {!items.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no tienes {labels.item}s.</div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="productos" className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">{editingProductId ? "Editar" : "Agregar"} producto</h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-2 text-xs text-white/60">
                  Nombre del producto
                  <input className="input" placeholder="Nombre" value={productName} onChange={(e) => setProductName(e.target.value)} />
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Categoría
                  <select className="input" value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs text-white/60">
                    Precio (CLP)
                    <input className="input" placeholder="Precio" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
                  </label>
                  <label className="grid gap-2 text-xs text-white/60">
                    Stock
                    <input className="input" placeholder="Stock" value={productStock} onChange={(e) => setProductStock(e.target.value)} />
                  </label>
                </div>
                <label className="grid gap-2 text-xs text-white/60">
                  Descripción
                  <textarea className="input min-h-[110px]" placeholder="Descripción" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy || !productName.trim() || !productCategoryId}
                    onClick={createProduct}
                    className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50"
                  >
                    {busy ? "Guardando..." : editingProductId ? "Actualizar" : "Crear producto"}
                  </button>
                  {editingProductId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProductId(null);
                        setProductName("");
                        setProductDescription("");
                        setProductPrice("");
                        setProductStock("0");
                      }}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">Productos publicados</h2>
              <div className="mt-3 grid gap-3">
                {products.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{p.name}</div>
                        <div className="text-xs text-white/60">{categoryLabel(p.category)} • ${p.price}</div>
                        <div className="mt-2 text-xs text-white/50">Estado: {p.isActive ? "Activo" : "Inactivo"} • Stock: {p.stock}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => startEditProduct(p)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10">Editar</button>
                        <button onClick={() => removeProduct(p.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10">Eliminar</button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs hover:bg-black/30 cursor-pointer w-fit">
                        Subir fotos
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadProductImage(p.id, e.target.files)} />
                      </label>
                      {p.media?.length ? (
                        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                          {p.media.map((m) => (
                            <div key={m.id} className="h-20 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                              <img src={resolveMediaUrl(m.url) || ""} alt={p.name} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-white/60">Sin fotos todavía.</div>
                      )}
                    </div>
                  </div>
                ))}
                {!products.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no tienes productos.</div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="galeria" className="mt-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Galería</h2>
                  <p className="text-xs text-white/60">Fotos destacadas para tu perfil público.</p>
                </div>
                <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer">
                  Subir fotos
                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadGallery(e.target.files)} />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {gallery.map((g) => (
                  <div key={g.id} className="relative h-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <img src={resolveMediaUrl(g.url) || ""} alt="Galería" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeGalleryItem(g.id)}
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px]"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                {!gallery.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no hay fotos en tu galería.</div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ubicacion" className="mt-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold">Ubicación</h2>
              <p className="mt-1 text-xs text-white/60">Mantén tu dirección actualizada para aparecer en mapas y búsquedas cercanas.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-xs text-white/60">
                  Dirección
                  <input className="input" placeholder="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <label className="grid gap-2 text-xs text-white/60">
                  Ciudad
                  <input className="input" placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
              </div>
              <button disabled={busy} onClick={saveProfile} className="mt-4 rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50">
                Guardar ubicación
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {toast ? (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${toast.tone === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
          {toast.message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      ) : null}
    </div>
  );
}
