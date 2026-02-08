import { config } from "../config";

export class KhipuError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "KhipuError";
    this.status = status;
    this.payload = payload;
  }
}

async function khipuFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = config.khipuBaseUrl.replace(/\/$/, "");
  const url = `${baseUrl}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("x-api-key", config.khipuApiKey);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    const safeMsg = msg.length > 500 ? `${msg.slice(0, 500)}...` : msg;
    console.error("[khipu] error", { status: res.status, path, message: safeMsg });
    throw new KhipuError(res.status, `Khipu ${res.status}: ${safeMsg}`, data);
  }
  return data as T;
}

export type KhipuCreateSubscriptionRequest = {
  name: string;
  email: string;
  max_amount: number;
  currency: string;
  notify_url: string;
  return_url: string;
  cancel_url: string;
  service_reference?: string;
  image_url?: string;
  description?: string;
};

export type KhipuCreateSubscriptionResponse = {
  subscription_id: string;
  redirect_url: string;
};

export type KhipuSubscriptionStatusResponse = {
  subscription_id: string;
  status: "DISABLED" | "SIGNED" | "ENABLED";
  developer: boolean;
  customer_bank_code: string;
  service_reference?: string;
};

export type KhipuChargeIntentRequest = {
  subscription_id: string;
  amount: number;
  subject: string;
  body: string;
  error_response_url: string;
  custom: string;
  transaction_id: string;
  notify_url: string;
  notify_api_version?: string;
};

export type KhipuChargeIntentResponse = {
  payment_id: string;
};

export type KhipuCreatePaymentRequest = {
  amount: number;
  currency: string;
  subject: string;
  body?: string;
  transaction_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  notify_api_version?: string;
};

export type KhipuCreatePaymentResponse = {
  payment_id: string;
  payment_url?: string;
};

export async function createSubscription(req: KhipuCreateSubscriptionRequest): Promise<KhipuCreateSubscriptionResponse> {
  return khipuFetch<KhipuCreateSubscriptionResponse>("/v1/automatic-payment/subscription", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export async function getSubscription(subscriptionId: string): Promise<KhipuSubscriptionStatusResponse> {
  return khipuFetch<KhipuSubscriptionStatusResponse>(`/v1/automatic-payment/subscription/${encodeURIComponent(subscriptionId)}`, {
    method: "GET"
  });
}

export async function createChargeIntent(req: KhipuChargeIntentRequest): Promise<KhipuChargeIntentResponse> {
  return khipuFetch<KhipuChargeIntentResponse>("/v1/automatic-payment/charge-intent", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export async function createPayment(req: KhipuCreatePaymentRequest): Promise<KhipuCreatePaymentResponse> {
  return khipuFetch<KhipuCreatePaymentResponse>("/v1/payments", {
    method: "POST",
    body: JSON.stringify(req)
  });
}
