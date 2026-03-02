import crypto from "crypto";
import { config } from "../config";

export function verifyKhipuSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!config.khipuWebhookSecret) return true;
  if (!signatureHeader) return false;
  // expected format: t=1700000000,s=hex
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const sPart = parts.find((p) => p.startsWith("s="));
  if (!tPart || !sPart) return false;
  const t = tPart.slice(2);
  const theirSig = sPart.slice(2);
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  // 10 minute tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 600) return false;

  const payload = `${t}.${rawBody.toString("utf8")}`;
  const mac = crypto.createHmac("sha256", config.khipuWebhookSecret).update(payload, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(theirSig, "hex"));
  } catch {
    return false;
  }
}
