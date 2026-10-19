import { Router } from "express";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { NOVEDADES_SLOTS, getNovedadesPins, setNovedadesPins } from "../lib/novedadesPins";

/**
 * Orden de "Novedades" del inicio (/admin/novedades). La lista en sí la da
 * /profiles/discover?sort=new (ya con las fijadas en su lugar); acá sólo se
 * leen y guardan las posiciones fijadas.
 */
export const novedadesOrderRouter = Router();

const genderOf = (v: unknown) => {
  const g = typeof v === "string" ? v.toUpperCase() : "";
  return g === "MALE" || g === "OTHER" || g === "FEMALE" ? g : "FEMALE";
};

novedadesOrderRouter.get(
  "/admin/home/novedades/pins",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const gender = genderOf(req.query.gender);
    const set = await getNovedadesPins(gender);
    return res.json({ gender, slots: NOVEDADES_SLOTS, pins: set.pins, savedAt: set.savedAt });
  }),
);

novedadesOrderRouter.put(
  "/admin/home/novedades/pins",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const gender = genderOf(req.body?.gender);
    const set = await setNovedadesPins(gender, req.body?.pins);
    return res.json({ gender, slots: NOVEDADES_SLOTS, pins: set.pins, savedAt: set.savedAt });
  }),
);
