import { getApiBase } from "./api";

export type Gender = "FEMALE" | "MALE";
export type Access = "FREE" | "PREMIUM" | "VIP" | "EXCLUSIVE";
export type Tier = "FREE" | "PREMIUM" | "VIP";
export type Intensity = "suave" | "picante" | "explicito";

export type PersonalityOption = { key: string; label: string; description?: string };

export type Companion = {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  age: number;
  tagline: string | null;
  bio: string | null;
  personality: string;
  personalities: PersonalityOption[];
  communicationStyle: string | null;
  roleplayNotes: string | null;
  interests: string[];
  avatarUrl: string | null;
  galleryUrls: string[];
  access: Access;
  unlockTokens: number;
  unlockDays: number;
};

export type AiAccount = {
  tier: Tier;
  tierExpiresAt: string | null;
  adultConfirmed: boolean;
  hasBirthdate: boolean;
  isAdult: boolean;
  limits: { dailyMessages: number; memoryLimit: number; contextMessages: number; autoMemory: boolean };
  usage: { messagesToday: number; messagesLeft: number };
  walletBalance: number;
  imageTokens: number;
  features: { chat: boolean; images: boolean; maxChatIntensity: Intensity; maxImageIntensity: Intensity };
  personalities: PersonalityOption[];
  intensities: { key: Intensity; label: string }[];
};

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  imageId: string | null;
  createdAt: string;
};

export type Memory = {
  id: string;
  kind: "FACT" | "PREFERENCE" | "SUMMARY";
  content: string;
  source: "user" | "auto";
  updatedAt: string;
};

export type AiImage = {
  id: string;
  companionId: string;
  request: string;
  status: "PENDING" | "DONE" | "FAILED" | "BLOCKED";
  tokensCharged: number;
  error: string | null;
  createdAt: string;
  fileUrl: string | null;
};

export const ACCESS_LABEL: Record<Access, string> = {
  FREE: "Gratis",
  PREMIUM: "Premium",
  VIP: "VIP",
  EXCLUSIVE: "Exclusivo",
};

export const ACCESS_BADGE: Record<Access, string> = {
  FREE: "bg-emerald-500/85 text-white",
  PREMIUM: "bg-fuchsia-500/85 text-white",
  VIP: "bg-amber-400/90 text-black",
  EXCLUSIVE: "bg-gradient-to-r from-rose-500 to-violet-500 text-white",
};

export const TIER_LABEL: Record<Tier, string> = { FREE: "Gratis", PREMIUM: "Premium", VIP: "VIP" };

/** Iniciales para el avatar de reserva. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Las imágenes generadas son privadas: se piden con la sesión y se muestran como blob. */
export async function fetchPrivateImage(path: string): Promise<string> {
  const res = await fetch(`${getApiBase()}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export function apiErrorMessage(err: any, fallback = "Ocurrió un error. Intenta de nuevo."): string {
  return err?.body?.message || (err?.status === 401 ? "Inicia sesión para continuar." : fallback);
}
