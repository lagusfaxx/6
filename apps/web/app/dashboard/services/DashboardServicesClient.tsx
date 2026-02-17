"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";
import {
  DashboardFormContext,
  useDashboardFormReducer,
  type Category,
  type ServiceItem,
  type Product,
  type ProfileMedia,
  type ShopCategory,
  type ProfileType,
  type DashboardFormContextValue,
} from "../../../hooks/useDashboardForm";
import StudioLayout from "./_components/StudioLayout";

/* ─── Utilities ─── */

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

export default function DashboardServicesClient() {
  const searchParams = useSearchParams();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const form = useDashboardFormReducer();
  const { state, setField, setMany, resetServiceForm, resetProductForm, setSavedSnapshot, captureSnapshot } = form;

  const profileType = (user?.profileType ?? "CLIENT") as ProfileType;
  const role = String(user?.role || "").toUpperCase();
  const isMotelProfile = profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const canManage = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(profileType);

  const kindForProfile = profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const categoryOptions = useMemo(
    () => state.categories.filter((c) => c.kind === kindForProfile),
    [state.categories, kindForProfile]
  );

  /* ─── Sync tab from URL ─── */
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    const allowed = ["perfil", "servicios", "productos", "galeria", "ubicacion"];
    if (allowed.includes(requested)) setField("tab", requested);
  }, [searchParams, setField]);

  /* ─── Load categories ─── */
  useEffect(() => {
    if (!loading && user?.id) {
      apiFetch<Category[]>("/categories")
        .then((res) => setField("categories", Array.isArray(res) ? res : []))
        .catch(() => setField("categories", []));
    }
  }, [loading, user?.id, setField]);

  /* ─── Default category selection ─── */
  useEffect(() => {
    if (!categoryOptions.length) return;
    if (!state.serviceCategoryId) setField("serviceCategoryId", categoryOptions[0].id);
    if (profileType === "SHOP" && state.productCategoryId === "") {
      // Keep empty for shop — user selects
    }
  }, [categoryOptions, profileType, state.serviceCategoryId, state.productCategoryId, setField]);

  /* ─── Toast auto-dismiss ─── */
  useEffect(() => {
    if (state.toast) {
      const t = setTimeout(() => setField("toast", null), 4000);
      return () => clearTimeout(t);
    }
  }, [state.toast, setField]);

  /* ─── Load panel data ─── */
  const loadPanel = useCallback(
    async (userId: string) => {
      setField("error", null);
      try {
        const requests: Array<Promise<any>> = [
          apiFetch<{ user: any }>("/auth/me"),
          apiFetch<{ media: ProfileMedia[] }>("/profile/media"),
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

        const loadedLatitude = meRes?.user?.latitude != null ? String(meRes.user.latitude) : "";
        const loadedLongitude = meRes?.user?.longitude != null ? String(meRes.user.longitude) : "";

        const fields = {
          gallery: galleryRes?.media ?? [],
          displayName: meRes?.user?.displayName ?? "",
          bio: stripAge(meRes?.user?.bio),
          birthdate: toDateInputValue(meRes?.user?.birthdate),
          serviceDescription: meRes?.user?.serviceDescription ?? "",
          gender: meRes?.user?.gender || "FEMALE",
          address: meRes?.user?.address || "",
          city: meRes?.user?.city || "",
          profileLatitude: loadedLatitude,
          profileLongitude: loadedLongitude,
          profileLocationVerified: Boolean(loadedLatitude && loadedLongitude),
          items: profileType !== "SHOP" ? (serviceRes?.items ?? []) : state.items,
          products: profileType === "SHOP" ? (productRes?.products ?? []) : state.products,
          shopCategories: profileType === "SHOP" ? (shopCategoryRes?.categories ?? []) : state.shopCategories,
        };

        setMany(fields);

        // Capture saved snapshot for dirty tracking after loading
        setTimeout(() => {
          setSavedSnapshot({
            displayName: fields.displayName,
            bio: fields.bio,
            serviceDescription: fields.serviceDescription,
            birthdate: fields.birthdate,
            gender: fields.gender,
            address: fields.address,
            city: fields.city,
            profileLatitude: loadedLatitude,
            profileLongitude: loadedLongitude,
          });
        }, 0);
      } catch {
        setField("error", "No se pudieron cargar tus datos del panel.");
      }
    },
    [profileType, setField, setMany, setSavedSnapshot]
  );

  useEffect(() => {
    if (!loading && user?.id) loadPanel(user.id);
  }, [loading, user?.id, loadPanel]);

  /* ─── Helpers ─── */
  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setField("toast", { message, tone });
    },
    [setField]
  );

  /* ─── Geocoding (service) ─── */
  const geocodeAddress = useCallback(
    async (override?: string, silent = false) => {
      const addressQuery = (override ?? state.serviceAddress).trim();
      if (!addressQuery) {
        if (!silent) setField("geocodeError", "Ingresa una direccion para buscar en el mapa.");
        return;
      }
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      if (!token) {
        if (!silent) setField("geocodeError", "Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.");
        return;
      }
      setField("geocodeBusy", true);
      if (!silent) setField("geocodeError", null);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`
        );
        if (!res.ok) throw new Error("GEOCODE_FAILED");
        const data = await res.json();
        const feature = data?.features?.[0];
        if (!feature?.center) throw new Error("NO_RESULTS");
        const contexts: Array<{ id: string; text: string }> = feature.context || [];
        const locality =
          contexts.find((c) => c.id.includes("neighborhood"))?.text ||
          contexts.find((c) => c.id.includes("locality"))?.text ||
          contexts.find((c) => c.id.includes("place"))?.text ||
          "";
        setMany({
          serviceLongitude: String(feature.center[0]),
          serviceLatitude: String(feature.center[1]),
          serviceAddress: feature.place_name || state.serviceAddress,
          serviceLocality: locality,
          serviceVerified: true,
          geocodeError: null,
          lastGeocoded: addressQuery,
        });
      } catch {
        if (!silent) setField("geocodeError", "No encontramos esa direccion. Ajusta el texto o intenta nuevamente.");
      } finally {
        setField("geocodeBusy", false);
      }
    },
    [state.serviceAddress, setField, setMany]
  );

  /* ─── Geocoding (profile) ─── */
  const geocodeProfileAddress = useCallback(
    async (override?: string, silent = false) => {
      const addressQuery = (override ?? state.address).trim();
      if (!addressQuery) {
        if (!silent) setField("profileGeocodeError", "Ingresa una direccion para buscar en el mapa.");
        return;
      }
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      if (!token) {
        if (!silent) setField("profileGeocodeError", "Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.");
        return;
      }
      setField("profileGeocodeBusy", true);
      if (!silent) setField("profileGeocodeError", null);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`
        );
        if (!res.ok) throw new Error("GEOCODE_FAILED");
        const data = await res.json();
        const feature = data?.features?.[0];
        if (!feature?.center) throw new Error("NO_RESULTS");
        const contexts: Array<{ id: string; text: string }> = feature.context || [];
        const locality =
          contexts.find((c) => c.id.includes("neighborhood"))?.text ||
          contexts.find((c) => c.id.includes("locality"))?.text ||
          contexts.find((c) => c.id.includes("place"))?.text ||
          "";
        setMany({
          profileLongitude: String(feature.center[0]),
          profileLatitude: String(feature.center[1]),
          address: feature.place_name || state.address,
          city: locality || state.city,
          profileLocationVerified: true,
          profileGeocodeError: null,
          lastProfileGeocoded: addressQuery,
        });
      } catch {
        if (!silent) setField("profileGeocodeError", "No encontramos esa direccion. Ajusta el texto o intenta nuevamente.");
      } finally {
        setField("profileGeocodeBusy", false);
      }
    },
    [state.address, state.city, setField, setMany]
  );

  /* ─── Auto-geocode effects ─── */
  useEffect(() => {
    const trimmed = state.serviceAddress.trim();
    if (!trimmed || trimmed.length < 6 || trimmed === state.lastGeocoded) return;
    const timer = setTimeout(() => geocodeAddress(trimmed, true), 550);
    return () => clearTimeout(timer);
  }, [state.serviceAddress, state.lastGeocoded, geocodeAddress]);

  useEffect(() => {
    const trimmed = state.address.trim();
    if (!trimmed || trimmed.length < 6 || trimmed === state.lastProfileGeocoded) return;
    const timer = setTimeout(() => geocodeProfileAddress(trimmed, true), 550);
    return () => clearTimeout(timer);
  }, [state.address, state.lastProfileGeocoded, geocodeProfileAddress]);

  /* ─── Save profile ─── */
  const saveProfile = useCallback(async () => {
    if (!user) return;
    setField("busy", true);
    setField("error", null);
    if (profileType === "SHOP") {
      if (!state.address.trim() || !state.profileLocationVerified) {
        setField("error", "Debes confirmar la ubicacion en el mapa para tu tienda.");
        setField("busy", false);
        return;
      }
      const parsedLat = Number(state.profileLatitude);
      const parsedLng = Number(state.profileLongitude);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        setField("error", "Debes confirmar la ubicacion en el mapa para tu tienda.");
        setField("busy", false);
        return;
      }
    }
    try {
      const payload: Record<string, any> = {
        displayName: state.displayName,
        bio: state.bio,
        serviceDescription: state.serviceDescription,
        gender: state.gender,
        address: state.address,
        city: state.city,
        latitude: state.profileLatitude ? Number(state.profileLatitude) : null,
        longitude: state.profileLongitude ? Number(state.profileLongitude) : null,
      };
      if (state.birthdate) payload.birthdate = state.birthdate;
      await apiFetch("/profile", { method: "PATCH", body: JSON.stringify(payload) });
      showToast("Perfil actualizado.");
      await loadPanel(user.id);
    } catch (err: any) {
      setField("error", friendlyErrorMessage(err));
    } finally {
      setField("busy", false);
    }
  }, [user, profileType, state, setField, showToast, loadPanel]);

  /* ─── Save service ─── */
  const saveService = useCallback(async () => {
    if (!user) return;
    setField("busy", true);
    setField("error", null);
    if (!state.serviceAddress.trim() || !state.serviceVerified) {
      setField("error", "Debes confirmar la ubicacion en el mapa antes de publicar.");
      setField("busy", false);
      return;
    }
    const parsedLat = Number(state.serviceLatitude);
    const parsedLng = Number(state.serviceLongitude);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setField("error", "Debes confirmar la ubicacion en el mapa antes de publicar.");
      setField("busy", false);
      return;
    }
    try {
      const payload = {
        title: state.title,
        description: state.description,
        price: state.price ? Number(state.price) : null,
        categoryId: state.serviceCategoryId,
        addressLabel: state.serviceAddress.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        locality: state.serviceLocality || null,
        approxAreaM: Number(state.serviceApproxArea) || null,
        locationVerified: true,
        isActive: state.serviceIsActive,
      };
      if (state.editingServiceId) {
        await apiFetch(`/services/items/${state.editingServiceId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showToast("Servicio actualizado.");
      } else {
        await apiFetch("/services/items", { method: "POST", body: JSON.stringify(payload) });
        showToast("Servicio creado.");
      }
      resetServiceForm();
      await loadPanel(user.id);
    } catch (err: any) {
      setField("error", friendlyErrorMessage(err));
    } finally {
      setField("busy", false);
    }
  }, [user, state, setField, showToast, resetServiceForm, loadPanel]);

  /* ─── Remove service ─── */
  const removeService = useCallback(
    async (id: string) => {
      setField("busy", true);
      setField("error", null);
      try {
        await apiFetch(`/services/items/${id}`, { method: "DELETE" });
        showToast("Servicio eliminado.");
        if (user?.id) await loadPanel(user.id);
      } catch (err: any) {
        setField("error", friendlyErrorMessage(err));
      } finally {
        setField("busy", false);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Start edit service ─── */
  const startEditService = useCallback(
    (item: ServiceItem) => {
      setMany({
        title: item.title,
        description: item.description || "",
        price: item.price != null ? String(item.price) : "",
        serviceCategoryId: item.categoryId || "",
        serviceAddress: item.address || "",
        serviceLatitude: item.latitude != null ? String(item.latitude) : "",
        serviceLongitude: item.longitude != null ? String(item.longitude) : "",
        serviceLocality: item.locality || "",
        serviceApproxArea: item.approxAreaM != null ? String(item.approxAreaM) : "600",
        serviceVerified: Boolean(item.locationVerified || (item.latitude != null && item.longitude != null)),
        serviceIsActive: item.isActive ?? true,
        geocodeError: null,
        editingServiceId: item.id,
        tab: "servicios",
      });
    },
    [setMany]
  );

  /* ─── Upload profile image ─── */
  const uploadProfileImage = useCallback(
    async (type: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !user) return;
      const formData = new FormData();
      formData.append("file", file);
      if (type === "avatar") setField("avatarUploading", true);
      if (type === "cover") setField("coverUploading", true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/profile/${type}`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        const data = await res.json();
        if (type === "avatar") setField("avatarPreview", data?.avatarUrl ?? null);
        if (type === "cover") setField("coverPreview", data?.coverUrl ?? null);
        showToast("Imagen actualizada.");
        await loadPanel(user.id);
      } catch {
        setField("error", "No se pudo actualizar la imagen.");
      } finally {
        if (type === "avatar") setField("avatarUploading", false);
        if (type === "cover") setField("coverUploading", false);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Upload gallery ─── */
  const uploadGallery = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || !files.length || !user) return;
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      setField("busy", true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/profile/media`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        showToast("Fotos agregadas.");
        await loadPanel(user.id);
      } catch {
        setField("error", "No se pudo subir la galeria.");
      } finally {
        setField("busy", false);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Remove gallery item ─── */
  const removeGalleryItem = useCallback(
    async (id: string) => {
      if (!user) return;
      setField("busy", true);
      try {
        await apiFetch(`/profile/media/${id}`, { method: "DELETE" });
        showToast("Foto eliminada.");
        await loadPanel(user.id);
      } catch {
        setField("error", "No se pudo eliminar la foto.");
        showToast("No se pudo eliminar.", "error");
      } finally {
        setField("busy", false);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Save product ─── */
  const saveProduct = useCallback(async () => {
    if (!user) return;
    setField("busy", true);
    setField("error", null);
    try {
      const payload = {
        name: state.productName,
        description: state.productDescription,
        price: state.productPrice ? Number(state.productPrice) : 0,
        stock: state.productStock ? Number(state.productStock) : 0,
        shopCategoryId: state.productCategoryId,
        isActive: true,
      };
      if (state.editingProductId) {
        await apiFetch(`/shop/products/${state.editingProductId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showToast("Producto actualizado.");
      } else {
        await apiFetch("/shop/products", { method: "POST", body: JSON.stringify(payload) });
        showToast("Producto creado.");
      }
      resetProductForm();
      await loadPanel(user.id);
    } catch (err: any) {
      setField("error", friendlyErrorMessage(err));
    } finally {
      setField("busy", false);
    }
  }, [user, state, setField, showToast, resetProductForm, loadPanel]);

  /* ─── Remove product ─── */
  const removeProduct = useCallback(
    async (id: string) => {
      setField("busy", true);
      setField("error", null);
      try {
        await apiFetch(`/shop/products/${id}`, { method: "DELETE" });
        showToast("Producto eliminado.");
        if (user?.id) await loadPanel(user.id);
      } catch (err: any) {
        setField("error", friendlyErrorMessage(err));
      } finally {
        setField("busy", false);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Start edit product ─── */
  const startEditProduct = useCallback(
    (item: Product) => {
      setMany({
        productName: item.name,
        productDescription: item.description || "",
        productPrice: String(item.price || ""),
        productStock: String(item.stock || ""),
        productCategoryId: item.shopCategory?.id || "",
        editingProductId: item.id,
        tab: "productos",
      });
    },
    [setMany]
  );

  /* ─── Shop categories ─── */
  const createShopCategory = useCallback(async () => {
    if (!state.newShopCategory.trim()) return;
    try {
      await apiFetch("/shop/categories", { method: "POST", body: JSON.stringify({ name: state.newShopCategory.trim() }) });
      setField("newShopCategory", "");
      if (user?.id) await loadPanel(user.id);
      showToast("Categoria creada.");
    } catch (err: any) {
      setField("error", friendlyErrorMessage(err));
    }
  }, [state.newShopCategory, user, setField, showToast, loadPanel]);

  const removeShopCategory = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/shop/categories/${id}`, { method: "DELETE" });
        if (user?.id) await loadPanel(user.id);
        showToast("Categoria eliminada.");
      } catch (err: any) {
        setField("error", friendlyErrorMessage(err));
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Product media ─── */
  const uploadProductMedia = useCallback(
    async (productId: string, event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files?.length) return;
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      setField("uploadingProductId", productId);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/shop/products/${productId}/media`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        if (user?.id) await loadPanel(user.id);
        showToast("Fotos del producto actualizadas.");
      } catch {
        setField("error", "No se pudieron subir las fotos del producto.");
      } finally {
        setField("uploadingProductId", null);
      }
    },
    [user, setField, showToast, loadPanel]
  );

  const removeProductMedia = useCallback(
    async (mediaId: string) => {
      try {
        await apiFetch(`/shop/products/media/${mediaId}`, { method: "DELETE" });
        if (user?.id) await loadPanel(user.id);
        showToast("Foto eliminada del producto.");
      } catch {
        setField("error", "No se pudo eliminar la foto.");
      }
    },
    [user, setField, showToast, loadPanel]
  );

  /* ─── Guards ─── */
  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesion.</div>;
  if (!canManage) return <div className="p-6 text-white/70">Este panel es solo para experiencias, lugares y tiendas.</div>;
  if (isMotelProfile) {
    return (
      <div className="editor-card p-6 space-y-3 mx-auto max-w-xl mt-8">
        <h1 className="text-xl font-semibold">Gestion centralizada en Panel Motel</h1>
        <p className="text-sm text-white/60">
          Tu perfil esta configurado como Motel/Hotel. Toda la administracion se realiza desde el panel dedicado.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/motel" className="btn-primary">
            Ir al Panel Motel
          </Link>
          <Link href="/cuenta" className="btn-secondary">
            Volver a cuenta
          </Link>
        </div>
      </div>
    );
  }
  if (profileType === "SHOP") {
    return (
      <div className="editor-card p-6 space-y-3 mx-auto max-w-xl mt-8">
        <h1 className="text-xl font-semibold">Gestion centralizada en Panel Tienda</h1>
        <p className="text-sm text-white/60">
          Tu perfil esta configurado como Tienda. Toda la administracion se realiza desde el panel dedicado.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/shop" className="btn-primary">
            Ir al Panel Tienda
          </Link>
          <Link href="/cuenta" className="btn-secondary">
            Volver a cuenta
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Context value with all callbacks ─── */
  const contextValue: DashboardFormContextValue & Record<string, any> = {
    state,
    setField: form.setField,
    setMany: form.setMany,
    resetServiceForm: form.resetServiceForm,
    resetProductForm: form.resetProductForm,
    isDirty: form.isDirty,
    dirtyFields: form.dirtyFields,
    markSaved: form.markSaved,
    resetToSaved: form.resetToSaved,
    // Callbacks for editor panels
    onSaveService: saveService,
    onRemoveService: removeService,
    onStartEditService: startEditService,
    onGeocodeAddress: () => geocodeAddress(),
    onSaveProduct: saveProduct,
    onRemoveProduct: removeProduct,
    onStartEditProduct: startEditProduct,
    onCreateShopCategory: createShopCategory,
    onRemoveShopCategory: removeShopCategory,
    onUploadProductMedia: uploadProductMedia,
    onRemoveProductMedia: removeProductMedia,
    onUploadProfileImage: uploadProfileImage,
    onUploadGallery: uploadGallery,
    onRemoveGalleryItem: removeGalleryItem,
    onGeocodeProfileAddress: () => geocodeProfileAddress(),
  };

  return (
    <DashboardFormContext.Provider value={contextValue}>
      <StudioLayout
        user={user}
        profileType={profileType}
        loading={false}
        onSaveProfile={saveProfile}
        onResetToSaved={form.resetToSaved}
      />

      {/* Error banner */}
      {state.error && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          {state.error}
        </div>
      )}
    </DashboardFormContext.Provider>
  );
}
