import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** Require env var only in production; fallback to empty string in dev */
function requiredInProd(name: string): string {
  const v = process.env[name];
  if (!v && process.env.NODE_ENV === "production") {
    console.error(`[config] WARNING: Missing env ${name} in production`);
  }
  return v || "";
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
  khipuApiKey: requiredInProd("KHIPU_API_KEY"),
  khipuBaseUrl: process.env.KHIPU_BASE_URL || "https://payment-api.khipu.com",
  khipuSubscriptionNotifyUrl: process.env.KHIPU_SUBSCRIPTION_NOTIFY_URL || "",
  khipuChargeNotifyUrl: process.env.KHIPU_CHARGE_NOTIFY_URL || "",
  khipuReturnUrl: process.env.KHIPU_RETURN_URL || "",
  khipuCancelUrl: process.env.KHIPU_CANCEL_URL || "",
  khipuWebhookSecret: process.env.KHIPU_WEBHOOK_SECRET || "",
  flowApiKey: requiredInProd("FLOW_API_KEY"),
  flowSecretKey: requiredInProd("FLOW_SECRET_KEY"),
  flowBaseUrl: process.env.FLOW_BASE_URL || "https://www.flow.cl/api",
  flowCallbackUrl: process.env.FLOW_CALLBACK_URL || "",
  flowPlanId: process.env.FLOW_PLAN_ID || "UZEED_PRO_MENSUAL",
  membershipDays: Number(process.env.MEMBERSHIP_DAYS || 30),
  membershipPriceClp: Number(process.env.MEMBERSHIP_PRICE_CLP || 4990),
  shopMonthlyPriceClp: Number(process.env.SHOP_MONTHLY_PRICE_CLP || 4990),
  freeTrialDays: Number(process.env.FREE_TRIAL_DAYS || 90),
  storageDir: process.env.UPLOAD_DIR || process.env.STORAGE_DIR || process.env.UPLOADS_DIR || "./uploads",
  adminEmail: process.env.ADMIN_EMAIL || "admin@uzeed.cl",
  adminPassword: required("ADMIN_PASSWORD"),
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  },
  resendApiKey: requiredInProd("RESEND_API_KEY"),
  /**
   * Cuenta de X donde se anuncian los perfiles nuevos. Son credenciales de la
   * app de UZEED (OAuth 1.0a de usuario). Sin ellas, o con X_AUTOPOST=off, la
   * cola se sigue llenando pero no se publica nada.
   */
  x: {
    enabled: (process.env.X_AUTOPOST ?? "on").toLowerCase() !== "off",
    apiKey: process.env.X_API_KEY || "",
    apiSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
    /** Minutos de margen entre el registro y el anuncio. */
    delayMinutes: Number(process.env.X_AUTOPOST_DELAY_MINUTES || 30),
    /** Publicaciones por pasada del worker, para no gastar la cuota de golpe. */
    batchSize: Number(process.env.X_AUTOPOST_BATCH || 3),
  },
  googleOAuth: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
  },
};
