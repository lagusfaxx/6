/**
 * Proveedores de IA para Acompañantes IA.
 *
 * Ambos se hablan con la API "compatible con OpenAI" (POST /chat/completions y
 * POST /images/generations), que ofrecen la mayoría de los proveedores y los
 * servidores propios (vLLM, Ollama, LocalAI, etc.). Así se puede cambiar de
 * proveedor sólo con variables de entorno.
 *
 * El contenido explícito queda APAGADO salvo que se active a propósito con
 * AI_CHAT_ALLOW_EXPLICIT / AI_IMAGE_ALLOW_EXPLICIT, y sólo debe activarse con
 * un proveedor cuyos términos permitan expresamente contenido adulto.
 */
import type { IntensityKey } from "./personas";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function flag(name: string): boolean {
  return /^(1|true|yes|si|sí)$/i.test(env(name));
}

export function chatConfig() {
  return {
    baseUrl: env("AI_CHAT_API_URL").replace(/\/+$/, ""),
    apiKey: env("AI_CHAT_API_KEY"),
    model: env("AI_CHAT_MODEL"),
    allowExplicit: flag("AI_CHAT_ALLOW_EXPLICIT"),
    timeoutMs: Number(env("AI_CHAT_TIMEOUT_MS")) || 60_000,
  };
}

export function imageConfig() {
  let extra: Record<string, unknown> = {};
  try {
    const raw = env("AI_IMAGE_EXTRA_JSON");
    if (raw) extra = JSON.parse(raw);
  } catch {
    console.error("[ai-companions] AI_IMAGE_EXTRA_JSON no es JSON válido; se ignora");
  }
  return {
    baseUrl: env("AI_IMAGE_API_URL").replace(/\/+$/, ""),
    apiKey: env("AI_IMAGE_API_KEY"),
    model: env("AI_IMAGE_MODEL"),
    size: env("AI_IMAGE_SIZE") || "832x1216",
    allowExplicit: flag("AI_IMAGE_ALLOW_EXPLICIT"),
    timeoutMs: Number(env("AI_IMAGE_TIMEOUT_MS")) || 180_000,
    extra,
  };
}

export function isChatConfigured(): boolean {
  const c = chatConfig();
  return Boolean(c.baseUrl && c.model);
}

export function isImageConfigured(): boolean {
  const c = imageConfig();
  return Boolean(c.baseUrl && c.model);
}

export function maxChatIntensity(): IntensityKey {
  return chatConfig().allowExplicit ? "explicito" : "picante";
}

export function maxImageIntensity(): IntensityKey {
  return imageConfig().allowExplicit ? "explicito" : "picante";
}

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const c = chatConfig();
  if (!c.baseUrl || !c.model) throw new ProviderError("AI_CHAT_NOT_CONFIGURED");

  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: c.model,
      messages,
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.9,
    }),
    signal: AbortSignal.timeout(c.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(`chat provider ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ProviderError("chat provider: respuesta vacía");
  return text.trim();
}

export async function generateImage(params: {
  prompt: string;
  negativePrompt: string;
  seed: number;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const c = imageConfig();
  if (!c.baseUrl || !c.model) throw new ProviderError("AI_IMAGE_NOT_CONFIGURED");

  const res = await fetch(`${c.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: c.model,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      seed: params.seed,
      n: 1,
      size: c.size,
      response_format: "b64_json",
      ...c.extra,
    }),
    signal: AbortSignal.timeout(c.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(`image provider ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as any;
  const item = data?.data?.[0];
  if (item?.b64_json) {
    return { buffer: Buffer.from(String(item.b64_json), "base64"), mimeType: "image/png" };
  }
  if (typeof item?.url === "string" && /^https:\/\//.test(item.url)) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new ProviderError(`image download ${img.status}`);
    const mimeType = img.headers.get("content-type") || "image/png";
    if (!mimeType.startsWith("image/")) throw new ProviderError("image download: no es una imagen");
    return { buffer: Buffer.from(await img.arrayBuffer()), mimeType };
  }
  throw new ProviderError("image provider: respuesta sin imagen");
}
