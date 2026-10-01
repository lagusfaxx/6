import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import cron from "node-cron";
import { Router } from "express";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { listAllObjects, putObjectFromFile, readS3ConfigFromEnv, type S3Config } from "./s3Client";

/**
 * Respaldo diario de la base de datos al mismo bucket S3 de los archivos.
 *
 * Corre `pg_dump` (formato custom, ya comprimido) y lo sube a
 * `db-backups/uzeed-AAAA-MM-DD-HHmm.dump`. Ese prefijo no lo sirve nunca la
 * API: /uploads sólo lee `uploads/` del bucket.
 *
 * Es sólo aditivo: no borra respaldos viejos (eso se configura con una regla
 * de ciclo de vida en el bucket). Se enciende solo cuando están las
 * credenciales S3; DB_BACKUP_ENABLED=false lo apaga.
 *
 * Restaurar (con pg_restore 17, la misma versión del servidor):
 *   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" uzeed-....dump
 */

export const DB_BACKUP_PREFIX = "db-backups/";
const SCHEDULE = "10 4 * * *"; // 04:10 hora de Chile, con poco tráfico
const STALE_MS = 20 * 60 * 60 * 1000;

const status = {
  enabled: false,
  bucket: "",
  running: false,
  lastOkAt: "",
  lastKey: "",
  lastSizeBytes: 0,
  lastDurationMs: 0,
  lastError: "",
  lastErrorAt: "",
};

export function getDbBackupStatus() {
  return { ...status };
}

function backupEnabled(): boolean {
  return (process.env.DB_BACKUP_ENABLED || "true").trim().toLowerCase() !== "false";
}

/**
 * Prisma agrega parámetros a DATABASE_URL (schema, connection_limit,
 * pgbouncer…) que libpq no entiende. Se dejan sólo los de conexión y la clave
 * va por PGPASSWORD para que no aparezca en la lista de procesos.
 */
function pgConnection(databaseUrl: string): { url: string; password: string } {
  const u = new URL(databaseUrl);
  const password = decodeURIComponent(u.password || "");
  u.password = "";
  const keep = new Set(["sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout", "options"]);
  for (const key of [...u.searchParams.keys()]) if (!keep.has(key)) u.searchParams.delete(key);
  return { url: u.toString(), password };
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z`;
}

function runPgDump(outFile: string): Promise<void> {
  const { url, password } = pgConnection(process.env.DATABASE_URL || "");
  const args = [
    "--format=custom",
    "--compress=6",
    "--no-owner",
    "--no-privileges",
    // Las sesiones no se respaldan: un respaldo filtrado no debe servir para
    // entrar como nadie, y al restaurar todos vuelven a iniciar sesión.
    "--exclude-table-data=session",
    `--file=${outFile}`,
    `--dbname=${url}`,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", args, {
      env: { ...process.env, PGPASSWORD: password },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += String(chunk);
    });
    child.on("error", (err: any) =>
      reject(new Error(err?.code === "ENOENT" ? "pg_dump no está instalado en el contenedor" : err?.message)),
    );
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pg_dump terminó con código ${code}: ${stderr.trim().slice(0, 500)}`)),
    );
  });
}

export async function runDbBackup(cfg: S3Config): Promise<{ key: string; size: number }> {
  if (status.running) throw new Error("Ya hay un respaldo en curso");
  status.running = true;
  const started = Date.now();
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "uzeed-db-"));
  const file = path.join(dir, "backup.dump");
  try {
    await runPgDump(file);
    const { size } = await fsp.stat(file);
    const key = `${DB_BACKUP_PREFIX}uzeed-${stamp()}.dump`;
    await putObjectFromFile(cfg, key, file, size, "application/octet-stream");
    Object.assign(status, {
      lastOkAt: new Date().toISOString(),
      lastKey: key,
      lastSizeBytes: size,
      lastDurationMs: Date.now() - started,
      lastError: "",
    });
    console.log(`[db-backup] ok s3://${cfg.bucket}/${key} (${(size / 1024 / 1024).toFixed(1)} MB, ${Math.round((Date.now() - started) / 1000)} s)`);
    return { key, size };
  } catch (err: any) {
    status.lastError = String(err?.message || err);
    status.lastErrorAt = new Date().toISOString();
    console.error(`[db-backup] FALLÓ: ${status.lastError}`);
    throw err;
  } finally {
    status.running = false;
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** ¿El último respaldo del bucket tiene menos de 20 h? */
async function hasRecentBackup(cfg: S3Config): Promise<boolean> {
  const objects = await listAllObjects(cfg, DB_BACKUP_PREFIX);
  const newest = objects.reduce((max, o) => Math.max(max, o.lastModified), 0);
  return newest > 0 && Date.now() - newest < STALE_MS;
}

let started = false;

export function startDbBackups(): void {
  if (started) return;
  started = true;
  if (!backupEnabled()) {
    console.log("[db-backup] desactivado (DB_BACKUP_ENABLED=false)");
    return;
  }
  const cfg = readS3ConfigFromEnv();
  if (!cfg) {
    console.warn("[db-backup] sin credenciales S3 (S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY): NO hay respaldos de la base");
    return;
  }
  status.enabled = true;
  status.bucket = cfg.bucket;

  cron.schedule(SCHEDULE, () => void runDbBackup(cfg).catch(() => {}), { timezone: "America/Santiago" });

  // Al arrancar: si no hay un respaldo reciente (primer deploy, o el
  // contenedor estuvo caído a la hora programada), se hace uno a los 5 min.
  setTimeout(() => {
    hasRecentBackup(cfg)
      .then((recent) => (recent ? undefined : runDbBackup(cfg)))
      .catch((err) => console.error("[db-backup] chequeo inicial falló:", err?.message || err));
  }, 5 * 60 * 1000).unref();

  console.log(`[db-backup] activo: todos los días 04:10 (Chile) a s3://${cfg.bucket}/${DB_BACKUP_PREFIX}`);
}

/** Estado del respaldo para el panel (sólo administración). */
export const dbBackupAdminRouter = Router();

dbBackupAdminRouter.get(
  "/admin/db-backup",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    return res.json(getDbBackupStatus());
  }),
);
