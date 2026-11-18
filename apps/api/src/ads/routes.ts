import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../auth/middleware";

/**
 * Anuncios de ExoClick. El interruptor y el zoneid de cada espacio se guardan
 * en PlatformConfig y se editan desde /admin/anuncios, así que crear una zona
 * nueva en ExoClick no necesita un deploy: basta pegar su número en el panel.
 * Un espacio sin zoneid no se muestra.
 */

export const AD_SLOTS = ["homeFeed", "homeCamsDesktop", "homeCamsMobile", "listing"] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];

const ENABLED_KEY = "ads_enabled";
const zoneKey = (slot: AdSlotName) => `ads_zone_${slot}`;

/* Zonas ya creadas en ExoClick: valen mientras no se guarde otra en el panel. */
const DEFAULT_ZONES: Partial<Record<AdSlotName, string>> = { homeFeed: "6095358", homeCamsDesktop: "6095374" };

type AdsConfig = { enabled: boolean; zones: Record<AdSlotName, string | null> };

let cache: { at: number; value: AdsConfig } | null = null;
const CACHE_MS = 30_000;

async function readAdsConfig(): Promise<AdsConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [ENABLED_KEY, ...AD_SLOTS.map(zoneKey)] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const zones = Object.fromEntries(
    AD_SLOTS.map((s) => [s, map.has(zoneKey(s)) ? map.get(zoneKey(s)) || null : DEFAULT_ZONES[s] ?? null]),
  ) as AdsConfig["zones"];
  const value = { enabled: map.get(ENABLED_KEY) === "true", zones };
  cache = { at: Date.now(), value };
  return value;
}

export const adsRouter = Router();

// Público: la web lo lee para saber si muestra anuncios y con qué zona.
adsRouter.get(
  "/ads/config",
  asyncHandler(async (_req, res) => {
    const cfg = await readAdsConfig();
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(cfg);
  }),
);

adsRouter.get(
  "/admin/ads/config",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    cache = null;
    return res.json(await readAdsConfig());
  }),
);

adsRouter.put(
  "/admin/ads/config",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const enabled = req.body?.enabled === true;
    const zonesIn = (req.body?.zones ?? {}) as Record<string, unknown>;
    const writes: { key: string; value: string }[] = [{ key: ENABLED_KEY, value: String(enabled) }];
    for (const slot of AD_SLOTS) {
      const raw = String(zonesIn[slot] ?? "").trim();
      if (raw && !/^\d{4,12}$/.test(raw)) {
        return res.status(400).json({ error: "VALIDATION", message: `El zoneid de "${slot}" debe ser sólo números.` });
      }
      writes.push({ key: zoneKey(slot), value: raw });
    }
    await prisma.$transaction(
      writes.map((w) =>
        prisma.platformConfig.upsert({
          where: { key: w.key },
          create: { key: w.key, value: w.value },
          update: { value: w.value },
        }),
      ),
    );
    cache = null;
    console.log("[ads] configuración actualizada", { by: (req as any).user?.email, enabled });
    return res.json(await readAdsConfig());
  }),
);
