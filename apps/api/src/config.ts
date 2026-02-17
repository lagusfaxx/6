import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  appUrl: required("APP_URL"),
  apiUrl: required("API_URL"),
  corsOrigin: process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || required("APP_URL"),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  cookieDomain: process.env.COOKIE_DOMAIN,
  khipuApiKey: process.env.KHIPU_API_KEY || "",
  khipuBaseUrl: process.env.KHIPU_BASE_URL || "https://payment-api.khipu.com",
  khipuSubscriptionNotifyUrl: process.env.KHIPU_SUBSCRIPTION_NOTIFY_URL || "",
  khipuChargeNotifyUrl: process.env.KHIPU_CHARGE_NOTIFY_URL || "",
  khipuReturnUrl: process.env.KHIPU_RETURN_URL || "",
  khipuCancelUrl: process.env.KHIPU_CANCEL_URL || "",
  khipuWebhookSecret: process.env.KHIPU_WEBHOOK_SECRET || "",
  flowApiKey: process.env.FLOW_API_KEY || "",
  flowSecretKey: process.env.FLOW_SECRET_KEY || "",
  flowBaseUrl: process.env.FLOW_BASE_URL || "https://www.flow.cl/api",
  flowCallbackUrl: process.env.FLOW_CALLBACK_URL || "",
  flowUrlConfirmation: process.env.FLOW_URL_CONFIRMATION || process.env.FLOW_CALLBACK_URL || "",
  flowUrlReturn: process.env.FLOW_URL_RETURN || "",
  flowPlanId: process.env.FLOW_PLAN_ID || "UZEED_PRO_MENSUAL",
  membershipDays: Number(process.env.MEMBERSHIP_DAYS || 30),
  membershipPriceClp: Number(process.env.MEMBERSHIP_PRICE_CLP || 4990),
  shopMonthlyPriceClp: Number(process.env.SHOP_MONTHLY_PRICE_CLP || 4990),
  freeTrialDays: Number(process.env.FREE_TRIAL_DAYS || 7),
  storageDir: process.env.UPLOAD_DIR || process.env.STORAGE_DIR || process.env.UPLOADS_DIR || "./uploads",
  adminEmail: process.env.ADMIN_EMAIL || "admin@uzeed.cl",
  adminPassword: process.env.ADMIN_PASSWORD || "Automazdabxzx94",
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  }
};
