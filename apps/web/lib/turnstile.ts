import { loadPublicConfig } from "./publicConfig";

/**
 * Captcha de Cloudflare (Turnstile) para el registro, sin tocar el diseño de
 * los formularios: se pide justo al enviar, en modo invisible. Sólo aparece
 * una casilla (abajo, al centro) si Cloudflare sospecha de un bot.
 *
 * Devuelve null cuando el captcha está apagado (la API no entrega clave) o no
 * se pudo cargar: en ese caso el formulario se envía como siempre.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile_load_failed"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function getTurnstileToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const config = await loadPublicConfig();
  const sitekey = config?.turnstileSiteKey;
  if (!sitekey) return null;
  try {
    await loadScript();
  } catch {
    return null;
  }
  const api = window.turnstile;
  if (!api) return null;

  return new Promise<string | null>((resolve) => {
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;";
    document.body.appendChild(holder);

    let done = false;
    let widgetId: string | null = null;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        if (widgetId) api.remove(widgetId);
      } catch {
        /* ya no está */
      }
      holder.remove();
      resolve(token);
    };
    // Si la persona no completa la casilla en un minuto, se envía sin token y
    // la API responde con el mensaje de "confirma que no eres un robot".
    const timer = window.setTimeout(() => finish(null), 60_000);

    try {
      widgetId = api.render(holder, {
        sitekey,
        appearance: "interaction-only",
        language: "es",
        callback: (token: string) => finish(token),
        "error-callback": () => finish(null),
      });
    } catch {
      finish(null);
    }
  });
}

/** Agrega el token al cuerpo de la petición (FormData o JSON) si hay. */
export async function withTurnstile<T extends FormData | Record<string, unknown>>(body: T): Promise<T> {
  const token = await getTurnstileToken();
  if (!token) return body;
  if (body instanceof FormData) {
    body.append("turnstileToken", token);
    return body;
  }
  return { ...body, turnstileToken: token };
}
