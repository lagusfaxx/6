import { Prisma } from "@prisma/client";
import { config } from "../config";

/**
 * Filtros para que las estadísticas cuenten sólo actividad real.
 *
 * Tráfico (PageView / UserAction):
 *  - Bots y herramientas: Googlebot y compañía ejecutan JS y disparan el
 *    beacon de páginas vistas; también monitores de uptime y scripts.
 *  - El equipo: cada vez que el admin o una moderadora revisa un perfil o
 *    prueba el botón de WhatsApp, eso no es un cliente.
 *  - Las páginas /admin: son del panel, no del sitio.
 *
 * Usuarios (User):
 *  - Perfiles de prueba del seed (@testseed.uzeed.cl).
 *  - Cuentas del equipo (ADMIN, MODERATOR y el correo del administrador).
 *  - Para "registros" además se separan los perfiles que carga el admin
 *    (`adminManaged`): son altas del equipo, no gente que se registró sola.
 */

/** Patrón (POSIX, sin distinguir mayúsculas) de user agents que no son personas. */
export const BOT_UA_PATTERN =
  "bot|crawl|spider|slurp|mediapartners|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|" +
  "preview|facebookexternalhit|embedly|whatsapp/|telegram|discord|skype|curl|wget|python|axios|node-fetch|" +
  "undici|go-http|java/|okhttp|postman|insomnia|scrapy|httpclient|libwww|phantom|selenium|puppeteer|playwright";

export const TEST_EMAIL_SUFFIX = "@testseed.uzeed.cl";

/** Subconsulta con los ids del equipo (para excluir su tráfico). */
export function staffIdsSql(): Prisma.Sql {
  return Prisma.sql`(SELECT "id" FROM "User" WHERE "role" IN ('ADMIN', 'MODERATOR') OR "email" = ${config.adminEmail})`;
}

/** Condición SQL de página vista real. `alias` es el alias de "PageView". */
export function realPageViewSql(alias = "pv"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(
    ${a}."path" NOT LIKE '/admin%'
    AND (${a}."userAgent" IS NULL OR ${a}."userAgent" !~* ${BOT_UA_PATTERN})
    AND (${a}."userId" IS NULL OR ${a}."userId" NOT IN ${staffIdsSql()})
  )`;
}

/** Condición SQL de acción real (click) de alguien que no es del equipo. */
export function realActionSql(alias = "ua"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(${a}."userId" IS NULL OR ${a}."userId" NOT IN ${staffIdsSql()})`;
}

/**
 * Quién es el visitante de una página vista. `visitorId` dura entre visitas
 * (localStorage); las filas antiguas sólo traen `sessionId`, que es por
 * pestaña, así que en periodos anteriores al cambio el número sale algo más alto.
 */
export function visitorKeySql(alias = "pv"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(${a}."visitorId", ${a}."sessionId", ${a}."userId"::text, ${a}."id"::text)`;
}

/** Quién hizo una acción, para deduplicar clicks repetidos. */
export function actorKeySql(alias = "ua"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(${a}."userId"::text, ${a}."visitorId", ${a}."sessionId", ${a}."id"::text)`;
}

/** Filtro Prisma de usuarios reales: sin perfiles de prueba ni cuentas del equipo. */
export function realUserWhere(): Prisma.UserWhereInput {
  return {
    NOT: [
      { email: { endsWith: TEST_EMAIL_SUFFIX } },
      { email: config.adminEmail },
      { role: { in: ["ADMIN", "MODERATOR"] } },
    ],
  };
}

/** Registros orgánicos: usuarios reales que se registraron solos. */
export function organicSignupWhere(): Prisma.UserWhereInput {
  return { AND: [realUserWhere(), { adminManaged: false }] };
}

/** Lo mismo que `realUserWhere` en SQL, para consultas crudas sobre "User". */
export function realUserSql(alias = "u"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(
    ${a}."email" NOT LIKE ${"%" + TEST_EMAIL_SUFFIX}
    AND ${a}."email" <> ${config.adminEmail}
    AND ${a}."role" NOT IN ('ADMIN', 'MODERATOR')
  )`;
}
