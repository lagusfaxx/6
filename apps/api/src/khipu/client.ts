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
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    console.error("[khipu] error", { status: res.status, path, message: msg });
    throw new KhipuError(res.status, `Khipu ${res.status}: ${msg}`, data);
  }

  return data as T;
}

/* ──────────────────────────────────────────────── */
/* FLOW SIGNATURE */
/* ──────────────────────────────────────────────── */

export function signFlowParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();

  let toSign = "";
  for (const k of keys) {
    if (k === "s") continue;
    toSign += k + params[k]; // IMPORTANTE: SIN URL encode
  }

  return crypto
    .createHmac("sha256", config.flowSecretKey)
    .update(toSign)
    .digest("hex");
}

/* ──────────────────────────────────────────────── */
/* FLOW FETCH */
/* ──────────────────────────────────────────────── */

async function flowFetch<T>(
  path: string,
  method: "GET" | "POST",
  params: Record<string, string>
): Promise<T> {
  const signed: Record<string, string> = {
    ...params,
    apiKey: config.flowApiKey,
  };

  signed.s = signFlowParams(signed);

  const baseUrl = config.flowBaseUrl.replace(/\/$/, "");

  const { s, ...debugParams } = signed;
  console.log("[flow] request", { path, method, params: debugParams });

  let res: Response;

  if (method === "GET") {
    const qs = new URLSearchParams(signed).toString();
    res = await fetch(`${baseUrl}${path}?${qs}`, { method: "GET" });
  } else {
    const body = new URLSearchParams(signed).toString();

    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    console.error("[flow] error", { status: res.status, path, message: msg });
    throw new FlowError(res.status, `Flow ${res.status}: ${msg}`, data);
  }

  return data as T;
}

/* ──────────────────────────────────────────────── */
/* FLOW CUSTOMER */
/* ──────────────────────────────────────────────── */

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

export async function createFlowCustomer(
  req: FlowCreateCustomerRequest
): Promise<FlowCustomer> {
  const email = String(req.email ?? "").trim().toLowerCase();
  const name = String(req.name ?? "").trim();

  if (!email) throw new FlowError(400, "Flow customer email is required", {});
  if (!name) throw new FlowError(400, "Flow customer name is required", {});

  const params: Record<string, string> = { email, name };

  if (req.externalId) {
    params.externalId = String(req.externalId).trim();
  }

  return flowFetch<FlowCustomer>("/customer/create", "POST", params);
}

/* ──────────────────────────────────────────────── */
/* FLOW SUBSCRIPTION */
/* ──────────────────────────────────────────────── */

export type FlowSubscription = {
  subscriptionId: string;
  planId: string;
  customerId: string;
  status: number;
  created: string;
};

export type FlowCreateSubscriptionRequest = {
  planId: string;
  customerId: string;
};

export async function createFlowSubscription(
  req: FlowCreateSubscriptionRequest
): Promise<FlowSubscription> {
  return flowFetch<FlowSubscription>("/subscription/create", "POST", {
    planId: req.planId,
    customerId: req.customerId,
  });
}
