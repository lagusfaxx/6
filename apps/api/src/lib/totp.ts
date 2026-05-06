import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────
// TOTP (RFC 6238) + HOTP (RFC 4226) implementation, no external deps.
// Compatible with Google Authenticator, Authy, 1Password, etc.
// ─────────────────────────────────────────────────────────────────────────

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALGORITHM = "sha1"; // Google Authenticator only supports SHA1

// ── Base32 (RFC 4648, no padding) ────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("INVALID_BASE32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── HOTP / TOTP ─────────────────────────────────────────────────────────

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Counter is a 64-bit big-endian unsigned int. JS bitwise ops are 32-bit,
  // so we split high/low halves.
  const high = Math.floor(counter / 0x1_0000_0000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac(ALGORITHM, secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: Buffer, when: number = Date.now()): string {
  const counter = Math.floor(when / 1000 / STEP_SECONDS);
  return hotp(secret, counter);
}

/**
 * Verify a 6-digit TOTP code with a small window (±1 step = ±30 s) to
 * tolerate clock skew. Returns true if the code matches any candidate;
 * uses constant-time comparison to avoid timing leaks.
 */
export function verifyTotp(
  secret: Buffer,
  code: string,
  when: number = Date.now(),
  windowSteps: number = 1,
): boolean {
  const cleaned = String(code || "").replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const counter = Math.floor(when / 1000 / STEP_SECONDS);
  const candidate = Buffer.from(cleaned);
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const expected = Buffer.from(hotp(secret, counter + i));
    if (
      expected.length === candidate.length &&
      crypto.timingSafeEqual(expected, candidate)
    ) {
      return true;
    }
  }
  return false;
}

// ── otpauth:// URI for QR codes ─────────────────────────────────────────

/**
 * Build the otpauth:// URI consumed by Google Authenticator and friends.
 * The frontend turns this into a QR with a client-side QR library.
 */
export function buildOtpauthUri(opts: {
  secretBase32: string;
  accountName: string; // user email
  issuer: string; // e.g. "UZEED"
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Secret + backup-code generation ─────────────────────────────────────

/** Generate a fresh 20-byte random secret (160 bits, RFC 4226 §4). */
export function generateSecret(): { raw: Buffer; base32: string } {
  const raw = crypto.randomBytes(20);
  return { raw, base32: base32Encode(raw) };
}

/**
 * Generate `count` 10-character alphanumeric backup codes (lowercase, dashed
 * mid-way for readability: "abcde-fghij"). Returns the plaintext list to show
 * once and the joined hash list to store.
 */
export async function generateBackupCodes(
  count: number = 8,
  argon2Hash: (s: string) => Promise<string>,
): Promise<{ plain: string[]; hashList: string }> {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i to avoid confusion
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    const bytes = crypto.randomBytes(10);
    for (const b of bytes) raw += alphabet[b % alphabet.length];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  const hashes = await Promise.all(codes.map((c) => argon2Hash(c)));
  return { plain: codes, hashList: hashes.join("\n") };
}

// ── At-rest encryption of the TOTP shared secret ────────────────────────
//
// We never store the raw shared secret in the DB. We encrypt it with
// AES-256-GCM using a key derived (via HKDF-SHA256) from
// TOTP_ENCRYPTION_KEY, falling back to SESSION_SECRET when the dedicated
// key is not provided. A random 12-byte IV is prepended to the ciphertext
// and the 16-byte GCM auth tag is appended. Encoded as base64 for storage.

function getEncryptionKey(): Buffer {
  const raw =
    process.env.TOTP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "";
  if (!raw || raw.length < 16) {
    throw new Error("TOTP_ENCRYPTION_KEY (or SESSION_SECRET) must be set and >= 16 chars");
  }
  // HKDF-SHA256 to derive a 32-byte AES key, with a fixed app-specific salt
  // so rotating SESSION_SECRET does not silently invalidate stored secrets
  // unless the operator also rotates TOTP_ENCRYPTION_KEY explicitly.
  // hkdfSync returns ArrayBuffer in modern @types/node; wrap in Buffer so
  // the AES-256-GCM key parameter type-checks downstream.
  const derived = crypto.hkdfSync(
    "sha256",
    Buffer.from(raw, "utf8"),
    Buffer.from("uzeed-totp-v1", "utf8"),
    Buffer.from("totp-secret-encryption", "utf8"),
    32,
  );
  return Buffer.from(derived);
}

export function encryptSecret(secretBase32: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(secretBase32, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("INVALID_TOTP_PAYLOAD");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// ── Helpers for routes ──────────────────────────────────────────────────

export const TOTP_CONFIG = {
  STEP_SECONDS,
  DIGITS,
  ALGORITHM,
  ISSUER: "UZEED",
};
