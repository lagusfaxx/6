import path from "path";
import fs from "fs";
import QRCode from "qrcode";

/**
 * Proveedor gratuito del bot de WhatsApp usando Baileys (protocolo de
 * WhatsApp Web con un número normal — chip dedicado).
 *
 * Se activa con WHATSAPP_PROVIDER=baileys. La primera vez hay que vincular
 * el número escaneando el QR (endpoint admin /notifications/whatsapp/qr).
 * La sesión queda guardada en WHATSAPP_SESSION_DIR y sobrevive reinicios
 * si ese directorio está en un volumen persistente.
 *
 * Nota: Baileys no es una API oficial de Meta. Usar un número dedicado al
 * bot, nunca uno personal. Ver docs/WHATSAPP_BOT.md.
 */

const SESSION_DIR = process.env.WHATSAPP_SESSION_DIR || path.join(process.cwd(), ".wa-session");

type BaileysStatus = "off" | "starting" | "waiting_qr" | "connected" | "logged_out" | "error";

const state: {
  status: BaileysStatus;
  qr: string | null;
  sock: any | null;
  me: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  starting: boolean;
} = {
  status: "off",
  qr: null,
  sock: null,
  me: null,
  lastError: null,
  reconnectAttempts: 0,
  starting: false,
};

export function isBaileysEnabled(): boolean {
  return (process.env.WHATSAPP_PROVIDER || "").toLowerCase() === "baileys";
}

/* Baileys exige un logger estilo pino; stub silencioso para no sumar deps. */
const silentLogger: any = {
  level: "silent",
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function connect(): Promise<void> {
  if (state.starting) return;
  state.starting = true;
  state.status = "starting";
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    let version: [number, number, number] | undefined;
    try {
      version = (await fetchLatestBaileysVersion()).version as [number, number, number];
    } catch {
      // sin red hacia el endpoint de versiones: usar la default de la lib
    }

    const sock = makeWASocket({
      auth: authState,
      logger: silentLogger,
      version,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      browser: ["UZEED Bot", "Chrome", "1.0.0"],
      syncFullHistory: false,
    });
    state.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        state.qr = qr;
        state.status = "waiting_qr";
        console.log("[whatsapp:baileys] QR listo — escanéalo desde /notifications/whatsapp/qr");
      }
      if (connection === "open") {
        state.status = "connected";
        state.qr = null;
        state.reconnectAttempts = 0;
        state.lastError = null;
        state.me = sock.user?.id ? String(sock.user.id).split(":")[0] : null;
        console.log(`[whatsapp:baileys] conectado como ${state.me || "?"}`);
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        state.sock = null;
        if (code === DisconnectReason.loggedOut) {
          // Sesión cerrada desde el teléfono: limpiar credenciales y pedir QR nuevo
          state.status = "logged_out";
          state.qr = null;
          try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
          console.warn("[whatsapp:baileys] sesión cerrada (logged out). Vincula de nuevo con el QR.");
          scheduleReconnect();
        } else {
          state.lastError = (lastDisconnect?.error as any)?.message || `close_${code}`;
          scheduleReconnect();
        }
      }
    });
  } catch (err: any) {
    state.status = "error";
    state.lastError = err?.message || String(err);
    console.error("[whatsapp:baileys] error al iniciar:", state.lastError);
    scheduleReconnect();
  } finally {
    state.starting = false;
  }
}

function scheduleReconnect() {
  if (!isBaileysEnabled()) return;
  state.reconnectAttempts += 1;
  const delay = Math.min(60_000, 2_000 * 2 ** Math.min(state.reconnectAttempts, 5));
  setTimeout(() => {
    connect().catch(() => {});
  }, delay).unref?.();
}

/** Llamar una vez en el boot del API. No-op si el provider no es baileys. */
export function initBaileys(): void {
  if (!isBaileysEnabled()) return;
  connect().catch(() => {});
}

export function getBaileysStatus() {
  return {
    enabled: isBaileysEnabled(),
    status: state.status,
    connectedAs: state.me,
    hasPendingQr: Boolean(state.qr),
    lastError: state.lastError,
    sessionDir: SESSION_DIR,
  };
}

/** Data URL (PNG) del QR pendiente de vincular, o null si no hay. */
export async function getBaileysQrDataUrl(): Promise<string | null> {
  if (!state.qr) return null;
  return QRCode.toDataURL(state.qr, { margin: 1, width: 320 });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error(label)), ms);
      (t as any).unref?.();
    }),
  ]);
}

/** Envía texto libre. `to` debe venir ya normalizado (solo dígitos con país). */
export async function sendBaileysText(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBaileysEnabled()) return { ok: false, error: "BAILEYS_DISABLED" };
  const sock = state.sock;
  if (!sock || state.status !== "connected") {
    return { ok: false, error: `NOT_CONNECTED_${state.status.toUpperCase()}` };
  }
  try {
    // Verificar que el número exista en WhatsApp: evita envíos colgados o
    // errores raros de Baileys con números inexistentes/mal escritos.
    let jid = `${to}@s.whatsapp.net`;
    try {
      const checks = await withTimeout(sock.onWhatsApp(to), 10_000, "CHECK_TIMEOUT");
      const entry = Array.isArray(checks) ? checks[0] : null;
      if (entry && entry.exists === false) {
        return { ok: false, error: "NUMERO_SIN_WHATSAPP" };
      }
      if (entry?.jid) jid = entry.jid;
    } catch {
      // Si la verificación falla/expira seguimos con el JID directo
    }
    await withTimeout(sock.sendMessage(jid, { text }), 20_000, "SEND_TIMEOUT");
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || "SEND_FAILED";
    console.error("[whatsapp:baileys] send error:", msg);
    if (msg === "SEND_TIMEOUT") {
      return { ok: false, error: "TIMEOUT: el envío no respondió en 20s — revisa la conexión del bot" };
    }
    return { ok: false, error: msg };
  }
}

/** Cierra sesión y borra credenciales para vincular otro número. */
export async function logoutBaileys(): Promise<void> {
  try { await state.sock?.logout?.(); } catch {}
  try { state.sock?.end?.(undefined); } catch {}
  state.sock = null;
  state.qr = null;
  state.me = null;
  state.status = "logged_out";
  try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
  if (isBaileysEnabled()) {
    state.reconnectAttempts = 0;
    scheduleReconnect();
  }
}
