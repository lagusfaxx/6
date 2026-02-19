"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
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

function normalizeCategoryText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function inferPublicationType(categoryName?: string | null) {
  const normalized = normalizeCategoryText(categoryName);
  if (normalized.includes("motel") || normalized.includes("hotel")) {
    return {
      publicationType: "space" as const,
      spaceSubtype: normalized.includes("hotel")
        ? ("hotel" as const)
        : ("motel" as const),
    };
  }
  return {
    publicationType: "experience" as const,
    spaceSubtype: "motel" as const,
  };
}

function resolveCategoryForPublication(params: {
  categories: Category[];
  publicationType: "experience" | "space";
  spaceSubtype: "motel" | "hotel";
}) {
  const { categories, publicationType, spaceSubtype } = params;
  const normalized = categories.map((c) => ({
    c,
    n: normalizeCategoryText(c.displayName || c.name),
  }));

  if (publicationType === "space") {
    const target = spaceSubtype === "hotel" ? "hotel" : "motel";
    const match = normalized.find((entry) => entry.n.includes(target));
    return match?.c.id || categories[0]?.id || "";
  }

  const hiddenDefault = normalized.find(
    (entry) => !entry.n.includes("hotel") && !entry.n.includes("motel"),
  );
  return hiddenDefault?.c.id || categories[0]?.id || "";
}

export default function DashboardServicesClient() {
  const searchParams = useSearchParams();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const form = useDashboardFormReducer();
  const {
    state,
    setField,
    setMany,
    resetServiceForm,
    resetProductForm,
    setSavedSnapshot,
    captureSnapshot,
  } = form;

  const profileType = (user?.profileType ?? "CLIENT") as ProfileType;
  const [storyText, setStoryText] = useState("");
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const role = String(user?.role || "").toUpperCase();
  const isMotelProfile =
    profileType === "ESTABLISHMENT" ||
    role === "MOTEL" ||
    role === "MOTEL_OWNER";
  const canManage = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(
    profileType,
  );

  const kindForProfile =
    profileType === "ESTABLISHMENT"
      ? "ESTABLISHMENT"
      : profileType === "SHOP"
        ? "SHOP"
        : "PROFESSIONAL";
  const categoryOptions = useMemo(
    () => state.categories.filter((c) => c.kind === kindForProfile),
    [state.categories, kindForProfile],
  );

  /* ─── Sync tab from URL ─── */
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    const allowed = [
      "perfil",
      "servicios",
      "productos",
      "galeria",
      "ubicacion",
    ];
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
    if (!state.serviceCategoryId) {
      const nextCategoryId = resolveCategoryForPublication({
        categories: categoryOptions,
        publicationType: state.publicationType,
        spaceSubtype: state.spaceSubtype,
      });
      setField("serviceCategoryId", nextCategoryId);
    }
    if (profileType === "SHOP" && state.productCategoryId === "") {
      // Keep empty for shop — user selects
    }
  }, [
    categoryOptions,
    profileType,
    state.serviceCategoryId,
    state.productCategoryId,
    state.publicationType,
    state.spaceSubtype,
    setField,
  ]);

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
          requests.push(
            apiFetch<{ items: ServiceItem[] }>(`/services/${userId}/items`),
          );
        }
        if (profileType === "SHOP") {
          requests.push(apiFetch<{ products: Product[] }>("/shop/products"));
          requests.push(
            apiFetch<{ categories: ShopCategory[] }>("/shop/categories"),
          );
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

        const loadedLatitude =
          meRes?.user?.latitude != null ? String(meRes.user.latitude) : "";
        const loadedLongitude =
          meRes?.user?.longitude != null ? String(meRes.user.longitude) : "";

        const fields = {
          gallery: galleryRes?.media ?? [],
          displayName: meRes?.user?.displayName ?? "",
          bio: stripAge(meRes?.user?.bio),
          birthdate: toDateInputValue(meRes?.user?.birthdate),
          serviceDescription: meRes?.user?.serviceDescription ?? "",
          serviceCategory: meRes?.user?.serviceCategory ?? "",
          servicesTags: Array.isArray(meRes?.user?.servicesTags) ? meRes.user.servicesTags.join(", ") : (meRes?.user?.serviceStyleTags ?? ""),
          gender: meRes?.user?.gender || "FEMALE",
          genderIdentity: meRes?.user?.genderIdentity ?? "",
          age: meRes?.user?.age != null ? String(meRes.user.age) : "",
          comuna: meRes?.user?.comuna ?? "",
          region: meRes?.user?.region ?? "",
          address: meRes?.user?.address || "",
          city: meRes?.user?.city || "",
          profileLatitude: loadedLatitude,
          profileLongitude: loadedLongitude,
          heightCm:
            meRes?.user?.heightCm != null ? String(meRes.user.heightCm) : "",
          weightKg:
            meRes?.user?.weightKg != null ? String(meRes.user.weightKg) : "",
          measurements: meRes?.user?.measurements ?? "",
          hairColor: meRes?.user?.hairColor ?? "",
          skinTone: meRes?.user?.skinTone ?? "",
          languages: meRes?.user?.languages ?? "",
          serviceStyleTags: meRes?.user?.serviceStyleTags ?? "",
          availabilityNote: meRes?.user?.availabilityNote ?? "",
          baseRate:
            meRes?.user?.baseRate != null ? String(meRes.user.baseRate) : "",
          minDurationMinutes:
            meRes?.user?.minDurationMinutes != null
              ? String(meRes.user.minDurationMinutes)
              : "",
          acceptsIncalls: Boolean(meRes?.user?.acceptsIncalls),
          acceptsOutcalls: Boolean(meRes?.user?.acceptsOutcalls),
          profileLocationVerified: Boolean(loadedLatitude && loadedLongitude),
          items:
            profileType !== "SHOP" ? (serviceRes?.items ?? []) : state.items,
          products:
            profileType === "SHOP"
              ? (productRes?.products ?? [])
              : state.products,
          shopCategories:
            profileType === "SHOP"
              ? (shopCategoryRes?.categories ?? [])
              : state.shopCategories,
        };

        setMany(fields);

        // Capture saved snapshot for dirty tracking after loading
        setTimeout(() => {
          setSavedSnapshot({
            displayName: fields.displayName,
            bio: fields.bio,
            serviceDescription: fields.serviceDescription,
            serviceCategory: fields.serviceCategory,
            servicesTags: fields.servicesTags,
            genderIdentity: fields.genderIdentity,
            age: fields.age,
            comuna: fields.comuna,
            region: fields.region,
            birthdate: fields.birthdate,
            gender: fields.gender,
            address: fields.address,
            city: fields.city,
            profileLatitude: loadedLatitude,
            profileLongitude: loadedLongitude,
            heightCm: fields.heightCm,
            weightKg: fields.weightKg,
            measurements: fields.measurements,
            hairColor: fields.hairColor,
            skinTone: fields.skinTone,
            languages: fields.languages,
            serviceStyleTags: fields.serviceStyleTags,
            availabilityNote: fields.availabilityNote,
            baseRate: fields.baseRate,
            minDurationMinutes: fields.minDurationMinutes,
          });
        }, 0);
      } catch {
        setField("error", "No se pudieron cargar tus datos del panel.");
      }
    },
    [profileType, setField, setMany, setSavedSnapshot],
  );

  useEffect(() => {
    if (!loading && user?.id) loadPanel(user.id);
  }, [loading, user?.id, loadPanel]);

  /* ─── Helpers ─── */
  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setField("toast", { message, tone });
    },
    [setField],
  );

  /* ─── Geocoding (service) ─── */
  const geocodeAddress = useCallback(
    async (override?: string, silent = false) => {
      const addressQuery = (override ?? state.serviceAddress).trim();
      if (!addressQuery) {
        if (!silent)
          setField(
            "geocodeError",
            "Ingresa una direccion para buscar en el mapa.",
          );
        return;
      }
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      if (!token) {
        if (!silent)
          setField(
            "geocodeError",
            "Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.",
          );
        return;
      }
      setField("geocodeBusy", true);
      if (!silent) setField("geocodeError", null);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`,
        );
        if (!res.ok) throw new Error("GEOCODE_FAILED");
        const data = await res.json();
        const feature = data?.features?.[0];
        if (!feature?.center) throw new Error("NO_RESULTS");
        const contexts: Array<{ id: string; text: string }> =
          feature.context || [];
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
        if (!silent)
          setField(
            "geocodeError",
            "No encontramos esa direccion. Ajusta el texto o intenta nuevamente.",
          );
      } finally {
        setField("geocodeBusy", false);
      }
    },
    [state.serviceAddress, setField, setMany],
  );

  /* ─── Geocoding (profile) ─── */
  const geocodeProfileAddress = useCallback(
    async (override?: string, silent = false) => {
      const addressQuery = (override ?? state.address).trim();
      if (!addressQuery) {
        if (!silent)
          setField(
            "profileGeocodeError",
            "Ingresa una direccion para buscar en el mapa.",
          );
        return;
      }
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      if (!token) {
        if (!silent)
          setField(
            "profileGeocodeError",
            "Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el buscador.",
          );
        return;
      }
      setField("profileGeocodeBusy", true);
      if (!silent) setField("profileGeocodeError", null);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${token}&limit=1&language=es`,
        );
        if (!res.ok) throw new Error("GEOCODE_FAILED");
        const data = await res.json();
        const feature = data?.features?.[0];
        if (!feature?.center) throw new Error("NO_RESULTS");
        const contexts: Array<{ id: string; text: string }> =
          feature.context || [];
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
        if (!silent)
          setField(
            "profileGeocodeError",
            "No encontramos esa direccion. Ajusta el texto o intenta nuevamente.",
          );
      } finally {
        setField("profileGeocodeBusy", false);
      }
    },
    [state.address, state.city, setField, setMany],
  );

  /* ─── Auto-geocode effects ─── */
  useEffect(() => {
    const trimmed = state.serviceAddress.trim();
    if (!trimmed || trimmed.length < 6 || trimmed === state.lastGeocoded)
      return;
    const timer = setTimeout(() => geocodeAddress(trimmed, true), 550);
    return () => clearTimeout(timer);
  }, [state.serviceAddress, state.lastGeocoded, geocodeAddress]);

  useEffect(() => {
    const trimmed = state.address.trim();
    if (!trimmed || trimmed.length < 6 || trimmed === state.lastProfileGeocoded)
      return;
    const timer = setTimeout(() => geocodeProfileAddress(trimmed, true), 550);
    return () => clearTimeout(timer);
  }, [state.address, state.lastProfileGeocoded, geocodeProfileAddress]);

  /* ─── Save profile ─── */
  const saveProfile = useCallback(async () => {
    if (!user) return;
    setField("busy", true);
    setField("error", null);
    if (["SHOP", "PROFESSIONAL", "ESTABLISHMENT"].includes(profileType)) {
      if (!state.address.trim() || !state.profileLocationVerified) {
        setField(
          "error",
          "Debes confirmar la ubicación de tu perfil con Mapbox para aparecer en el ecosistema.",
        );
        setField("busy", false);
        return;
      }
      const parsedLat = Number(state.profileLatitude);
      const parsedLng = Number(state.profileLongitude);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        setField(
          "error",
          "Debes confirmar la ubicación de tu perfil con Mapbox para aparecer en el ecosistema.",
        );
        setField("busy", false);
        return;
      }
    }
    try {
      const payload: Record<string, any> = {
        displayName: state.displayName,
        bio: state.bio,
        serviceDescription: state.serviceDescription,
        serviceCategory: state.serviceCategory || null,
        categoryLabel: state.serviceCategory || null,
        servicesTags: state.servicesTags ? state.servicesTags.split(",").map((x) => x.trim()).filter(Boolean) : [],
        gender: state.gender,
        genderIdentity: state.genderIdentity || null,
        age: state.age ? Number(state.age) : null,
        comuna: state.comuna || null,
        region: state.region || null,
        address: state.address,
        city: state.city,
        heightCm: state.heightCm || null,
        weightKg: state.weightKg || null,
        measurements: state.measurements || null,
        hairColor: state.hairColor || null,
        skinTone: state.skinTone || null,
        languages: state.languages || null,
        serviceStyleTags: state.serviceStyleTags || null,
        availabilityNote: state.availabilityNote || null,
        baseRate: state.baseRate || null,
        minDurationMinutes: state.minDurationMinutes || null,
        acceptsIncalls: String(state.acceptsIncalls),
        acceptsOutcalls: String(state.acceptsOutcalls),
        latitude: state.profileLatitude ? Number(state.profileLatitude) : null,
        longitude: state.profileLongitude
          ? Number(state.profileLongitude)
          : null,
        isActive: state.profileIsActive,
      };
      if (state.birthdate) payload.birthdate = state.birthdate;
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
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
    if (!state.title.trim()) {
      setField("error", "Ingresa un título para tu publicación.");
      setField("busy", false);
      return;
    }
    if (!state.serviceAddress.trim() || !state.serviceVerified) {
      setField(
        "error",
        "Debes confirmar la ubicacion en el mapa antes de publicar.",
      );
      setField("busy", false);
      return;
    }
    const parsedLat = Number(state.serviceLatitude);
    const parsedLng = Number(state.serviceLongitude);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setField(
        "error",
        "Debes confirmar la ubicacion en el mapa antes de publicar.",
      );
      setField("busy", false);
      return;
    }
    try {
      const payload = {
        title: state.title,
        description: state.description,
        price: state.price ? Number(state.price) : null,
        categoryId: resolveCategoryForPublication({
          categories: categoryOptions,
          publicationType: state.publicationType,
          spaceSubtype: state.spaceSubtype,
        }),
        addressLabel: state.serviceAddress.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        locality: state.serviceLocality || null,
        approxAreaM: Number(state.serviceApproxArea) || null,
        locationVerified: true,
        isActive: state.serviceIsActive,
        durationMinutes: state.durationMinutes
          ? Number(state.durationMinutes)
          : null,
      };
      if (state.editingServiceId) {
        await apiFetch(`/services/items/${state.editingServiceId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Servicio actualizado.");
      } else {
        await apiFetch("/services/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
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
    [user, setField, showToast, loadPanel],
  );

  /* ─── Start edit service ─── */
  const startEditService = useCallback(
    (item: ServiceItem) => {
      setMany({
        title: item.title,
        description: item.description || "",
        durationMinutes:
          item.durationMinutes != null ? String(item.durationMinutes) : "",
        price: item.price != null ? String(item.price) : "",
        serviceCategoryId: item.categoryId || "",
        ...inferPublicationType(
          item.categoryRel?.displayName ||
            item.categoryRel?.name ||
            item.category,
        ),
        serviceAddress: item.address || "",
        serviceLatitude: item.latitude != null ? String(item.latitude) : "",
        serviceLongitude: item.longitude != null ? String(item.longitude) : "",
        serviceLocality: item.locality || "",
        serviceApproxArea:
          item.approxAreaM != null ? String(item.approxAreaM) : "600",
        serviceVerified: Boolean(
          item.locationVerified ||
          (item.latitude != null && item.longitude != null),
        ),
        serviceIsActive: item.isActive ?? true,
        geocodeError: null,
        editingServiceId: item.id,
        tab: "servicios",
      });
    },
    [setMany],
  );

  /* ─── Upload profile image ─── */
  const uploadProfileImage = useCallback(
    async (type: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !user) return;

      const objectUrl = URL.createObjectURL(file);
      const previousAvatar = state.avatarPreview;
      const previousCover = state.coverPreview;
      if (type === "avatar") setField("avatarPreview", objectUrl);
      if (type === "cover") setField("coverPreview", objectUrl);

      const formData = new FormData();
      formData.append("file", file);
      if (type === "avatar") setField("avatarUploading", true);
      if (type === "cover") setField("coverUploading", true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/profile/${type}`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        const data = await res.json();
        if (type === "avatar") setField("avatarPreview", data?.avatarUrl ?? objectUrl);
        if (type === "cover") setField("coverPreview", data?.coverUrl ?? objectUrl);
        showToast("Imagen actualizada en vivo.");
        await loadPanel(user.id);
      } catch {
        if (type === "avatar") setField("avatarPreview", previousAvatar ?? null);
        if (type === "cover") setField("coverPreview", previousCover ?? null);
        setField("error", "No se pudo actualizar la imagen.");
      } finally {
        URL.revokeObjectURL(objectUrl);
        if (type === "avatar") setField("avatarUploading", false);
        if (type === "cover") setField("coverUploading", false);
        event.target.value = "";
      }
    },
    [user, state.avatarPreview, state.coverPreview, setField, showToast, loadPanel],
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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/profile/media`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        showToast("Fotos agregadas.");
        await loadPanel(user.id);
      } catch {
        setField("error", "No se pudo subir la galeria.");
      } finally {
        setField("busy", false);
      }
    },
    [user, setField, showToast, loadPanel],
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
    [user, setField, showToast, loadPanel],
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
        await apiFetch(`/shop/products/${state.editingProductId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Producto actualizado.");
      } else {
        await apiFetch("/shop/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
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
    [user, setField, showToast, loadPanel],
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
    [setMany],
  );

  /* ─── Shop categories ─── */
  const createShopCategory = useCallback(async () => {
    if (!state.newShopCategory.trim()) return;
    try {
      await apiFetch("/shop/categories", {
        method: "POST",
        body: JSON.stringify({ name: state.newShopCategory.trim() }),
      });
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
    [user, setField, showToast, loadPanel],
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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/shop/products/${productId}/media`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );
        if (!res.ok) throw new Error("UPLOAD_FAILED");
        if (user?.id) await loadPanel(user.id);
        showToast("Fotos del producto actualizadas.");
      } catch {
        setField("error", "No se pudieron subir las fotos del producto.");
      } finally {
        setField("uploadingProductId", null);
      }
    },
    [user, setField, showToast, loadPanel],
  );

  const uploadStory = useCallback(async () => {
    if (!storyFile) return;
    setStoryUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", "Historia");
      formData.append("body", storyText || "Historia publicada desde dashboard");
      formData.append("isPublic", "true");
      formData.append("price", "0");
      formData.append("files", storyFile);
      await apiFetch("/creator/posts", { method: "POST", body: formData });
      setStoryText("");
      setStoryFile(null);
      showToast("Historia subida correctamente.");
    } catch {
      setField("error", "No se pudo subir la historia.");
    } finally {
      setStoryUploading(false);
    }
  }, [storyFile, storyText, showToast, setField]);

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
    [user, setField, showToast, loadPanel],
  );

  /* ─── Guards ─── */
  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user)
    return <div className="p-6 text-white/70">Debes iniciar sesion.</div>;
  if (!canManage)
    return (
      <div className="p-6 text-white/70">
        Este panel es solo para experiencias, lugares y tiendas.
      </div>
    );
  if (isMotelProfile) {
    return (
      <div className="editor-card p-6 space-y-3 mx-auto max-w-xl mt-8">
        <h1 className="text-xl font-semibold">
          Gestion centralizada en Panel Motel
        </h1>
        <p className="text-sm text-white/60">
          Tu perfil esta configurado como Motel/Hotel. Toda la administracion se
          realiza desde el panel dedicado.
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
        <h1 className="text-xl font-semibold">
          Gestion centralizada en Panel Tienda
        </h1>
        <p className="text-sm text-white/60">
          Tu perfil esta configurado como Tienda. Toda la administracion se
          realiza desde el panel dedicado.
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
      <div className="mx-auto mb-4 max-w-6xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-base font-semibold">Historias del perfil</h2>
        <p className="mt-1 text-xs text-white/60">Sube historias rápidas visibles en portada.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input value={storyText} onChange={(e) => setStoryText(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" placeholder="Texto de historia" />
          <input type="file" accept="image/*,video/*" onChange={(e) => setStoryFile(e.target.files?.[0] || null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs" />
          <button onClick={uploadStory} disabled={!storyFile || storyUploading} className="rounded-xl bg-[#ff4b4b] px-4 py-2 text-sm font-semibold">{storyUploading ? "Subiendo..." : "Subir historia"}</button>
        </div>
      </div>

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
