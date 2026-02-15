export type ApiError = { error: string; details?: any };

function normalizeBase(raw: string): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed;
}

export function getApiBase(): string {
  const envBase = normalizeBase(process.env.NEXT_PUBLIC_API_URL || "");
  if (typeof window === "undefined") {
    return envBase || "http://localhost:3001";
  }

  // Browser runtime:
  // - If env not set, infer api.<root-domain>
  // - If page is https but env is http, upgrade to https to avoid mixed content on desktop.
  const pageIsHttps = window.location.protocol === "https:";
  const host = window.location.hostname.replace(/^www\./, "");
  const inferred = `https://api.${host}`;

  let base = envBase || inferred;

  if (pageIsHttps && base.startsWith("http://")) {
    base = base.replace(/^http:\/\//, "https://");
  }

  // If someone accidentally shipped localhost in prod, fall back to inferred api host.
  if (pageIsHttps && /localhost|127\.0\.0\.1/.test(base)) {
    base = inferred;
  }

  return base;
}

export const API_URL = getApiBase();

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;

  // Absolute URLs: keep as-is, but avoid mixed-content on https pages.
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return trimmed.replace(/^http:\/\//, "https://");
    }
    return trimmed;
  }

  // Web-static assets (served by Next.js) must stay on the web origin.
  // Otherwise we'll rewrite "/brand/..." to the API domain and it 404s.
  if (
    trimmed.startsWith("/brand/") ||
    trimmed.startsWith("/icons/") ||
    trimmed.startsWith("/favicon") ||
    trimmed.startsWith("/_next/")
  ) {
    return trimmed;
  }

  const base = getApiBase();

  // Normalize to /path
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  // Uploads are served by the API under /uploads/*
  if (path.startsWith("/uploads/")) return `${base}${path}`;

  // Some records may store bare filenames (e.g. "avatar.jpg")
  // Detect this from the original, non-normalized value.
  if (!trimmed.includes("/")) return `${base}/uploads/${trimmed}`;

  return `${base}${path}`;
}


function flattenValidation(details: any): string | null {
  const fieldErrors = details?.fieldErrors as Record<string, string[] | undefined> | undefined;
  if (!fieldErrors) return null;
  const messages = Object.values(fieldErrors).flatMap((arr) => arr || []);
  if (!messages.length) return null;
  return messages.join(" ");
}

export class ApiHttpError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function isAuthError(err: any): boolean {
  return Boolean(err && (err.status === 401 || err.status === 403));
}

export function friendlyErrorMessage(err: any): string {
  const status = err?.status;
  if (status === 401) return "Inicia sesión para continuar.";
  if (status === 403) return "No tienes permisos para realizar esta acción.";
  if (err?.body?.message) return err.body.message;
  const detailsMsg = flattenValidation(err?.body?.details);
  if (detailsMsg) return detailsMsg;
  const raw = err?.message || "Ocurrió un error";
  if (raw === "PROFILE_TYPE_INVALID") return "No pudimos crear tu cuenta: tipo de perfil inválido. Actualiza la página e intenta nuevamente.";
  if (raw === "CATEGORY_INVALID") return "La categoría seleccionada no existe. Actualiza la página e intenta nuevamente.";
  if (raw === "UNAUTHENTICATED") return "Inicia sesión para continuar.";
  return raw;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      // Let callers override Content-Type (e.g. FormData, file uploads)
      ...(init?.headers || {}),
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" })
    }
  });

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = { error: `HTTP_${res.status}` };
    }
    const msg = (body && (body.error || body.message)) || `HTTP_${res.status}`;
    throw new ApiHttpError(msg, res.status, body);
  }
  return (await res.json()) as T;
}
