/**
 * WhatsApp Cloud API client (Meta).
 *
 * Endpoints documented at https://developers.facebook.com/docs/whatsapp/cloud-api/.
 * The whole module is a graceful no-op when the env vars below are missing,
 * so the API can boot in dev/CI without a real WhatsApp configuration.
 *
 * Required env:
 *   WHATSAPP_TOKEN              long-lived access token (System User)
 *   WHATSAPP_PHONE_NUMBER_ID    Cloud API phone number ID (NOT the phone number)
 * Optional:
 *   WHATSAPP_API_VERSION        defaults to v20.0
 *   WHATSAPP_TEMPLATE_LANG      default language code for templates (default: es_CL)
 *   WHATSAPP_VERIFY_TOKEN       shared secret used by the Meta webhook handshake
 */

const API_BASE = "https://graph.facebook.com";

function token(): string | null {
  return process.env.WHATSAPP_TOKEN || null;
}

function phoneNumberId(): string | null {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || null;
}

function apiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v20.0";
}

export function defaultTemplateLang(): string {
  return process.env.WHATSAPP_TEMPLATE_LANG || "es_CL";
}

export function isWhatsAppConfigured(): boolean {
  return !!(token() && phoneNumberId());
}

/** Normalize a Chilean phone (or any) to E.164 digits as required by Cloud API. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  // Default-assume Chile (+56) for 9-digit local numbers.
  if (digits.length === 9 && digits.startsWith("9")) return `56${digits}`;
  if (digits.length === 8) return `569${digits}`;
  return digits;
}

type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; statusCode?: number; payload?: unknown };

async function callGraph(path: string, body: unknown): Promise<SendResult> {
  const tk = token();
  const id = phoneNumberId();
  if (!tk || !id) {
    return { ok: false, error: "WHATSAPP_NOT_CONFIGURED" };
  }

  const url = `${API_BASE}/${apiVersion()}/${id}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tk}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return { ok: false, error: `NETWORK_ERROR: ${err?.message || "fetch failed"}` };
  }

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    /* ignore json parse */
  }

  if (!res.ok) {
    return {
      ok: false,
      statusCode: res.status,
      error: payload?.error?.message || `HTTP ${res.status}`,
      payload,
    };
  }

  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: "NO_MESSAGE_ID", payload };
  }
  return { ok: true, messageId };
}

/**
 * Send a free-form text message. Meta only accepts these inside the
 * 24h customer-service window (i.e. the recipient messaged us recently).
 * Outside that window the call returns a 4xx error — callers should
 * fall back to a pre-approved template.
 */
export async function sendText(toE164: string, body: string, previewUrl = false): Promise<SendResult> {
  const trimmed = (body || "").trim();
  if (!trimmed) return { ok: false, error: "EMPTY_BODY" };
  return callGraph("/messages", {
    messaging_product: "whatsapp",
    to: toE164,
    type: "text",
    text: { body: trimmed.slice(0, 4096), preview_url: previewUrl },
  });
}

export interface TemplateComponent {
  type: "header" | "body" | "footer" | "button";
  parameters?: Array<
    | { type: "text"; text: string }
    | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
    | { type: "date_time"; date_time: { fallback_value: string } }
  >;
  sub_type?: "url" | "quick_reply";
  index?: string;
}

/**
 * Send a template message — works at any time (including outside the
 * 24h window), but the template must be pre-approved in Meta Business.
 */
export async function sendTemplate(
  toE164: string,
  templateName: string,
  components: TemplateComponent[] = [],
  language: string = defaultTemplateLang(),
): Promise<SendResult> {
  if (!templateName) return { ok: false, error: "MISSING_TEMPLATE_NAME" };
  return callGraph("/messages", {
    messaging_product: "whatsapp",
    to: toE164,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length ? { components } : {}),
    },
  });
}

/** Build a body component with positional {{1}}, {{2}}, ... text params. */
export function bodyParams(...values: string[]): TemplateComponent {
  return {
    type: "body",
    parameters: values.map((v) => ({ type: "text", text: String(v ?? "") })),
  };
}

export const __testing = { callGraph };
