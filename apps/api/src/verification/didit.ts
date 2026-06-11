import crypto from "crypto";

/**
 * Cliente de Didit (verificación de identidad / KYC).
 *
 * Flujo: creamos una sesión vía API → el usuario completa el escaneo de
 * documento + prueba de vida en la URL que devuelve Didit → Didit nos avisa
 * el resultado por webhook (firmado con HMAC). El documento y la biometría
 * los guarda Didit, no nosotros.
 *
 * Se activa solo si están DIDIT_API_KEY y DIDIT_WORKFLOW_ID. El webhook se
 * valida con DIDIT_WEBHOOK_SECRET. Setup: docs/IDENTITY_VERIFICATION.md
 *
 * API V3: https://docs.didit.me
 */

const BASE_URL = process.env.DIDIT_BASE_URL || "https://verification.didit.me";

export function isDiditConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID);
}

type CreateSessionResult =
  | { ok: true; sessionId: string; url: string }
  | { ok: false; error: string };

/**
 * Crea una sesión de verificación. `vendorData` es nuestro userId, que Didit
 * nos devuelve en el webhook para saber a quién corresponde el resultado.
 */
export async function createDiditSession(
  vendorData: string,
  callbackUrl: string,
): Promise<CreateSessionResult> {
  if (!isDiditConfigured()) return { ok: false, error: "DIDIT_NOT_CONFIGURED" };
  try {
    const res = await fetch(`${BASE_URL}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": process.env.DIDIT_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: process.env.DIDIT_WORKFLOW_ID,
        vendor_data: vendorData,
        callback: callbackUrl,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = json?.detail || json?.message || `HTTP_${res.status}`;
      console.error(`[didit] create session failed (${res.status}):`, error);
      return { ok: false, error };
    }
    const sessionId = json?.session_id || json?.id;
    const url = json?.url || json?.verification_url || json?.session_url;
    if (!sessionId || !url) {
      console.error("[didit] unexpected create-session response:", JSON.stringify(json).slice(0, 300));
      return { ok: false, error: "UNEXPECTED_RESPONSE" };
    }
    return { ok: true, sessionId, url };
  } catch (err: any) {
    console.error("[didit] create session error:", err?.message || err);
    return { ok: false, error: err?.message || "NETWORK_ERROR" };
  }
}

/** Consulta la decisión completa de una sesión (incluye datos del documento). */
export async function retrieveDiditDecision(sessionId: string): Promise<any | null> {
  if (!isDiditConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}/v3/session/${encodeURIComponent(sessionId)}/decision/`, {
      headers: { "x-api-key": process.env.DIDIT_API_KEY! },
    });
    if (!res.ok) {
      console.error(`[didit] retrieve decision failed (${res.status}) session=${sessionId}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error("[didit] retrieve decision error:", err?.message || err);
    return null;
  }
}

/**
 * Verifica la firma HMAC del webhook. Acepta los dos nombres de header que
 * Didit ha usado (X-Signature en V3, X-Didit-Signature en docs antiguas) y,
 * si viene X-Timestamp, exige frescura para frenar reenvíos (replay).
 */
export function verifyDiditWebhook(
  rawBody: Buffer | string,
  headers: Record<string, any>,
): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;

  const provided = String(
    headers["x-signature"] || headers["x-didit-signature"] || "",
  ).trim();
  if (!provided) return false;

  const timestamp = headers["x-timestamp"];
  if (timestamp) {
    const ts = Number(timestamp);
    if (Number.isFinite(ts)) {
      // Acepta segundos o milisegundos
      const tsMs = ts > 1e12 ? ts : ts * 1000;
      if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
        console.warn("[didit] webhook rejected: stale timestamp");
        return false;
      }
    }
  }

  const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");

  // Didit envía el hex pelado o con prefijo "sha256="; aceptamos ambos.
  const candidates = [hex, `sha256=${hex}`];
  return candidates.some((expected) => {
    if (expected.length !== provided.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  });
}

/* ── Helpers para interpretar la decisión ── */

export type NormalizedStatus = "APPROVED" | "DECLINED" | "IN_REVIEW" | "IN_PROGRESS" | "EXPIRED" | "PENDING";

export function normalizeStatus(raw: string | null | undefined): NormalizedStatus {
  const s = String(raw || "").toLowerCase().replace(/[\s_-]/g, "");
  if (s === "approved") return "APPROVED";
  if (s === "declined") return "DECLINED";
  if (s === "inreview") return "IN_REVIEW";
  if (s === "inprogress" || s === "started" || s === "notfinished") return "IN_PROGRESS";
  if (s === "expired") return "EXPIRED";
  return "PENDING";
}

/**
 * Extrae { isAdult, documentType } de la decisión. Prefiere el campo `age`;
 * si no, calcula desde `date_of_birth`. Devuelve isAdult=null si no hay dato.
 */
export function extractIdentity(decision: any): { isAdult: boolean | null; documentType: string | null } {
  const idv = decision?.id_verification || decision?.kyc || decision?.document || {};
  const documentType = idv?.document_type || idv?.documentType || null;

  let isAdult: boolean | null = null;
  const age = idv?.age ?? decision?.age;
  if (typeof age === "number" && Number.isFinite(age)) {
    isAdult = age >= 18;
  } else {
    const dob = idv?.date_of_birth || idv?.dateOfBirth || decision?.date_of_birth;
    if (dob) {
      const birth = new Date(dob);
      if (!Number.isNaN(birth.getTime())) {
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
        isAdult = years >= 18;
      }
    }
  }
  return { isAdult, documentType };
}
