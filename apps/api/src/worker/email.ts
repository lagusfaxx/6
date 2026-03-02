import nodemailer from "nodemailer";
import { config } from "../config";

export function smtpEnabled(): boolean {
  return !!(config.smtp.host && config.smtp.port && config.smtp.user && config.smtp.pass && config.smtp.from);
}

export async function sendExpiryEmail(to: string, expiresAt: Date) {
  if (!smtpEnabled()) return;
  const transporter = nodemailer.createTransport({
    host: config.smtp.host!,
    port: config.smtp.port!,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user!, pass: config.smtp.pass! }
  });

  const subject = "Tu membresía UZEED está por vencer";
  const text = `Tu membresía vencerá el ${expiresAt.toLocaleString()}. Entra a ${config.appUrl} para renovarla.`;

  await transporter.sendMail({ from: config.smtp.from!, to, subject, text });
}
