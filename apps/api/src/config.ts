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
  khipuApiKey: required("KHIPU_API_KEY"),
  khipuBaseUrl: process.env.KHIPU_BASE_URL || "https://payment-api.khipu.com",
  khipuSubscriptionNotifyUrl: required("KHIPU_SUBSCRIPTION_NOTIFY_URL"),
  khipuChargeNotifyUrl: required("KHIPU_CHARGE_NOTIFY_URL"),
  khipuReturnUrl: required("KHIPU_RETURN_URL"),
  khipuCancelUrl: required("KHIPU_CANCEL_URL"),
  khipuWebhookSecret: process.env.KHIPU_WEBHOOK_SECRET || "",
  membershipDays: Number(process.env.MEMBERSHIP_DAYS || 30),
  membershipPriceClp: Number(process.env.MEMBERSHIP_PRICE_CLP || 5000),
  shopMonthlyPriceClp: Number(process.env.SHOP_MONTHLY_PRICE_CLP || 10000),
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
