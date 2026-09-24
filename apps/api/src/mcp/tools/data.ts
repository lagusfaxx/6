import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { sqlReader, sqlReaderConfigured } from "../sqlReader";
import { guarded, type McpContext } from "../audit";
import { TZ, errorResult, jsonResult } from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

/**
 * La consulta corre dentro de una transacción READ ONLY, así que no puede
 * escribir. Esto corta además lo que sirve para leer el disco del servidor,
 * dormir la base o mirar la tabla de sesiones (cookies vigentes) y columnas
 * de credenciales. Los nombres de columna igual se vuelven a tapar al salir.
 */
const FORBIDDEN_SQL: [RegExp, string][] = [
  // Catálogos y funciones de sistema, SQL dinámico (query_to_xml y familia),
  // cambio de rol/configuración y escapes Unicode que esconden nombres.
  [/\bpg_|_to_xml|\bxml|\b(lo_[a-z]+|dblink\w*|copy|set_config|current_setting|set\s+role|reset|do|execute|prepare|listen|notify)\b/i, "funciones de sistema"],
  [/\bU&|\bE'|\$\$|\$[A-Za-z_]\w*\$/i, "cadenas con escapes"],
  // \b deja pasar "sessionId" (columna de PageView) y corta la tabla "session".
  [/\bsession\b/i, "la tabla de sesiones"],
  [/passwordHash|passwordSetToken|twoFactorSecret|tokenHash|p256dh/i, "columnas de credenciales"],
];

/** Vistas agregadas que crea la migración para consulta_sql (ver mcp_reader_refresh_grants). */
const VISTAS = [
  {
    vista: "mcp_cuenta_datos",
    columnas: ["userId", "tieneEmail", "dominioEmail", "tieneTelefono", "tieneUbicacionExacta", "tieneDireccion", "verificadoPorTelefono", "tieneTarjetaGuardada", "tiene2fa"],
    para: "Qué datos de contacto tiene cada cuenta, sin el dato (dominioEmail sólo si es un proveedor masivo, si no 'otro'). Se cruza con \"User\" por userId.",
  },
  {
    vista: "mcp_zona_perfiles",
    columnas: ["latAprox", "lngAprox", "tipoPerfil", "perfiles", "publicados"],
    para: "Mapa de oferta por celda de ~1 km; sólo celdas con 3 o más perfiles.",
  },
  {
    vista: "mcp_mensajes_diarios",
    columnas: ["dia", "fromId", "toId", "mensajes", "leidos", "largoPromedio"],
    para: "Mensajes por día (hora de Chile) y par remitente→destinatario, sin el texto.",
  },
];

const HEAVY_TIMEOUT_MS = 60_000;
const NORMAL_TIMEOUT_MS = 20_000;
const HEAVY_PER_HOUR = 5;

/**
 * Traduce el error de Postgres a algo que Claude pueda corregir: el código y
 * el mensaje hablan de la consulta que él mismo escribió (columna que no
 * existe, valor de enum, sintaxis). Lo que no sea de la consulta sigue saliendo
 * genérico, con el detalle sólo en la bitácora.
 */
function explainSqlError(err: any): string | null {
  const meta = err?.meta ?? {};
  const raw = String(err?.message ?? "");
  const code: string | undefined = meta.code ?? raw.match(/Code: `(\w{5})`/)?.[1];
  const pgMessage = String(meta.message ?? raw.match(/Message: `([\s\S]*?)`\s*$/)?.[1] ?? "")
    .replace(/^ERROR:\s*/, "")
    .slice(0, 400);
  if (!code) return null;

  if (code === "22P02") {
    const m = pgMessage.match(/invalid input value for enum "?(\w+)"?: "([^"]*)"/);
    if (m) {
      const e = Prisma.dmmf.datamodel.enums.find((x) => x.name === m[1]);
      const valores = e ? e.values.map((v) => v.name).join(", ") : "revisa describir_esquema";
      return `"${m[2]}" no es un valor de ${m[1]}. Valores válidos: ${valores}.`;
    }
  }
  if (code === "42501") {
    return "La consulta toca una columna o tabla que el MCP no puede leer (dato sensible). Nombra sólo las columnas que necesitas o usa las vistas mcp_* de describir_esquema.";
  }
  if (code === "57014") {
    return `La consulta superó el tiempo máximo. Acota el rango de fechas, agrega filtros o repite con pesada=true (${HEAVY_TIMEOUT_MS / 1000} s, máximo ${HEAVY_PER_HOUR} por hora).`;
  }
  // 22xxx (datos) y 42xxx (sintaxis, nombres, tipos, agrupación): son errores de la consulta.
  if (/^(22|42)/.test(code)) {
    const hint = code === "42703" || code === "42P01" ? " Recuerda: tablas y columnas camelCase van entre comillas dobles (\"User\".\"createdAt\")." : "";
    return `Error de Postgres ${code}: ${pgMessage}.${hint}`;
  }
  return null;
}

function validateSql(sql: string): string | null {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) return "Sólo se permiten consultas SELECT (o WITH ... SELECT).";
  if (trimmed.includes(";")) return "Sólo una sentencia por consulta (sin ';' intermedios).";
  for (const [re, what] of FORBIDDEN_SQL) {
    if (re.test(trimmed)) return `La consulta toca ${what}, que no están disponibles por el MCP.`;
  }
  return null;
}

export function registerDataTools(server: McpServer, ctx: McpContext) {
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
    guarded("describir_esquema", ctx, async ({ tabla }: { tabla?: string }) => {
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
          vistas: VISTAS,
          enums: enums.map((e) => ({ nombre: e.name, valores: e.values.map((v) => v.name) })),
          notaEnums: "Los valores de enum están en inglés o en español según la tabla (ServiceRequestStatus usa FINALIZADO; MarketOrderStatus usa COMPLETED). Úsalos tal cual.",
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

  if (sqlReaderConfigured()) server.registerTool(
    "consulta_sql",
    {
      title: "Consulta SQL de sólo lectura",
      description:
        "Ejecuta un SELECT libre sobre la base PostgreSQL de UZEED para cualquier estadística o informe que las otras herramientas no cubran (cohortes, embudos, cruces, retención...). Corre con un usuario de base de datos de sólo lectura, en transacción READ ONLY, con límite de 20 s (60 s con pesada=true, máximo 5 por hora) y de filas. La base niega columnas sensibles (credenciales, email, teléfonos, mensajes privados, datos bancarios, ubicación exacta, documentos): no uses SELECT *, nombra las columnas; para esas preguntas usa las vistas mcp_* (mcp_cuenta_datos, mcp_zona_perfiles, mcp_mensajes_diarios). Tablas y columnas camelCase van entre comillas dobles. Revisa describir_esquema primero: trae los valores de cada enum. Si la consulta falla, el error dice qué corregir. Queda en la bitácora.",
      inputSchema: {
        sql: z.string().min(1).max(20000).describe("Una sola sentencia SELECT o WITH ... SELECT."),
        limite: z.number().int().min(1).max(2000).optional().describe("Máximo de filas a devolver (por defecto 500)."),
        pesada: z.boolean().optional().describe("true para cohortes o cruces largos: 60 s en vez de 20 s. Máximo 5 por hora."),
      },
      annotations: READ,
    },
    guarded(
      "consulta_sql",
      ctx,
      async ({ sql, limite, pesada }: { sql: string; limite?: number; pesada?: boolean }) => {
        const problem = validateSql(sql);
        if (problem) return errorResult(problem);
        if (pesada) {
          const recent = await prisma.mcpAuditLog.count({
            where: {
              tool: "consulta_sql",
              userId: ctx.userId,
              createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
              args: { path: ["pesada"], equals: true },
            },
          });
          if (recent >= HEAVY_PER_HOUR) {
            return errorResult(`Ya usaste ${HEAVY_PER_HOUR} consultas pesadas en la última hora. Acota la consulta para que corra en 20 s o espera.`);
          }
        }
        const timeoutMs = pesada ? HEAVY_TIMEOUT_MS : NORMAL_TIMEOUT_MS;
        const limit = limite ?? 500;
        const body = sql.trim().replace(/;\s*$/, "");
        const started = Date.now();
        let rows: Record<string, unknown>[];
        try {
          rows = await sqlReader().$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
              await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeoutMs}`);
              return tx.$queryRawUnsafe<Record<string, unknown>[]>(
                `SELECT * FROM (\n${body}\n) AS mcp_q LIMIT ${limit + 1}`,
              );
            },
            { timeout: timeoutMs + 5000, maxWait: 5000 },
          );
        } catch (err) {
          const explained = explainSqlError(err);
          if (explained) return errorResult(explained);
          throw err;
        }
        const truncated = rows.length > limit;
        return jsonResult({
          filas: truncated ? rows.slice(0, limit) : rows,
          totalDevuelto: Math.min(rows.length, limit),
          truncado: truncated,
          ms: Date.now() - started,
        });
      }
    ),
  );

  if (ctx.scope === "full") server.registerTool(
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
    guarded("ver_bitacora", ctx, async ({ herramienta, limite }: { herramienta?: string; limite?: number }) => {
      const rows = await prisma.mcpAuditLog.findMany({
        where: herramienta ? { tool: herramienta } : undefined,
        orderBy: { createdAt: "desc" },
        take: limite ?? 30,
      });
      return jsonResult({ registros: rows });
    }),
  );
}
