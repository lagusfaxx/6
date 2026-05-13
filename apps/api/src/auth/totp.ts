import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) throw new Error("INVALID_BASE32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

function hotp(secret: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac(TOTP_ALGORITHM, secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** TOTP_DIGITS;
  return String(code % mod).padStart(TOTP_DIGITS, "0");
}

export function currentTotpStep(date: Date = new Date()): bigint {
  return BigInt(Math.floor(date.getTime() / 1000 / TOTP_STEP_SECONDS));
}

export type TotpVerifyResult = { ok: false } | { ok: true; step: bigint };

/**
 * Verify a TOTP code with a small window of tolerance (default ±1 step = ±30s).
 *
 * The caller is responsible for rejecting replays by tracking the last used
 * step (stored in `User.twoFactorLastUsedStep`).
 */
export function verifyTotp(
  base32Secret: string,
  code: string,
  options: { window?: number; lastUsedStep?: bigint | null; now?: Date } = {},
): TotpVerifyResult {
  if (!base32Secret) return { ok: false };
  const trimmed = (code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return { ok: false };
  const window = options.window ?? 1;
  const lastUsedStep = options.lastUsedStep ?? null;
  let secret: Buffer;
  try {
    secret = base32Decode(base32Secret);
  } catch {
    return { ok: false };
  }
  const current = currentTotpStep(options.now);
  for (let offset = -window; offset <= window; offset++) {
    const step = current + BigInt(offset);
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const candidate = hotp(secret, step);
    if (timingSafeStringEqual(candidate, trimmed)) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Build an otpauth:// provisioning URL for Google Authenticator-compatible apps.
 *
 * @param secret base32-encoded shared secret
 * @param accountName usually the user's email
 * @param issuer service name shown in the authenticator app
 */
export function buildOtpauthUrl(
  secret: string,
  accountName: string,
  issuer: string,
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
