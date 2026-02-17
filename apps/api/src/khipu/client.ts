import crypto from "crypto";
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

export class FlowError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "FlowError";
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

// ── Flow Plans API ──────────────────────────────────────────────────

export function signFlowParams(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();

  // IMPORTANT: Flow signature must match the exact value representation sent in form-url-encoded body
  const raw = sortedKeys
    .map((k) => `${k}${encodeURIComponent(params[k])}`)
    .join("");

  return crypto.createHmac("sha256", config.flowSecretKey).update(raw).digest("hex");
}

async function flowFetch<T>(path: string, method: "GET" | "POST", params: Record<string, string>): Promise<T> {
  const signed: Record<string, string> = { ...params, apiKey: config.flowApiKey };
  signed.s = signFlowParams(signed);

  const baseUrl = config.flowBaseUrl.replace(/\/$/, "");

  // Debug: log the exact payload sent to Flow (exclude signature)
  const { s, ...debugParams } = signed;
  console.log("[flow] request", { path, method, params: debugParams, formEncodedBody: new URLSearchParams(debugParams).toString() });

  let res: Response;
  if (method === "GET") {
    const qs = new URLSearchParams(signed).toString();
    res = await fetch(`${baseUrl}${path}?${qs}`, { method: "GET" });
  } else {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(signed).toString()
    });
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    const safeMsg = msg.length > 500 ? `${msg.slice(0, 500)}...` : msg;
    console.error("[flow] error", { status: res.status, path, message: safeMsg });
    throw new FlowError(res.status, `Flow ${res.status}: ${safeMsg}`, data);
  }
  return data as T;
}

export type FlowPlan = {
  planId: string;
  name: string;
  currency: string;
  amount: number;
  interval: number;
  interval_count: number;
  created: string;
  trial_period_days: number;
  days_until_due: number;
  periods_number: number;
  urlCallback: string;
  charges_retries_number: number;
  currency_convert_option: number;
  status: number;
  public: number;
};

export type FlowPlanListResponse = {
  total: number;
  hasMore: number;
  data: string;
};

export type FlowCreatePlanRequest = {
  planId: string;
  name: string;
  currency?: string;
  amount: number;
  interval: number;
  interval_count?: number;
  trial_period_days?: number;
  days_until_due?: number;
  periods_number?: number;
  urlCallback?: string;
  charges_retries_number?: number;
  currency_convert_option?: number;
};

export type FlowEditPlanRequest = {
  planId: string;
  name?: string;
  currency?: string;
  amount?: number;
  interval?: number;
  interval_count?: number;
  trial_period_days?: number;
  days_until_due?: number;
  periods_number?: number;
  urlCallback?: string;
  charges_retries_number?: number;
  currency_convert_option?: number;
};

function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

export async function createFlowPlan(req: FlowCreatePlanRequest): Promise<FlowPlan> {
  return flowFetch<FlowPlan>("/plans/create", "POST", toStringRecord(req as unknown as Record<string, unknown>));
}

export async function getFlowPlan(planId: string): Promise<FlowPlan> {
  return flowFetch<FlowPlan>("/plans/get", "GET", { planId });
}

export async function editFlowPlan(req: FlowEditPlanRequest): Promise<FlowPlan> {
  return flowFetch<FlowPlan>("/plans/edit", "POST", toStringRecord(req as unknown as Record<string, unknown>));
}

export async function deleteFlowPlan(planId: string): Promise<FlowPlan> {
  return flowFetch<FlowPlan>("/plans/delete", "POST", { planId });
}

export async function listFlowPlans(opts?: {
  start?: number;
  limit?: number;
  filter?: string;
  status?: number;
}): Promise<FlowPlanListResponse> {
  const params: Record<string, string> = {};
  if (opts?.start !== undefined) params.start = String(opts.start);
  if (opts?.limit !== undefined) params.limit = String(opts.limit);
  if (opts?.filter !== undefined) params.filter = opts.filter;
  if (opts?.status !== undefined) params.status = String(opts.status);
  return flowFetch<FlowPlanListResponse>("/plans/list", "GET", params);
}

// ── Flow Customer API ───────────────────────────────────────────────

export type FlowCustomer = {
  customerId: string;
  name: string;
  email: string;
  externalId?: string;
  status: number;
  created: string;
};

export type FlowCreateCustomerRequest = {
  name: string;
  email: string;
  externalId?: string;
};

export async function createFlowCustomer(req: FlowCreateCustomerRequest): Promise<FlowCustomer> {
  const email = String(req.email ?? "").trim().toLowerCase();
  const name = String(req.name ?? "").trim();

  if (!email) throw new FlowError(400, "Flow customer email is required", { field: "email" });
  if (!name) throw new FlowError(400, "Flow customer name is required", { field: "name" });

  const params: Record<string, string> = { email, name };
  if (req.externalId !== undefined && req.externalId !== null) {
    params.externalId = String(req.externalId).trim();
  }

  return flowFetch<FlowCustomer>("/customer/create", "POST", params);
}

// ── Flow Subscription API ───────────────────────────────────────────

export type FlowSubscription = {
  subscriptionId: string;
  planId: string;
  plan_name?: string;
  customerId: string;
  created: string;
  status: number;
  current_period_end?: string;
  next_invoice_date?: string;
  trial_period_days?: number;
  trial_end?: string;
  cancel_at_period_end?: number;
  cancel_at?: string;
  periods_number?: number;
  urlCallback?: string;
};

export type FlowCreateSubscriptionRequest = {
  planId: string;
  customerId: string;
  subscription_start?: string;
  couponId?: string;
  trial_period_days?: number;
};

export async function createFlowSubscription(req: FlowCreateSubscriptionRequest): Promise<FlowSubscription> {
  return flowFetch<FlowSubscription>("/subscription/create", "POST", toStringRecord(req as unknown as Record<string, unknown>));
}

export async function getFlowSubscription(subscriptionId: string): Promise<FlowSubscription> {
  return flowFetch<FlowSubscription>("/subscription/get", "GET", { subscriptionId });
}
