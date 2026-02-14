"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useReducer, useRef } from "react";

/* ─── Shared types (mirrored from DashboardServicesClient) ─── */
export type ServiceMedia = { id: string; url: string; type: "IMAGE" | "VIDEO" };

export type ServiceItem = {
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

export type ProductMedia = { id: string; url: string; pos: number };

export type Product = {
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

export type ShopCategory = { id: string; name: string; slug: string };
export type ProfileMedia = { id: string; url: string; type: string };

export type Category = {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
};

export type ProfileType = "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" | "CREATOR" | "VIEWER" | "CLIENT";

/* ─── Form state ─── */
export type DashboardFormState = {
  /* Profile fields (dirty-tracked) */
  displayName: string;
  bio: string;
  serviceDescription: string;
  birthdate: string;
  gender: string;
  address: string;
  city: string;
  profileLatitude: string;
  profileLongitude: string;

  /* Profile non-dirty-tracked */
  profileLocationVerified: boolean;
  avatarPreview: string | null;
  coverPreview: string | null;
  avatarUploading: boolean;
  coverUploading: boolean;

  /* Service form */
  title: string;
  description: string;
  serviceCategoryId: string;
  price: string;
  serviceAddress: string;
  serviceLatitude: string;
  serviceLongitude: string;
  serviceLocality: string;
  serviceApproxArea: string;
  serviceVerified: boolean;
  serviceIsActive: boolean;
  editingServiceId: string | null;
  geocodeBusy: boolean;
  geocodeError: string | null;
  lastGeocoded: string;

  /* Product form */
  productName: string;
  productDescription: string;
  productCategoryId: string;
  productPrice: string;
  productStock: string;
  editingProductId: string | null;
  newShopCategory: string;
  uploadingProductId: string | null;

  /* Profile geocoding */
  profileGeocodeBusy: boolean;
  profileGeocodeError: string | null;
  lastProfileGeocoded: string;

  /* Loaded data */
  items: ServiceItem[];
  products: Product[];
  gallery: ProfileMedia[];
  categories: Category[];
  shopCategories: ShopCategory[];

  /* UI */
  tab: string;
  busy: boolean;
  error: string | null;
  toast: { tone: "success" | "error"; message: string } | null;
};

export const INITIAL_STATE: DashboardFormState = {
  displayName: "",
  bio: "",
  serviceDescription: "",
  birthdate: "",
  gender: "FEMALE",
  address: "",
  city: "",
  profileLatitude: "",
  profileLongitude: "",
  profileLocationVerified: false,
  avatarPreview: null,
  coverPreview: null,
  avatarUploading: false,
  coverUploading: false,
  title: "",
  description: "",
  serviceCategoryId: "",
  price: "",
  serviceAddress: "",
  serviceLatitude: "",
  serviceLongitude: "",
  serviceLocality: "",
  serviceApproxArea: "600",
  serviceVerified: false,
  serviceIsActive: true,
  editingServiceId: null,
  geocodeBusy: false,
  geocodeError: null,
  lastGeocoded: "",
  productName: "",
  productDescription: "",
  productCategoryId: "",
  productPrice: "",
  productStock: "0",
  editingProductId: null,
  newShopCategory: "",
  uploadingProductId: null,
  profileGeocodeBusy: false,
  profileGeocodeError: null,
  lastProfileGeocoded: "",
  items: [],
  products: [],
  gallery: [],
  categories: [],
  shopCategories: [],
  tab: "perfil",
  busy: false,
  error: null,
  toast: null,
};

/* ─── Reducer ─── */
type Action =
  | { type: "SET_FIELD"; key: keyof DashboardFormState; value: any }
  | { type: "SET_MANY"; fields: Partial<DashboardFormState> }
  | { type: "RESET_SERVICE_FORM" }
  | { type: "RESET_PRODUCT_FORM" };

function reducer(state: DashboardFormState, action: Action): DashboardFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.key]: action.value };
    case "SET_MANY":
      return { ...state, ...action.fields };
    case "RESET_SERVICE_FORM":
      return {
        ...state,
        title: "",
        description: "",
        price: "",
        editingServiceId: null,
        serviceAddress: "",
        serviceLatitude: "",
        serviceLongitude: "",
        serviceLocality: "",
        serviceApproxArea: "600",
        serviceVerified: false,
        serviceIsActive: true,
        geocodeError: null,
      };
    case "RESET_PRODUCT_FORM":
      return {
        ...state,
        productName: "",
        productDescription: "",
        productPrice: "",
        productStock: "0",
        editingProductId: null,
      };
    default:
      return state;
  }
}

/* ─── Dirty tracking ─── */
const DIRTY_TRACKED_KEYS = [
  "displayName",
  "bio",
  "serviceDescription",
  "birthdate",
  "gender",
  "address",
  "city",
  "profileLatitude",
  "profileLongitude",
] as const;

type DirtySnapshot = Record<(typeof DIRTY_TRACKED_KEYS)[number], string>;

function captureSnapshot(state: DashboardFormState): DirtySnapshot {
  const snap = {} as DirtySnapshot;
  for (const key of DIRTY_TRACKED_KEYS) {
    snap[key] = state[key] as string;
  }
  return snap;
}

function computeIsDirty(state: DashboardFormState, snapshot: DirtySnapshot | null): boolean {
  if (!snapshot) return false;
  return DIRTY_TRACKED_KEYS.some((key) => (state[key] as string) !== snapshot[key]);
}

function computeDirtyFields(state: DashboardFormState, snapshot: DirtySnapshot | null): Set<string> {
  if (!snapshot) return new Set();
  const dirty = new Set<string>();
  for (const key of DIRTY_TRACKED_KEYS) {
    if ((state[key] as string) !== snapshot[key]) dirty.add(key);
  }
  return dirty;
}

/* ─── Context ─── */
export type DashboardFormContextValue = {
  state: DashboardFormState;
  setField: <K extends keyof DashboardFormState>(key: K, value: DashboardFormState[K]) => void;
  setMany: (fields: Partial<DashboardFormState>) => void;
  resetServiceForm: () => void;
  resetProductForm: () => void;
  isDirty: boolean;
  dirtyFields: Set<string>;
  markSaved: () => void;
  resetToSaved: () => void;
};

export const DashboardFormContext = createContext<DashboardFormContextValue | null>(null);

export function useDashboardForm(): DashboardFormContextValue {
  const ctx = useContext(DashboardFormContext);
  if (!ctx) throw new Error("useDashboardForm must be used within DashboardFormProvider");
  return ctx;
}

/* ─── Hook for orchestrator ─── */
export function useDashboardFormReducer() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const savedSnapshot = useRef<DirtySnapshot | null>(null);

  const setField = useCallback(
    <K extends keyof DashboardFormState>(key: K, value: DashboardFormState[K]) => {
      dispatch({ type: "SET_FIELD", key, value });
    },
    []
  );

  const setMany = useCallback((fields: Partial<DashboardFormState>) => {
    dispatch({ type: "SET_MANY", fields });
  }, []);

  const resetServiceForm = useCallback(() => {
    dispatch({ type: "RESET_SERVICE_FORM" });
  }, []);

  const resetProductForm = useCallback(() => {
    dispatch({ type: "RESET_PRODUCT_FORM" });
  }, []);

  const markSaved = useCallback(() => {
    savedSnapshot.current = captureSnapshot(state);
  }, [state]);

  const resetToSaved = useCallback(() => {
    if (!savedSnapshot.current) return;
    const fields: Partial<DashboardFormState> = {};
    for (const key of DIRTY_TRACKED_KEYS) {
      (fields as any)[key] = savedSnapshot.current[key];
    }
    dispatch({ type: "SET_MANY", fields });
  }, []);

  const isDirty = computeIsDirty(state, savedSnapshot.current);
  const dirtyFields = useMemo(() => computeDirtyFields(state, savedSnapshot.current), [state]);

  /* Beforeunload guard */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* Expose a way for the orchestrator to set the snapshot directly */
  const setSavedSnapshot = useCallback((snap: DirtySnapshot) => {
    savedSnapshot.current = snap;
  }, []);

  return {
    state,
    dispatch,
    setField,
    setMany,
    resetServiceForm,
    resetProductForm,
    isDirty,
    dirtyFields,
    markSaved,
    resetToSaved,
    setSavedSnapshot,
    captureSnapshot: () => captureSnapshot(state),
  };
}
