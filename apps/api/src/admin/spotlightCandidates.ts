import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { getActiveBoostSets, spotlightEndsAt } from "../lib/promo";
import {
  BOT_UA_PATTERN,
  actorKeySql,
  realActionSql,
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

    const pros = await prisma.$queryRaw<{ id: string; username: string }[]>`
      SELECT u."id"::text AS id, u."username"
      FROM "User" u
      WHERE u."profileType" = 'PROFESSIONAL' AND u."isActive" AND u."isVerified"
        AND u."deletedAt" IS NULL AND ${realUserSql("u")} AND ${genderSql}`;
    const proBySeg = new Map<string, string>();
    for (const p of pros) {
      proBySeg.set(p.id, p.id);
      proBySeg.set(p.username, p.id);
    }

    /* Visitas a fichas. El filtro de bots (regex sobre el user agent) se
       aplica acá y no en SQL: en la base de producción esa condición sobre
       90 días de PageView tardaba 15-30 s y la pantalla se quedaba cargando;
       sin ella la consulta tarda décimas. */
    const views = await prisma.$queryRaw<{ seg: string; createdAt: Date; vkey: string; userAgent: string | null }[]>`
      SELECT split_part(pv."path", '/', 3) AS seg, pv."createdAt", ${visitorKeySql("pv")} AS vkey, pv."userAgent"
      FROM "PageView" pv
      WHERE pv."createdAt" >= ${from}
        AND (pv."path" LIKE '/profesional/%' OR pv."path" LIKE '/escort/%' OR pv."path" LIKE '/masajista/%')
        AND (pv."userId" IS NULL OR pv."userId" NOT IN ${staffIdsSql()})`;
    const bot = new RegExp(BOT_UA_PATTERN, "i");
    const visitAgg = new Map<string, { visits: number; recent: number; visitors: Set<string> }>();
    for (const v of views) {
      const id = proBySeg.get(v.seg);
      if (!id || (v.userAgent && bot.test(v.userAgent))) continue;
      const a = visitAgg.get(id) ?? { visits: 0, recent: 0, visitors: new Set<string>() };
      a.visits++;
      if (v.createdAt >= recentFrom) a.recent++;
      a.visitors.add(v.vkey);
      visitAgg.set(id, a);
    }

    /* Contactos: WhatsApp (una vez por persona y día) + clientes que le
       escribieron por el chat (una vez por persona y día). */
    const proIds = pros.map((p) => p.id);
    const contactRows = proIds.length
      ? await prisma.$queryRaw<{ id: string; contacts: number; contactsRecent: number }[]>`
          WITH wa AS (
            SELECT ua."targetId"::text AS id,
                   (${actorKeySql("ua")} || ':' || to_char(ua."createdAt", 'YYYY-MM-DD')) AS k,
                   ua."createdAt"
            FROM "UserAction" ua
            WHERE ua."action" = 'whatsapp_click' AND ua."createdAt" >= ${from}
              AND ua."targetId" = ANY(${proIds}::uuid[]) AND ${realActionSql("ua")}
          ),
          ch AS (
            SELECT m."toId"::text AS id, (m."fromId"::text || ':' || to_char(m."createdAt", 'YYYY-MM-DD')) AS k, m."createdAt"
            FROM "Message" m
            WHERE m."createdAt" >= ${from} AND m."toId" = ANY(${proIds}::uuid[])
              AND m."fromId" NOT IN ${staffIdsSql()}
          )
          SELECT id, COUNT(DISTINCT k)::int AS contacts,
                 COUNT(DISTINCT k) FILTER (WHERE "createdAt" >= ${recentFrom})::int AS "contactsRecent"
          FROM (SELECT * FROM wa UNION ALL SELECT * FROM ch) x
          GROUP BY id`
      : [];
    const contactsById = new Map(contactRows.map((c) => [c.id, c]));

    const rows: Row[] = pros.map((p) => {
      const v = visitAgg.get(p.id);
      const c = contactsById.get(p.id);
      return {
        id: p.id,
        visits: v?.visits ?? 0,
        visitsRecent: v?.recent ?? 0,
        visitors: v?.visitors.size ?? 0,
        contacts: c?.contacts ?? 0,
        contactsRecent: c?.contactsRecent ?? 0,
      };
    });

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
