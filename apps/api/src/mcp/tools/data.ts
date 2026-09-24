import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { guarded, type McpScope } from "../audit";
import { TZ, errorResult, jsonResult } from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

/**
 * La consulta corre dentro de una transacción READ ONLY, así que no puede
 * escribir. Esto corta además lo que sirve para leer el disco del servidor,
 * dormir la base o mirar la tabla de sesiones (cookies vigentes) y columnas
 * de credenciales. Los nombres de columna igual se vuelven a tapar al salir.
 */
const FORBIDDEN_SQL: [RegExp, string][] = [
  [/\bpg_(read|ls|stat_file|sleep|terminate|cancel|reload|rotate)/i, "funciones de sistema"],
  [/\b(lo_import|lo_export|dblink|copy|set_config|current_setting)\b/i, "funciones de sistema"],
  // \b deja pasar "sessionId" (columna de PageView) y corta la tabla "session".
  [/\bsession\b/i, "la tabla de sesiones"],
  [/passwordHash|passwordSetToken|twoFactorSecret|tokenHash|p256dh/i, "columnas de credenciales"],
];

function validateSql(sql: string): string | null {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) return "Sólo se permiten consultas SELECT (o WITH ... SELECT).";
  if (trimmed.includes(";")) return "Sólo una sentencia por consulta (sin ';' intermedios).";
  for (const [re, what] of FORBIDDEN_SQL) {
    if (re.test(trimmed)) return `La consulta toca ${what}, que no están disponibles por el MCP.`;
  }
  return null;
}

export function registerDataTools(server: McpServer, scope: McpScope) {
  server.registerTool(
    "describir_esquema",
    {
      title: "Describir el esquema de datos",
      description:
        "Lista las tablas (modelos Prisma) de la base de UZEED con sus columnas, tipos, relaciones y enums. Sin parámetros devuelve el índice de tablas; con `tabla` devuelve el detalle. Úsala antes de escribir una consulta_sql.",
      inputSchema: {
        tabla: z.string().optional().describe("Nombre exacto del modelo, ej: User, PaymentIntent, MarketOrder."),
      },
      annotations: READ,
    },
    guarded("describir_esquema", scope, async ({ tabla }: { tabla?: string }) => {
      const { models, enums } = Prisma.dmmf.datamodel;
      if (!tabla) {
        return jsonResult({
          nota: `Las tablas se llaman igual que el modelo y van entre comillas dobles en SQL ("User", "PaymentIntent"). Fechas en UTC sin zona; para Chile usar ("col" AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}'.`,
          tablas: models.map((m) => ({
            tabla: m.name,
            columnas: m.fields.filter((f) => f.kind !== "object").length,
            relaciones: m.fields.filter((f) => f.kind === "object").map((f) => f.type),
            doc: m.documentation,
          })),
          enums: enums.map((e) => e.name),
        });
      }
      const model = models.find((m) => m.name.toLowerCase() === tabla.toLowerCase());
      if (!model) return errorResult(`No existe la tabla "${tabla}". Llama describir_esquema sin parámetros para ver la lista.`);
      const usedEnums = new Set(model.fields.filter((f) => f.kind === "enum").map((f) => f.type));
      return jsonResult({
        tabla: model.name,
        doc: model.documentation,
        columnas: model.fields
          .filter((f) => f.kind !== "object")
          .map((f) => ({
            nombre: f.name,
            tipo: f.type + (f.isList ? "[]" : ""),
            obligatorio: f.isRequired,
            clave: f.isId || undefined,
            unica: f.isUnique || undefined,
            doc: f.documentation,
          })),
        relaciones: model.fields
          .filter((f) => f.kind === "object")
          .map((f) => ({ nombre: f.name, tabla: f.type, lista: f.isList, columnas: f.relationFromFields })),
        enums: enums
          .filter((e) => usedEnums.has(e.name))
          .map((e) => ({ nombre: e.name, valores: e.values.map((v) => v.name) })),
      });
    }),
  );

  server.registerTool(
    "consulta_sql",
    {
      title: "Consulta SQL de sólo lectura",
      description:
        "Ejecuta un SELECT libre sobre la base PostgreSQL de UZEED para cualquier estadística o informe que las otras herramientas no cubran (cohortes, embudos, cruces, retención...). Corre en una transacción READ ONLY con límite de 20 s y de filas. Tablas y columnas camelCase van entre comillas dobles. Revisa describir_esquema primero. Queda en la bitácora.",
      inputSchema: {
        sql: z.string().min(1).max(20000).describe("Una sola sentencia SELECT o WITH ... SELECT."),
        limite: z.number().int().min(1).max(2000).optional().describe("Máximo de filas a devolver (por defecto 500)."),
      },
      annotations: READ,
    },
    guarded(
      "consulta_sql",
      scope,
      async ({ sql, limite }: { sql: string; limite?: number }) => {
        const problem = validateSql(sql);
        if (problem) return errorResult(problem);
        const limit = limite ?? 500;
        const body = sql.trim().replace(/;\s*$/, "");
        const started = Date.now();
        const rows = await prisma.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 20000");
            return tx.$queryRawUnsafe<Record<string, unknown>[]>(
              `SELECT * FROM (\n${body}\n) AS mcp_q LIMIT ${limit + 1}`,
            );
          },
          { timeout: 25000, maxWait: 5000 },
        );
        const truncated = rows.length > limit;
        return jsonResult({
          filas: truncated ? rows.slice(0, limit) : rows,
          totalDevuelto: Math.min(rows.length, limit),
          truncado: truncated,
          ms: Date.now() - started,
        });
      },
      { audit: true },
    ),
  );

  server.registerTool(
    "ver_bitacora",
    {
      title: "Ver bitácora del MCP",
      description: "Últimas operaciones registradas por el servidor MCP (acciones que cambiaron datos y consultas SQL), con sus argumentos y si salieron bien.",
      inputSchema: {
        herramienta: z.string().optional(),
        limite: z.number().int().min(1).max(200).optional().describe("Por defecto 30."),
      },
      annotations: READ,
    },
    guarded("ver_bitacora", scope, async ({ herramienta, limite }: { herramienta?: string; limite?: number }) => {
      const rows = await prisma.mcpAuditLog.findMany({
        where: herramienta ? { tool: herramienta } : undefined,
        orderBy: { createdAt: "desc" },
        take: limite ?? 30,
      });
      return jsonResult({ registros: rows });
    }),
  );
}
