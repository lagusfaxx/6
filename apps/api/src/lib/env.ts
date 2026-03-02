import "dotenv/config";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-session-secret-change-me",
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? "uzeed_session",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? "",
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:3001",
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? "uploads",

  KHIPU_RECEIVER_ID: process.env.KHIPU_RECEIVER_ID ?? "",
  KHIPU_SECRET: process.env.KHIPU_SECRET ?? "",
  KHIPU_BASE_URL: process.env.KHIPU_BASE_URL ?? "https://khipu.com/api/3.0",
  KHIPU_NOTIFY_URL: process.env.KHIPU_NOTIFY_URL ?? "",
  KHIPU_RETURN_URL: process.env.KHIPU_RETURN_URL ?? "",
  KHIPU_CANCEL_URL: process.env.KHIPU_CANCEL_URL ?? "",
  KHIPU_WEBHOOK_SECRET: process.env.KHIPU_WEBHOOK_SECRET ?? process.env.KHIPU_SECRET ?? "",

  MEMBERSHIP_DAYS: parseInt(process.env.MEMBERSHIP_DAYS ?? "30", 10),
  MEMBERSHIP_PRICE_CLP: parseInt(process.env.MEMBERSHIP_PRICE_CLP ?? "4990", 10),

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "no-reply@uzeed.cl"
};

export function assertEnv() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
}
