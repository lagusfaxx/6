/**
 * Profile Ranking System — UZEED
 *
 * Tier automático basado en métricas reales del perfil.
 *
 * profileScore = priceScore + viewsScore + activityScore + completedServicesScore
 *
 * Rangos de tier:
 *   SILVER  : 0–59
 *   GOLD    : 60–129
 *   DIAMOND : 130+
 */

import type { ProfessionalMeritLevel } from "./professionalLevel";

/* ── Tier thresholds — fáciles de ajustar ── */
export const TIER_THRESHOLDS = {
  GOLD: 60,
  DIAMOND: 130,
} as const;

/* ── 1) Precio base / tarifa desde (CLP) ── */
export function getPriceScore(price: number | null | undefined): number {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p < 40_000) return 5;
  if (p < 70_000) return 15;
  if (p < 100_000) return 30;
  if (p < 140_000) return 45;
  return 60;
}

/* ── 2) Visitas al perfil ── */
export function getViewsScore(views: number | null | undefined): number {
  const v = Number(views);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v < 50) return 0;
  if (v < 200) return 10;
  if (v < 500) return 20;
  if (v < 1000) return 35;
  if (v < 3000) return 50;
  return 65;
}

/* ── 3) Actividad reciente ── */
export function getActivityScore(
  lastActiveAt: Date | string | null | undefined,
): number {
  if (!lastActiveAt) return 0;
  const last =
    typeof lastActiveAt === "string" ? new Date(lastActiveAt) : lastActiveAt;
  if (isNaN(last.getTime())) return 0;

  const hoursAgo = (Date.now() - last.getTime()) / (1000 * 60 * 60);
  if (hoursAgo <= 24) return 50;
  if (hoursAgo <= 72) return 35; // 3 días
  if (hoursAgo <= 168) return 20; // 7 días
  if (hoursAgo <= 360) return 10; // 15 días
  return 0;
}

/* ── 4) Servicios completados en la plataforma ── */
export function getCompletedServicesScore(
  completedCount: number | null | undefined,
): number {
  const c = Number(completedCount);
  if (!Number.isFinite(c) || c <= 0) return 0;
  if (c < 5) return 10;
  if (c < 15) return 25;
  if (c < 30) return 40;
  if (c < 60) return 55;
  return 70;
}

/* ── Métricas del perfil ── */
export interface ProfileMetrics {
  baseRate?: number | null;
  profileViews?: number | null;
  lastSeen?: Date | string | null;
  completedServices?: number | null;
}

/* ── Cálculo del score total ── */
export function calculateProfileScore(metrics: ProfileMetrics): number {
  return (
    getPriceScore(metrics.baseRate) +
    getViewsScore(metrics.profileViews) +
    getActivityScore(metrics.lastSeen) +
    getCompletedServicesScore(metrics.completedServices)
  );
}

/* ── Tier resultante desde el score ── */
export function getTierFromScore(score: number): ProfessionalMeritLevel {
  if (score >= TIER_THRESHOLDS.DIAMOND) return "DIAMOND";
  if (score >= TIER_THRESHOLDS.GOLD) return "GOLD";
  return "SILVER";
}
