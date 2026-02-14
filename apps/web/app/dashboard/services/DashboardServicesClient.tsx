"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import Avatar from "../../../components/Avatar";
import MapboxMap from "../../../components/MapboxMap";

type ServiceMedia = { id: string; url: string; type: "IMAGE" | "VIDEO" };

type ServiceItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  categoryId?: string | null;
  price?: number | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  approxAreaM?: number | null;
  locationVerified?: boolean;
  isActive: boolean;
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
  shopCategory?: { id: string; slug: string; name: string } | null;
};

type ShopCategory = { id: string; name: string; slug: string };

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

export default function DashboardServicesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [tab, setTab] = useState("perfil");
  const [categories, setCategories] = useState<Category[]>([]);
  const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);
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
  const [serviceAddress, setServiceAddress] = useState("");
  const [serviceLatitude, setServiceLatitude] = useState("");
  const [serviceLongitude, setServiceLongitude] = useState("");
  const [serviceLocality, setServiceLocality] = useState("");
  const [serviceApproxArea, setServiceApproxArea] = useState("600");
  const [serviceVerified, setServiceVerified] = useState(false);
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [lastGeocoded, setLastGeocoded] = useState("");

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productPrice, setProductPrice] = useState<string>("");
  const [productStock, setProductStock] = useState<string>("0");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newShopCategory, setNewShopCategory] = useState("");
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [profileLatitude, setProfileLatitude] = useState("");
  const [profileLongitude, setProfileLongitude] = useState("");
  const [profileLocationVerified, setProfileLocationVerified] = useState(false);
  const [profileGeocodeBusy, setProfileGeocodeBusy] = useState(false);
  const [profileGeocodeError, setProfileGeocodeError] = useState<string | null>(null);
  const [lastProfileGeocoded, setLastProfileGeocoded] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const profileType = (user?.profileType ?? "CLIENT") as ProfileType;
  const role = String(user?.role || "").toUpperCase();
  const isMotelProfile = profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const labels = labelsByProfile[profileType] ?? labelsByProfile.PROFESSIONAL;
  const canManage = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(profileType);

  const kindForProfile = profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const categoryOptions = useMemo(() => categories.filter((c) => c.kind === kindForProfile), [categories, kindForProfile]);

  useEffect(() => {
    if (!categoryOptions.length) return;
    setServiceCategoryId((prev) => prev || categoryOptions[0].id);
    if (profileType === "SHOP") {
      setProductCategoryId("");
    }
  }, [categoryOptions, profileType]);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    const allowed = ["perfil", "servicios", "productos", "galeria", "ubicacion"];
    if (allowed.includes(requested)) {
      setTab(requested);
    }
  }, [searchParams]);

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
        requests.push(apiFetch<{ categories: ShopCategory[] }>("/shop/categories"));
      }

      const results = await Promise.all(requests);
      const meRes = results[0];
      const galleryRes = results[1];
      let serviceRes: { items: ServiceItem[] } | undefined;
      let productRes: { products: Product[] } | undefined;
      let shopCategoryRes: { categories: ShopCategory[] } | undefined;
      let idx = 2;
      if (profileType !== "SHOP") {
        serviceRes = results[idx] as { items: ServiceItem[] };
        idx += 1;
      }
      if (profileType === "SHOP") {
        productRes = results[idx] as { products: Product[] };
        idx += 1;
        shopCategoryRes = results[idx] as { categories: ShopCategory[] };
      }
      setGallery(galleryRes?.media ?? []);
      setDisplayName(meRes?.user?.displayName ?? "");
      setBio(stripAge(meRes?.user?.bio));
      setBirthdate(toDateInputValue(meRes?.user?.birthdate));
      setServiceDescription(meRes?.user?.serviceDescription ?? "");
      setGender(meRes?.user?.gender || "FEMALE");
      setAddress(meRes?.user?.address || "");
      setCity(meRes?.user?.city || "");
      const loadedLatitude = meRes?.user?.latitude != null ? String(meRes?.user?.latitude) : "";
      const loadedLongitude = meRes?.user?.longitude != null ? String(meRes?.user?.longitude) : "";
      setProfileLatitude(loadedLatitude);
      setProfileLongitude(loadedLongitude);
      setProfileLocationVerified(Boolean(loadedLatitude && loadedLongitude));

      if (profileType !== "SHOP") {
        setItems(serviceRes?.items ?? []);
      }
      if (profileType === "SHOP") {
        setProducts(productRes?.products ?? []);
        setShopCategories(shopCategoryRes?.categories ?? []);
      }
    } catch {
      setError("No se pudieron cargar tus datos del panel.");
    }
  }

  useEffect(() => {
    if (!loading && user?.id) loadPanel(user.id);
  }, [loading, user?.id]);

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
  };

  const geocodeAddress = async (override?: string, silent = false) => {
    const addressQuery = (override ?? serviceAddress).trim();
    if (!addressQuery) {
      if (!silent) setGeocodeError("Ingresa una dirección para buscar en el mapa.");
      return;
    }
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) {
      if (!silent) setGeocodeError("Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.");
      return;
    }
    setGeocodeBusy(true);
    if (!silent) setGeocodeError(null);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`
      );
      if (!res.ok) throw new Error("GEOCODE_FAILED");
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature?.center) throw new Error("NO_RESULTS");
      setServiceLongitude(String(feature.center[0]));
      setServiceLatitude(String(feature.center[1]));
      if (feature.place_name) setServiceAddress(feature.place_name);
      const contexts: Array<{ id: string; text: string }> = feature.context || [];
      const locality =
        contexts.find((c) => c.id.includes("neighborhood"))?.text ||
        contexts.find((c) => c.id.includes("locality"))?.text ||
        contexts.find((c) => c.id.includes("place"))?.text ||
        "";
      setServiceLocality(locality);
      setServiceVerified(true);
      setGeocodeError(null);
      setLastGeocoded(addressQuery);
    } catch {
      if (!silent) setGeocodeError("No encontramos esa dirección. Ajusta el texto o intenta nuevamente.");
    } finally {
      setGeocodeBusy(false);
    }
  };


  const geocodeProfileAddress = async (override?: string, silent = false) => {
    const addressQuery = (override ?? address).trim();
    if (!addressQuery) {
      if (!silent) setProfileGeocodeError("Ingresa una dirección para buscar en el mapa.");
      return;
    }
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) {
      if (!silent) setProfileGeocodeError("Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.");
      return;
    }

    setProfileGeocodeBusy(true);
    if (!silent) setProfileGeocodeError(null);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`
      );
      if (!res.ok) throw new Error("GEOCODE_FAILED");
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature?.center) throw new Error("NO_RESULTS");

      setProfileLongitude(String(feature.center[0]));
      setProfileLatitude(String(feature.center[1]));
      if (feature.place_name) setAddress(feature.place_name);

      const contexts: Array<{ id: string; text: string }> = feature.context || [];
      const locality =
        contexts.find((c) => c.id.includes("neighborhood"))?.text ||
        contexts.find((c) => c.id.includes("locality"))?.text ||
        contexts.find((c) => c.id.includes("place"))?.text ||
        "";
      if (locality) setCity(locality);

      setProfileLocationVerified(true);
      setProfileGeocodeError(null);
      setLastProfileGeocoded(addressQuery);
    } catch {
      if (!silent) setProfileGeocodeError("No encontramos esa dirección. Ajusta el texto o intenta nuevamente.");
    } finally {
      setProfileGeocodeBusy(false);
    }
  };

  useEffect(() => {
    const trimmed = serviceAddress.trim();
    if (!trimmed) return;
    if (trimmed.length < 6) return;
    if (trimmed === lastGeocoded) return;
    const timer = setTimeout(() => {
      geocodeAddress(trimmed, true);
    }, 550);
    return () => clearTimeout(timer);
  }, [serviceAddress, lastGeocoded]);

  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 6) return;
    if (trimmed === lastProfileGeocoded) return;
    const timer = setTimeout(() => {
      geocodeProfileAddress(trimmed, true);
    }, 550);
    return () => clearTimeout(timer);
  }, [address, lastProfileGeocoded]);

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    if (profileType === "SHOP") {
      if (!address.trim() || !profileLocationVerified) {
        setError("Debes confirmar la ubicación en el mapa para tu tienda.");
        setBusy(false);
        return;
      }
      const parsedLat = Number(profileLatitude);
      const parsedLng = Number(profileLongitude);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        setError("Debes confirmar la ubicación en el mapa para tu tienda.");
        setBusy(false);
        return;
      }
    }
    try {
      const payload: Record<string, any> = {
        displayName,
        bio,
        serviceDescription,
        gender,
        address,
        city,
        latitude: profileLatitude ? Number(profileLatitude) : null,
        longitude: profileLongitude ? Number(profileLongitude) : null
      };
      if (birthdate) payload.birthdate = birthdate;
      await apiFetch("/profile", { method: "PATCH", body: JSON.stringify(payload) });
      showToast("Perfil actualizado.");
      loadPanel(user.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveService = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    if (!serviceAddress.trim() || !serviceVerified) {
      setError("Debes confirmar la ubicación en el mapa antes de publicar.");
      setBusy(false);
      return;
    }
    const parsedLat = Number(serviceLatitude);
    const parsedLng = Number(serviceLongitude);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError("Debes confirmar la ubicación en el mapa antes de publicar.");
      setBusy(false);
      return;
    }
    try {
      const payload = {
        title,
        description,
        price: price ? Number(price) : null,
        categoryId: serviceCategoryId,
        addressLabel: serviceAddress.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        locality: serviceLocality || null,
        approxAreaM: Number(serviceApproxArea) || null,
        locationVerified: true,
        isActive: serviceIsActive
      };
      if (editingServiceId) {
        await apiFetch(`/services/items/${editingServiceId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showToast("Servicio actualizado.");
      } else {
        await apiFetch("/services/items", { method: "POST", body: JSON.stringify(payload) });
        showToast("Servicio creado.");
      }
      setTitle("");
      setDescription("");
      setPrice("");
      setEditingServiceId(null);
      setServiceAddress("");
      setServiceLatitude("");
      setServiceLongitude("");
      setServiceLocality("");
      setServiceApproxArea("600");
      setServiceVerified(false);
      setServiceIsActive(true);
      setGeocodeError(null);
      loadPanel(user.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeService = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/services/items/${id}`, { method: "DELETE" });
      showToast("Servicio eliminado.");
      if (user?.id) loadPanel(user.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startEditService = (item: ServiceItem) => {
    setTitle(item.title);
    setDescription(item.description || "");
    setPrice(item.price != null ? String(item.price) : "");
    setServiceCategoryId(item.categoryId || "");
    setServiceAddress(item.address || "");
    setServiceLatitude(item.latitude != null ? String(item.latitude) : "");
    setServiceLongitude(item.longitude != null ? String(item.longitude) : "");
    setServiceLocality(item.locality || "");
    setServiceApproxArea(item.approxAreaM != null ? String(item.approxAreaM) : "600");
    setServiceVerified(Boolean(item.locationVerified || (item.latitude != null && item.longitude != null)));
    setServiceIsActive(item.isActive ?? true);
    setGeocodeError(null);
    setEditingServiceId(item.id);
    setTab("servicios");
  };

  const uploadProfileImage = async (type: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const form = new FormData();
    form.append("file", file);
    if (type === "avatar") setAvatarUploading(true);
    if (type === "cover") setCoverUploading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/profile/${type}`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      const data = await res.json();
      if (type === "avatar") setAvatarPreview(data?.avatarUrl ?? null);
      if (type === "cover") setCoverPreview(data?.coverUrl ?? null);
      showToast("Imagen actualizada.");
      loadPanel(user.id);
    } catch {
      setError("No se pudo actualizar la imagen.");
    } finally {
      if (type === "avatar") setAvatarUploading(false);
      if (type === "cover") setCoverUploading(false);
    }
  };

  const uploadGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length || !user) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    setBusy(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/profile/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      showToast("Fotos agregadas.");
      loadPanel(user.id);
    } catch {
      setError("No se pudo subir la galería.");
    } finally {
      setBusy(false);
    }
  };

  const removeGalleryItem = async (id: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await apiFetch(`/profile/media/${id}`, { method: "DELETE" });
      showToast("Foto eliminada.");
      loadPanel(user.id);
    } catch {
      setError("No se pudo eliminar la foto.");
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: productName,
        description: productDescription,
        price: productPrice ? Number(productPrice) : 0,
        stock: productStock ? Number(productStock) : 0,
        shopCategoryId: productCategoryId,
        isActive: true
      };
      if (editingProductId) {
        await apiFetch(`/shop/products/${editingProductId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showToast("Producto actualizado.");
      } else {
        await apiFetch("/shop/products", { method: "POST", body: JSON.stringify(payload) });
        showToast("Producto creado.");
      }
      setProductName("");
      setProductDescription("");
      setProductPrice("");
      setProductStock("0");
      setEditingProductId(null);
      loadPanel(user.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/shop/products/${id}`, { method: "DELETE" });
      showToast("Producto eliminado.");
      if (user?.id) loadPanel(user.id);
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startEditProduct = (item: Product) => {
    setProductName(item.name);
    setProductDescription(item.description || "");
    setProductPrice(String(item.price || ""));
    setProductStock(String(item.stock || ""));
    setProductCategoryId(item.shopCategory?.id || "");
    setEditingProductId(item.id);
    setTab("productos");
  };

  const createShopCategory = async () => {
    if (!newShopCategory.trim()) return;
    try {
      await apiFetch("/shop/categories", { method: "POST", body: JSON.stringify({ name: newShopCategory.trim() }) });
      setNewShopCategory("");
      if (user?.id) loadPanel(user.id);
      showToast("Categoría creada.");
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  };

  const removeShopCategory = async (id: string) => {
    try {
      await apiFetch(`/shop/categories/${id}`, { method: "DELETE" });
      if (user?.id) loadPanel(user.id);
      showToast("Categoría eliminada.");
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    }
  };

  const uploadProductMedia = async (productId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    setUploadingProductId(productId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/shop/products/${productId}/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      if (user?.id) loadPanel(user.id);
      showToast("Fotos del producto actualizadas.");
    } catch {
      setError("No se pudieron subir las fotos del producto.");
    } finally {
      setUploadingProductId(null);
    }
  };

  const removeProductMedia = async (mediaId: string) => {
    try {
      await apiFetch(`/shop/products/media/${mediaId}`, { method: "DELETE" });
      if (user?.id) loadPanel(user.id);
      showToast("Foto eliminada del producto.");
    } catch {
      setError("No se pudo eliminar la foto.");
    }
  };

  const startPublish = () => router.push("/dashboard");

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!canManage) return <div className="p-6 text-white/70">Este panel es solo para experiencias, lugares y tiendas.</div>;
  if (isMotelProfile) {
    return (
      <div className="card p-6 space-y-3">
        <h1 className="text-xl font-semibold">Gestión centralizada en Panel Motel</h1>
        <p className="text-sm text-white/70">
          Tu perfil está configurado como Motel/Hotel. Para mantener un flujo coherente, toda la administración
          de perfil, habitaciones, reservas, promociones y ubicación se realiza desde el panel dedicado.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/motel" className="btn-primary">Ir al Panel Motel</Link>
          <Link href="/cuenta" className="btn-secondary">Volver a cuenta</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "perfil", label: "Perfil público" },
    ...(profileType !== "SHOP" ? [{ key: "servicios", label: "Servicios" }] : []),
    ...(profileType === "SHOP" ? [{ key: "productos", label: "Productos" }] : []),
    { key: "galeria", label: "Galería" },
    { key: "ubicacion", label: "Ubicación" }
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 text-white">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{labels.panel}</h1>
              <Badge>{profileType === "PROFESSIONAL" ? "Experiencia" : profileType === "SHOP" ? "Tienda" : "Proveedor"}</Badge>
            </div>
            <p className="mt-1 text-sm text-white/60">{labels.helper}</p>
          </div>
          <Link href="/cuenta" className="btn-ghost w-fit text-sm">Volver a cuenta</Link>
        </div>
      </div>

      {/* Tabs panel */}
      <div className="card p-5 sm:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {/* ── Perfil ── */}
          <TabsContent value="perfil" className="mt-6 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Perfil público</h2>
              <p className="mt-1 text-xs text-white/60">Información visible para clientes y buscadores.</p>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Nombre visible
                  <input className="input" placeholder="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Género
                    <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="FEMALE">Mujer</option>
                      <option value="MALE">Hombre</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Fecha de nacimiento
                    <input
                      className="input"
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      required
                    />
                    <span className="text-[11px] text-white/40">Debes ser mayor de 18 años.</span>
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Descripción general
                  <textarea className="input min-h-[100px]" placeholder="Descripción" value={bio} onChange={(e) => setBio(e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Descripción de servicios
                  <textarea className="input min-h-[100px]" placeholder="Describe tu oferta" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} />
                </label>
                <button disabled={busy} onClick={saveProfile} className="btn-primary w-full sm:w-fit">
                  Guardar perfil
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Imagen de perfil y portada</h2>
              <p className="mt-1 text-xs text-white/60">Actualiza tus imágenes con vista previa inmediata.</p>
              <div className="mt-5 grid gap-5">
                <div className="flex items-center gap-4">
                  <Avatar src={avatarPreview || user.avatarUrl} alt={user.displayName || user.username} size={72} />
                  <div>
                    <label className="btn-secondary cursor-pointer text-sm">
                      {avatarUploading ? "Subiendo..." : "Subir foto de perfil"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e)} />
                    </label>
                    <div className="mt-1.5 text-xs text-white/40">JPG o PNG recomendado.</div>
                  </div>
                </div>
                <div>
                  <div className="h-36 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {coverPreview || user.coverUrl ? (
                      <img src={resolveMediaUrl(coverPreview || user.coverUrl) ?? undefined} alt="Portada" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-white/40">Sube una imagen de portada</div>
                    )}
                  </div>
                  <label className="mt-3 btn-secondary cursor-pointer text-sm inline-flex">
                    {coverUploading ? "Subiendo..." : "Subir portada"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e)} />
                  </label>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Servicios ── */}
          <TabsContent value="servicios" className="mt-6 space-y-5">
            {/* Active services list */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Servicios activos</h2>
              <p className="mt-1 text-xs text-white/60">{labels.listTitle}</p>
              <div className="mt-4 grid gap-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{item.title}</span>
                          <Badge className={item.isActive ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100" : ""}>
                            {item.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-white/60 line-clamp-2">{item.description || "Sin descripción"}</p>
                        <p className="mt-1 text-xs text-white/50">{categoryLabel(item.categoryRel)} · ${item.price ?? "0"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditService(item)} className="btn-ghost px-3 py-1.5 text-xs">Editar</button>
                        <button onClick={() => removeService(item.id)} className="btn-ghost px-3 py-1.5 text-xs text-red-300 hover:text-red-200">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
                {!items.length && <p className="py-4 text-center text-sm text-white/50">Aún no tienes servicios publicados.</p>}
              </div>
            </div>

            {/* New / edit service form */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">{editingServiceId ? "Editar servicio" : "Nuevo servicio"}</h2>
              <p className="mt-1 text-xs text-white/60">Completa los datos para publicar.</p>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Título del servicio
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Descripción
                  <textarea className="input min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Categoría
                    <select className="input" value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)}>
                      <option value="">Selecciona una categoría</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName || c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Precio
                    <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" />
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Dirección
                  <input
                    className="input"
                    value={serviceAddress}
                    onChange={(e) => {
                      setServiceAddress(e.target.value);
                      setServiceVerified(false);
                    }}
                    placeholder="Ej: Av. Providencia 1234, Santiago"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => geocodeAddress()}
                    disabled={geocodeBusy}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    {geocodeBusy ? "Buscando..." : "Reintentar búsqueda"}
                  </button>
                  <span className="text-[11px] text-white/40">Buscamos automáticamente mientras escribes.</span>
                </div>
                {geocodeError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {geocodeError}
                  </div>
                )}
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Área aproximada
                  <select className="input" value={serviceApproxArea} onChange={(e) => setServiceApproxArea(e.target.value)}>
                    <option value="300">300 m</option>
                    <option value="450">450 m</option>
                    <option value="600">600 m</option>
                    <option value="800">800 m</option>
                  </select>
                  <span className="text-[11px] text-white/40">La ubicación se muestra como área aproximada.</span>
                </label>
                {serviceVerified && Number.isFinite(Number(serviceLatitude)) && Number.isFinite(Number(serviceLongitude)) ? (
                  <MapboxMap
                    markers={[
                      {
                        id: "service-location",
                        name: title || "Servicio",
                        lat: Number(serviceLatitude),
                        lng: Number(serviceLongitude),
                        subtitle: serviceLocality || serviceAddress || null,
                        areaRadiusM: Number(serviceApproxArea) || 600
                      }
                    ]}
                    height={220}
                    className="rounded-xl"
                  />
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/50 text-center">
                    Busca y confirma la dirección para previsualizar en el mapa.
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="checkbox"
                    checked={serviceIsActive}
                    onChange={(e) => setServiceIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-fuchsia-500"
                  />
                  Servicio activo (solo uno puede quedar activo)
                </label>
                <button disabled={busy || !serviceVerified} onClick={saveService} className="btn-primary w-full sm:w-fit">
                  {editingServiceId ? "Guardar cambios" : "Publicar servicio"}
                </button>
                {!serviceVerified && (
                  <p className="text-[11px] text-amber-200">Confirma la dirección en el mapa para habilitar la publicación.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Productos ── */}
          <TabsContent value="productos" className="mt-6 space-y-5">
            {/* Shop categories */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Categorías de tu tienda</h2>
              <p className="mt-1 text-xs text-white/60">Créalas y adminístralas antes de asignarlas a tus productos.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input className="input flex-1" placeholder="Ej: Juguetes premium" value={newShopCategory} onChange={(e) => setNewShopCategory(e.target.value)} />
                <button type="button" onClick={createShopCategory} className="btn-secondary w-full sm:w-auto whitespace-nowrap">Crear categoría</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {shopCategories.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => removeShopCategory(cat.id)} className="uzeed-pill px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition">
                    {cat.name} ✕
                  </button>
                ))}
                {!shopCategories.length && <p className="text-xs text-white/40">Aún no has creado categorías para tu tienda.</p>}
              </div>
            </div>

            {/* Products list */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Productos activos</h2>
              <p className="mt-1 text-xs text-white/60">{labels.listTitle}</p>
              <div className="mt-4 grid gap-3">
                {products.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{item.name}</div>
                        <p className="mt-1 text-xs text-white/60 line-clamp-2">{item.description || "Sin descripción"}</p>
                        <p className="mt-1 text-xs text-white/50">{item.shopCategory?.name || "Sin categoría"} · ${item.price} · Stock {item.stock}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-ghost px-3 py-1.5 text-xs cursor-pointer">
                          {uploadingProductId === item.id ? "Subiendo..." : "Subir fotos"}
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadProductMedia(item.id, e)} />
                        </label>
                        <button onClick={() => startEditProduct(item)} className="btn-ghost px-3 py-1.5 text-xs">Editar</button>
                        <button onClick={() => removeProduct(item.id)} className="btn-ghost px-3 py-1.5 text-xs text-red-300 hover:text-red-200">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
                {!products.length && <p className="py-4 text-center text-sm text-white/50">Aún no tienes productos publicados.</p>}
              </div>
            </div>

            {/* New / edit product form */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">{editingProductId ? "Editar producto" : "Nuevo producto"}</h2>
              <p className="mt-1 text-xs text-white/60">Completa los datos para publicar.</p>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Nombre
                  <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Descripción
                  <textarea className="input min-h-[100px]" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Categoría
                  <select className="input" value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
                    <option value="">Selecciona una categoría de tu tienda</option>
                    {shopCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Precio
                    <input className="input" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} type="number" min="0" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Stock
                    <input className="input" value={productStock} onChange={(e) => setProductStock(e.target.value)} type="number" min="0" />
                  </label>
                </div>
                <button disabled={busy} onClick={saveProduct} className="btn-primary w-full sm:w-fit">
                  {editingProductId ? "Guardar cambios" : "Publicar producto"}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* ── Galería ── */}
          <TabsContent value="galeria" className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Galería</h2>
                  <p className="text-xs text-white/60">Fotos visibles en tu perfil público.</p>
                </div>
                <label className="btn-secondary cursor-pointer text-sm w-fit">
                  Subir fotos
                  <input type="file" accept="image/*" className="hidden" multiple onChange={uploadGallery} />
                </label>
              </div>
              <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3">
                {gallery.map((g) => (
                  <div key={g.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <div className="aspect-square overflow-hidden">
                      <img src={resolveMediaUrl(g.url) ?? undefined} alt="Galería" className="h-full w-full object-cover" />
                    </div>
                    <button onClick={() => removeGalleryItem(g.id)} className="absolute bottom-0 inset-x-0 bg-black/60 py-2 text-center text-xs text-white/80 opacity-0 group-hover:opacity-100 transition">
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
              {!gallery.length && <p className="mt-4 text-center text-sm text-white/50">Aún no tienes fotos en tu galería.</p>}
            </div>
          </TabsContent>

          {/* ── Ubicación ── */}
          <TabsContent value="ubicacion" className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Ubicación</h2>
              <p className="text-xs text-white/60">Actualiza tu dirección y ciudad.</p>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Dirección
                  <input
                    className="input"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (profileType === "SHOP") setProfileLocationVerified(false);
                    }}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-white/60">
                  Ciudad
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Latitud
                    <input
                      className="input"
                      value={profileLatitude}
                      onChange={(e) => {
                        setProfileLatitude(e.target.value);
                        if (profileType === "SHOP") setProfileLocationVerified(false);
                      }}
                      placeholder="-33.45"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-white/60">
                    Longitud
                    <input
                      className="input"
                      value={profileLongitude}
                      onChange={(e) => {
                        setProfileLongitude(e.target.value);
                        if (profileType === "SHOP") setProfileLocationVerified(false);
                      }}
                      placeholder="-70.66"
                    />
                  </label>
                </div>
                {profileType === "SHOP" && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => geocodeProfileAddress()}
                        disabled={profileGeocodeBusy}
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        {profileGeocodeBusy ? "Buscando..." : "Verificar dirección en mapa"}
                      </button>
                      <span className="text-[11px] text-white/40">Buscamos automáticamente mientras escribes.</span>
                    </div>
                    {profileGeocodeError && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                        {profileGeocodeError}
                      </div>
                    )}
                    {profileLocationVerified && Number.isFinite(Number(profileLatitude)) && Number.isFinite(Number(profileLongitude)) ? (
                      <MapboxMap
                        markers={[
                          {
                            id: "profile-location",
                            name: displayName || user?.username || "Tienda",
                            lat: Number(profileLatitude),
                            lng: Number(profileLongitude),
                            subtitle: city || address || null
                          }
                        ]}
                        height={220}
                        className="rounded-xl"
                      />
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/50 text-center">
                        Verifica la dirección en el mapa para que tu tienda aparezca correctamente.
                      </div>
                    )}
                  </>
                )}
                <button disabled={busy} onClick={saveProfile} className="btn-primary w-full sm:w-fit">
                  Guardar ubicación
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${toast.tone === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-red-400/40 bg-red-500/10 text-red-100"}`}>
          {toast.message}
        </div>
      )}

      {profileType === "VIEWER" && (
        <div className="card p-6">
          <p className="font-medium">¿Quieres publicar?</p>
          <p className="mt-1 text-sm text-white/60">Cambia tu tipo de perfil o inicia publicación desde el dashboard.</p>
          <button onClick={startPublish} className="btn-primary mt-4">
            Ir al dashboard
          </button>
        </div>
      )}
    </div>
  );
}
