import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { getActiveBoostSets, spotlightEndsAt } from "../lib/promo";
import {
  actorKeySql,
  realActionSql,
  realPageViewSql,
  realUserSql,
  staffIdsSql,
  visitorKeySql,
} from "../lib/statsFilters";

/**
 * GET /admin/spotlight/candidates — panel "Destacar" (/admin/destacar).
 *
 * Profesionales publicadas con sus visitas y contactos de los últimos 90 días,
 * y cómo les va en las últimas 2 semanas comparado con antes. Sirve para elegir
 * a quién regalarle la Destacada: a las que venían bien y ahora están cayendo
 * (quedaron abajo en el listado), o a las que nunca despegaron.
 *
 * Visitas: vistas de su ficha (/profesional/<id|usuario>, /escort/<usuario>,
 * /masajista/<usuario>), sin bots, sin el equipo ni el panel.
 * Contactos: clicks a WhatsApp (una vez por persona y día) + clientes que le
 * escribieron por el chat (una vez por persona y día).
 */
export const spotlightCandidatesRouter = Router();

const WINDOW_DAYS = 90;
const RECENT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  visits: number;
  visitsRecent: number;
  visitors: number;
  contacts: number;
  contactsRecent: number;
};

spotlightCandidatesRouter.get(
  "/admin/spotlight/candidates",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const gender = typeof req.query.gender === "string" ? req.query.gender.toUpperCase() : "FEMALE";
    const now = Date.now();
    const from = new Date(now - WINDOW_DAYS * DAY_MS);
    const recentFrom = new Date(now - RECENT_DAYS * DAY_MS);

    const genderSql =
      gender === "MALE" || gender === "OTHER"
        ? Prisma.sql`u."gender"::text = ${gender}`
        : Prisma.sql`(u."gender" = 'FEMALE' OR u."gender" IS NULL)`;

    const rows = await prisma.$queryRaw<Row[]>`
      WITH pros AS (
        SELECT u."id", u."username"
        FROM "User" u
        WHERE u."profileType" = 'PROFESSIONAL' AND u."isActive" AND u."isVerified"
          AND u."deletedAt" IS NULL AND ${realUserSql("u")} AND ${genderSql}
      ),
      pv AS (
        SELECT p."id", pv."createdAt", ${visitorKeySql("pv")} AS vkey
        FROM "PageView" pv
        JOIN pros p ON split_part(pv."path", '/', 3) IN (p."id"::text, p."username")
        WHERE pv."createdAt" >= ${from}
          AND split_part(pv."path", '/', 2) IN ('profesional', 'escort', 'masajista')
          AND ${realPageViewSql("pv")}
      ),
      v AS (
        SELECT "id", COUNT(*)::int AS visits,
               COUNT(*) FILTER (WHERE "createdAt" >= ${recentFrom})::int AS "visitsRecent",
               COUNT(DISTINCT vkey)::int AS visitors
        FROM pv GROUP BY "id"
      ),
      wa AS (
        SELECT ua."targetId" AS id,
               (${actorKeySql("ua")} || ':' || to_char(ua."createdAt", 'YYYY-MM-DD')) AS k,
               ua."createdAt"
        FROM "UserAction" ua
        JOIN pros p ON p."id" = ua."targetId"
        WHERE ua."action" = 'whatsapp_click' AND ua."createdAt" >= ${from} AND ${realActionSql("ua")}
      ),
      ch AS (
        SELECT m."toId" AS id, (m."fromId"::text || ':' || to_char(m."createdAt", 'YYYY-MM-DD')) AS k, m."createdAt"
        FROM "Message" m
        JOIN pros p ON p."id" = m."toId"
        WHERE m."createdAt" >= ${from} AND m."fromId" NOT IN ${staffIdsSql()}
      ),
      c AS (
        SELECT id, COUNT(DISTINCT k)::int AS contacts,
               COUNT(DISTINCT k) FILTER (WHERE "createdAt" >= ${recentFrom})::int AS "contactsRecent"
        FROM (SELECT * FROM wa UNION ALL SELECT * FROM ch) x
        GROUP BY id
      )
      SELECT p."id",
             COALESCE(v.visits, 0) AS visits, COALESCE(v."visitsRecent", 0) AS "visitsRecent",
             COALESCE(v.visitors, 0) AS visitors,
             COALESCE(c.contacts, 0) AS contacts, COALESCE(c."contactsRecent", 0) AS "contactsRecent"
      FROM pros p
      LEFT JOIN v ON v."id" = p."id"
      LEFT JOIN c ON c."id" = p."id"`;

    const ids = rows.map((r) => r.id);
    const [users, boosts] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, displayName: true, avatarUrl: true, city: true, lastSeen: true, createdAt: true },
      }),
      getActiveBoostSets(),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));

    /* Ritmo semanal: últimas 2 semanas contra el resto del periodo. Para las
       nuevas el "antes" es sólo el tiempo que llevan publicadas. */
    const weeks = (ms: number) => Math.max(ms / (7 * DAY_MS), 1 / 7);
    const profiles = rows
      .map((r) => {
        const u = byId.get(r.id);
        if (!u) return null;
        const start = Math.max(from.getTime(), u.createdAt.getTime());
        const earlierWeeks = weeks(recentFrom.getTime() - start);
        const hasEarlier = recentFrom.getTime() - start > 7 * DAY_MS;
        const weeklyRecent = r.visitsRecent / weeks(now - Math.max(recentFrom.getTime(), start));
        const weeklyEarlier = hasEarlier ? (r.visits - r.visitsRecent) / earlierWeeks : null;
        const trendPct =
          weeklyEarlier && weeklyEarlier >= 3 ? Math.round((weeklyRecent / weeklyEarlier - 1) * 100) : null;
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatarUrl: u.avatarUrl,
          city: u.city,
          lastSeen: u.lastSeen?.toISOString() ?? null,
          visits: r.visits,
          visitors: r.visitors,
          contacts: r.contacts,
          visitsRecent: r.visitsRecent,
          contactsRecent: r.contactsRecent,
          weeklyRecent: Math.round(weeklyRecent * 10) / 10,
          weeklyEarlier: weeklyEarlier == null ? null : Math.round(weeklyEarlier * 10) / 10,
          trendPct,
          boostEndsAt: spotlightEndsAt(u.id, boosts),
        };
      })
      .filter(Boolean);

    return res.json({ windowDays: WINDOW_DAYS, recentDays: RECENT_DAYS, gender, profiles });
  }),
);
