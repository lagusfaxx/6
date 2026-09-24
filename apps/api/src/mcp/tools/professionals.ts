import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { guarded, type McpContext } from "../audit";
import { TZ, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { localTs } from "../metrics";
import { describeFiltros, filtrosShape, pickFiltros, profileSql, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const SECCIONES = ["crecimiento", "verificacion", "actividad", "tiers"] as const;
const BUSINESS = Prisma.sql`u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP')`;

export function registerProfessionalTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "profesionales",
    {
      title: "Profesionales: crecimiento, verificación, actividad y tiers",
      description:
        "Secciones: crecimiento (altas por día, origen del registro —formulario, Google, Publícate Gold, admin—, y cuántas llegaron con código de referido); " +
        "verificacion (tiempo desde el registro hasta quedar publicada: mediana, promedio y distribución; colas pendientes con antigüedad); " +
        "actividad (último login, última edición, historias subidas, días sin actividad; distribución y lista de las más inactivas); " +
        "tiers (distribución actual, altas y bajas de tier en el periodo, membresías que vencen en 7 días). Acepta filtros comunes.",
      inputSchema: { ...periodShape, ...filtrosShape, secciones: z.array(z.enum(SECCIONES)).optional(), limite: z.number().int().min(1).max(200).optional() },
      annotations: READ,
    },
    guarded("profesionales", ctx, async (args: PeriodInput & Filtros & { secciones?: (typeof SECCIONES)[number][]; limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const wanted = new Set(args.secciones?.length ? args.secciones : SECCIONES);
      const pf = await profileSql(f, "u");
      const created = Prisma.sql`u."createdAt" >= ${period.from} AND u."createdAt" < ${period.to}`;
      const out: Record<string, unknown> = { periodo: describePeriod(period), filtros: describeFiltros(f) };

      if (wanted.has("crecimiento")) {
        const [porDia, porOrigen, referidos, porTipo] = await Promise.all([
          prisma.$queryRaw<{ dia: string; altas: number; organicas: number }[]>`
            SELECT to_char(date_trunc('day', ${localTs('u."createdAt"')}), 'YYYY-MM-DD') AS dia, COUNT(*)::int AS altas, COUNT(*) FILTER (WHERE u."adminManaged" = false)::int AS organicas
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND ${created} GROUP BY 1 ORDER BY 1`,
          prisma.$queryRaw<{ origen: string; altas: number }[]>`
            SELECT COALESCE(u."signupSource", CASE WHEN u."adminManaged" THEN 'admin' ELSE '(sin dato)' END) AS origen, COUNT(*)::int AS altas
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND ${created} GROUP BY 1 ORDER BY 2 DESC`,
          prisma.$queryRaw<{ conReferido: number; codigos: { codigo: string; altas: number }[] }[]>`
            SELECT COUNT(*)::int AS "conReferido",
              COALESCE((SELECT json_agg(json_build_object('codigo', c.code, 'altas', c.n)) FROM (
                SELECT crc."code", COUNT(*)::int AS n FROM "ReferralRedemption" rr JOIN "CreatorReferralCode" crc ON crc."id" = rr."referralCodeId"
                JOIN "User" u ON u."id" = rr."professionalId" WHERE ${pf} AND ${created} GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}) c), '[]'::json) AS codigos
            FROM "ReferralRedemption" rr JOIN "User" u ON u."id" = rr."professionalId" WHERE ${pf} AND ${created}`,
          prisma.$queryRaw<{ tipo: string; altas: number }[]>`
            SELECT u."profileType"::text AS tipo, COUNT(*)::int AS altas FROM "User" u WHERE ${pf} AND ${BUSINESS} AND ${created} GROUP BY 1 ORDER BY 2 DESC`,
        ]);
        out.crecimiento = {
          altasTotales: porDia.reduce((a, r) => a + r.altas, 0),
          altasOrganicas: porDia.reduce((a, r) => a + r.organicas, 0),
          porDia,
          porOrigen,
          porTipo,
          referidos: referidos[0],
          nota: "Origen del registro sólo existe para cuentas creadas desde este cambio; las anteriores salen como (sin dato).",
          grafico: "línea de altas por día; dona por origen",
        };
      }

      if (wanted.has("verificacion")) {
        const [tiempos, distribucion, cola] = await Promise.all([
          prisma.$queryRaw<{ n: number; p50_h: number | null; promedio_h: number | null; p90_h: number | null }[]>`
            SELECT COUNT(*)::int AS n,
              (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (u."verifiedAt" - u."createdAt")) / 3600))::float8 AS p50_h,
              (AVG(EXTRACT(EPOCH FROM (u."verifiedAt" - u."createdAt")) / 3600))::float8 AS promedio_h,
              (percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (u."verifiedAt" - u."createdAt")) / 3600))::float8 AS p90_h
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."verifiedAt" IS NOT NULL AND u."verifiedAt" >= ${period.from} AND u."verifiedAt" < ${period.to} AND u."adminManaged" = false`,
          prisma.$queryRaw<{ rango: string; perfiles: number }[]>`
            SELECT CASE WHEN h <= 24 THEN '≤24h' WHEN h <= 72 THEN '1-3 días' WHEN h <= 168 THEN '3-7 días' ELSE '>7 días' END AS rango, COUNT(*)::int AS perfiles
            FROM (SELECT EXTRACT(EPOCH FROM (u."verifiedAt" - u."createdAt")) / 3600 AS h FROM "User" u
                  WHERE ${pf} AND ${BUSINESS} AND u."verifiedAt" IS NOT NULL AND u."verifiedAt" >= ${period.from} AND u."verifiedAt" < ${period.to} AND u."adminManaged" = false) t
            GROUP BY 1 ORDER BY MIN(h)`,
          prisma.$queryRaw<{ pendientes: number; masAntiguoDias: number | null; mas48h: number; facialesEnviadas: number; documentos: number }[]>`
            SELECT COUNT(*)::int AS pendientes,
              MAX(EXTRACT(EPOCH FROM (now() - u."createdAt")) / 86400)::int AS "masAntiguoDias",
              COUNT(*) FILTER (WHERE u."createdAt" < now() - interval '48 hours')::int AS mas48h,
              (SELECT COUNT(*) FROM "FaceVerification" fv WHERE fv."status" = 'SUBMITTED')::int AS "facialesEnviadas",
              (SELECT COUNT(*) FROM "ProfessionalDocument" pd WHERE pd."status" = 'PENDING')::int AS documentos
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND NOT u."isVerified"`,
        ]);
        const t = tiempos[0];
        out.verificacion = {
          verificadasEnPeriodo: t.n,
          horasRegistroAPublicado: { mediana: t.p50_h != null ? Math.round(Number(t.p50_h) * 10) / 10 : null, promedio: t.promedio_h != null ? Math.round(Number(t.promedio_h) * 10) / 10 : null, p90: t.p90_h != null ? Math.round(Number(t.p90_h) * 10) / 10 : null },
          distribucion,
          colaActual: cola[0],
        };
      }

      if (wanted.has("actividad")) {
        const [dist, inactivas, stories] = await Promise.all([
          prisma.$queryRaw<{ rango: string; perfiles: number }[]>`
            SELECT CASE WHEN d IS NULL THEN 'nunca' WHEN d <= 1 THEN 'hoy/ayer' WHEN d <= 7 THEN '2-7 días' WHEN d <= 30 THEN '8-30 días' ELSE '>30 días' END AS rango, COUNT(*)::int AS perfiles
            FROM (SELECT EXTRACT(EPOCH FROM (now() - u."lastSeen")) / 86400 AS d FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND u."isVerified") t
            GROUP BY 1 ORDER BY MIN(COALESCE(d, 1e9))`,
          prisma.$queryRaw<{ username: string; nombre: string | null; ciudad: string | null; tier: string | null; ultimoLogin: Date | null; ultimaEdicion: Date | null; diasSinLogin: number | null; historias30d: number; vistas30d: number }[]>`
            SELECT u."username", u."displayName" AS nombre, u."city" AS ciudad, u."tier"::text AS tier, u."lastSeen" AS "ultimoLogin", u."lastEditedAt" AS "ultimaEdicion",
              (EXTRACT(EPOCH FROM (now() - u."lastSeen")) / 86400)::int AS "diasSinLogin",
              (SELECT COUNT(*) FROM "Story" s WHERE s."userId" = u."id" AND s."createdAt" > now() - interval '30 days')::int AS historias30d,
              (SELECT COUNT(*) FROM "PageView" pv WHERE pv."path" LIKE '/profesional/%' AND split_part(pv."path", '/', 3) = u."id"::text AND pv."createdAt" > now() - interval '30 days')::int AS vistas30d
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND u."isVerified"
            ORDER BY u."lastSeen" ASC NULLS FIRST LIMIT ${take}`,
          prisma.$queryRaw<{ perfilesConHistorias: number; historias: number; publicados: number; editaronEnPeriodo: number }[]>`
            SELECT (SELECT COUNT(DISTINCT s."userId") FROM "Story" s JOIN "User" u ON u."id" = s."userId" AND ${pf} WHERE s."createdAt" >= ${period.from} AND s."createdAt" < ${period.to})::int AS "perfilesConHistorias",
              (SELECT COUNT(*) FROM "Story" s JOIN "User" u ON u."id" = s."userId" AND ${pf} WHERE s."createdAt" >= ${period.from} AND s."createdAt" < ${period.to})::int AS historias,
              (SELECT COUNT(*) FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND u."isVerified")::int AS publicados,
              (SELECT COUNT(*) FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."lastEditedAt" >= ${period.from} AND u."lastEditedAt" < ${period.to})::int AS "editaronEnPeriodo"`,
        ]);
        out.actividad = { distribucionUltimoLogin: dist, enElPeriodo: stories[0], masInactivas: inactivas, nota: "Último login = lastSeen (la app lo actualiza al entrar). Última edición = cambios en la ficha o fotos." };
      }

      if (wanted.has("tiers")) {
        const [dist, cambios, vencen, movimientos] = await Promise.all([
          prisma.$queryRaw<{ tier: string; perfiles: number; publicados: number }[]>`
            SELECT COALESCE(u."tier"::text, 'NINGUNO') AS tier, COUNT(*)::int AS perfiles, COUNT(*) FILTER (WHERE u."isActive" AND u."isVerified")::int AS publicados
            FROM "User" u WHERE ${pf} AND ${BUSINESS} GROUP BY 1 ORDER BY 2 DESC`,
          prisma.$queryRaw<{ de: string; a: string; cambios: number }[]>`
            SELECT COALESCE(h."fromTier", 'NINGUNO') AS de, COALESCE(h."toTier", 'NINGUNO') AS a, COUNT(*)::int AS cambios
            FROM "ProfileTierHistory" h JOIN "User" u ON u."id" = h."userId" AND ${pf}
            WHERE h."createdAt" >= ${period.from} AND h."createdAt" < ${period.to} GROUP BY 1,2 ORDER BY 3 DESC`,
          prisma.$queryRaw<{ username: string; nombre: string | null; tier: string | null; venceEl: Date; ciudad: string | null }[]>`
            SELECT u."username", u."displayName" AS nombre, u."tier"::text AS tier, u."membershipExpiresAt" AS "venceEl", u."city" AS ciudad
            FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."membershipExpiresAt" > now() AND u."membershipExpiresAt" <= now() + interval '7 days'
            ORDER BY u."membershipExpiresAt" LIMIT ${take}`,
          prisma.$queryRaw<{ altas: number; bajas: number; venceEn7d: number }[]>`
            SELECT
              (SELECT COUNT(*) FROM "ProfileTierHistory" h JOIN "User" u ON u."id" = h."userId" AND ${pf} WHERE h."createdAt" >= ${period.from} AND h."createdAt" < ${period.to}
                 AND COALESCE(array_position(ARRAY['SILVER','GOLD','PREMIUM'], h."toTier"), 0) > COALESCE(array_position(ARRAY['SILVER','GOLD','PREMIUM'], h."fromTier"), 0))::int AS altas,
              (SELECT COUNT(*) FROM "ProfileTierHistory" h JOIN "User" u ON u."id" = h."userId" AND ${pf} WHERE h."createdAt" >= ${period.from} AND h."createdAt" < ${period.to}
                 AND COALESCE(array_position(ARRAY['SILVER','GOLD','PREMIUM'], h."toTier"), 0) < COALESCE(array_position(ARRAY['SILVER','GOLD','PREMIUM'], h."fromTier"), 0))::int AS bajas,
              (SELECT COUNT(*) FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."membershipExpiresAt" > now() AND u."membershipExpiresAt" <= now() + interval '7 days')::int AS "venceEn7d"`,
        ]);
        out.tiers = {
          distribucion: dist,
          enElPeriodo: { ...movimientos[0], movimientos: cambios },
          vencenEn7Dias: vencen,
          nota: "Alta = subió de tier (NINGUNO < SILVER < GOLD < PREMIUM); baja = bajó. El historial existe desde este cambio.",
          grafico: "dona de distribución; barras altas vs bajas",
        };
      }

      return jsonResult(out);
    }),
  );
}
