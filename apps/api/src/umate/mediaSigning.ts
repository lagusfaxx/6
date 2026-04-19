import crypto from "node:crypto";
import { config } from "../config";

const DEFAULT_TTL_SECONDS = 60 * 60; // 1h — balance between share window and UX

function payload(subject: string, exp: number): string {
  return `umate-media\0${subject}\0${exp}`;
}

export function signMedia(subject: string, ttlSeconds = DEFAULT_TTL_SECONDS): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload(subject, exp))
    .digest("base64url");
  return { exp, sig };
}

export function verifyMediaSig(subject: string, exp: number, sig: string | undefined | null): boolean {
  if (!sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload(subject, exp))
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
