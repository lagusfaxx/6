import crypto from "node:crypto";
import { env } from "./env";

export type KhipuCreatePaymentRequest = {
  amount: number;
  currency?: string;
  subject: string;
  body?: string;
  transaction_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  notify_api_version: "3.0";
  custom?: string;
};

export type KhipuPayment = {
  payment_id: string;
  payment_url?: string;
  status?: string;
  receiver_id?: number;
  amount?: number;
  currency?: string;
  transaction_id?: string;
};

function authHeader() {
  const user = env.KHIPU_RECEIVER_ID;
  const pass = env.KHIPU_SECRET;
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

export async function khipuCreatePayment(params: KhipuCreatePaymentRequest): Promise<KhipuPayment> {
  const res = await fetch(`${env.KHIPU_BASE_URL.replace(/\/$/, "")}/payments`, {
    method: "POST",
    headers: {
      "Authorization": authHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`KHIPU_CREATE_FAILED ${res.status}: ${text}`);
  }
  return (await res.json()) as KhipuPayment;
}

export async function khipuGetPayment(paymentId: string): Promise<KhipuPayment> {
  const res = await fetch(`${env.KHIPU_BASE_URL.replace(/\/$/, "")}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      "Authorization": authHeader(),
      "Accept": "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`KHIPU_GET_FAILED ${res.status}: ${text}`);
  }
  return (await res.json()) as KhipuPayment;
}

export function verifyKhipuSignature(rawBody: Buffer, signatureHeader: string | undefined) {
  if (!signatureHeader) return false;
  // Expected: "t=TIMESTAMP,s=SIGNATURE" (per Khipu v3 webhook)
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.trim().split("=");
      return [k, v];
    })
  ) as Record<string, string>;

  const t = parts.t;
  const s = parts.s;
  if (!t || !s) return false;

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 60 * 5) return false; // 5 min tolerance

  const base = `${t}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", env.KHIPU_WEBHOOK_SECRET).update(base).digest("hex");
  return timingSafeEqualHex(expected, s);
}

function timingSafeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
