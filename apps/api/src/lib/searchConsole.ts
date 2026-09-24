import { createSign } from "crypto";

/**
 * Cliente mínimo de Google Search Console (sólo lectura) con una cuenta de
 * servicio. Sin dependencias: el JWT se firma con crypto y se llama la API
 * REST con fetch.
 *
 * Configuración:
 *  - GSC_SERVICE_ACCOUNT_JSON: el JSON de la clave de la cuenta de servicio,
 *    tal cual o en base64. La cuenta (client_email) se agrega como usuario
 *    en Search Console → Configuración → Usuarios y permisos.
 *  - GSC_SITE_URL: la propiedad, ej. "sc-domain:uzeed.cl" (dominio) o
 *    "https://uzeed.cl/" (prefijo de URL). Por defecto sc-domain:uzeed.cl.
 *
 * El scope es webmasters.readonly: aunque la clave se filtrara, no sirve para
 * cambiar nada de la propiedad.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://www.googleapis.com/webmasters/v3";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

type ServiceAccount = { client_email: string; private_key: string };

let account: ServiceAccount | null | undefined;
let token: { value: string; expiresAt: number } | null = null;

function loadAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = (process.env.GSC_SERVICE_ACCOUNT_JSON || "").trim();
  account = null;
  if (!raw) return account;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(text);
    if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
      account = { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
    } else {
      console.warn("[gsc] GSC_SERVICE_ACCOUNT_JSON no trae client_email y private_key; Search Console queda desactivado.");
    }
  } catch {
    console.warn("[gsc] GSC_SERVICE_ACCOUNT_JSON no es un JSON válido (ni en base64); Search Console queda desactivado.");
  }
  return account;
}

export function searchConsoleConfigured(): boolean {
  return loadAccount() !== null;
}

export function searchConsoleSite(): string {
  return (process.env.GSC_SITE_URL || "sc-domain:uzeed.cl").trim();
}

/** Correo de la cuenta de servicio, para decir a quién dar acceso. */
export function searchConsoleAccountEmail(): string | null {
  return loadAccount()?.client_email ?? null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

let pending: Promise<string> | null = null;

/** Token de acceso cacheado; las llamadas en paralelo comparten la misma renovación. */
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  pending ??= fetchToken().finally(() => {
    pending = null;
  });
  return pending;
}

async function fetchToken(): Promise<string> {
  const sa = loadAccount();
  if (!sa) throw new Error("Search Console no está configurado (GSC_SERVICE_ACCOUNT_JSON).");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new GscError(`Google rechazó la cuenta de servicio: ${body.error_description || body.error || res.status}`, res.status);
  }
  token = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return token.value;
}

/** Error de Google con un mensaje que se puede mostrar (no trae secretos). */
export class GscError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    if (res.status === 403) {
      throw new GscError(
        `Sin acceso a la propiedad ${searchConsoleSite()}: agrega ${searchConsoleAccountEmail()} como usuario en Search Console (Configuración → Usuarios y permisos). Detalle: ${msg}`,
        403,
      );
    }
    throw new GscError(`Search Console respondió ${res.status}: ${msg}`, res.status);
  }
  return body as T;
}

const site = () => encodeURIComponent(searchConsoleSite());

export type GscDimension = "query" | "page" | "country" | "device" | "date" | "searchAppearance";
export type GscFilter = {
  dimension: "query" | "page" | "country" | "device" | "searchAppearance";
  operator: "contains" | "equals" | "notContains" | "notEquals" | "includingRegex" | "excludingRegex";
  expression: string;
};
export type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

export async function searchAnalytics(q: {
  startDate: string;
  endDate: string;
  dimensions?: GscDimension[];
  filters?: GscFilter[];
  type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  rowLimit?: number;
  startRow?: number;
  dataState?: "final" | "all";
}): Promise<GscRow[]> {
  const body = await call<{ rows?: GscRow[] }>(`${API}/sites/${site()}/searchAnalytics/query`, {
    method: "POST",
    body: {
      startDate: q.startDate,
      endDate: q.endDate,
      dimensions: q.dimensions ?? [],
      type: q.type ?? "web",
      rowLimit: q.rowLimit ?? 1000,
      startRow: q.startRow ?? 0,
      dataState: q.dataState ?? "all",
      ...(q.filters?.length ? { dimensionFilterGroups: [{ groupType: "and", filters: q.filters }] } : {}),
    },
  });
  return body.rows ?? [];
}

export async function listSitemaps(): Promise<any[]> {
  const body = await call<{ sitemap?: any[] }>(`${API}/sites/${site()}/sitemaps`);
  return body.sitemap ?? [];
}

export async function inspectUrl(url: string): Promise<any> {
  const body = await call<{ inspectionResult?: any }>(INSPECT_URL, {
    method: "POST",
    body: { inspectionUrl: url, siteUrl: searchConsoleSite(), languageCode: "es" },
  });
  return body.inspectionResult ?? null;
}
