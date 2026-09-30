import path from "node:path";
import fsp from "node:fs/promises";
import os from "node:os";
import { config } from "../config";
import { PRIVATE_DIR } from "../umate/privateStorage";
import {
  getObjectText,
  listAllObjects,
  putObjectBuffer,
  putObjectFromFile,
  type S3Config,
} from "./s3Client";
import { activeS3Config, contentTypeForKey, S3_PRIVATE_PREFIX, S3_PUBLIC_PREFIX, storageDriver } from "./s3Serve";

/**
 * Espejo disco → S3 (STORAGE_DRIVER=mirror).
 *
 * El disco sigue siendo la fuente de verdad: la app lee y escribe como siempre
 * y este proceso copia a S3 todo archivo nuevo o modificado. Es sólo aditivo:
 * NUNCA borra nada en S3 (si la app borra un archivo local, la copia en S3 se
 * queda). Al arrancar compara todo el disco contra el bucket y sube lo que
 * falte, así que también hace la carga inicial.
 */

type Root = { dir: string; prefix: string; exclude: string[] };

type Remote = { size: number; lastModified: number };

type PassStats = {
  startedAt: string;
  finishedAt?: string;
  filesSeen: number;
  uploaded: number;
  bytesUploaded: number;
  failed: number;
};

const status = {
  driver: "local" as string,
  bucket: "",
  region: "",
  healthy: false,
  startedAt: "",
  lastError: "" as string,
  lastErrorAt: "" as string,
  remoteObjects: 0,
  totalUploaded: 0,
  totalFailed: 0,
  passes: 0,
  lastPass: null as PassStats | null,
  running: false,
};

export function getS3MirrorStatus() {
  return { ...status, lastPass: status.lastPass ? { ...status.lastPass } : null };
}

/** Archivos modificados hace menos de esto se dejan para la próxima pasada (pueden estar escribiéndose). */
const SETTLE_MS = 15_000;
const RELIST_EVERY_MS = 24 * 60 * 60 * 1000;

function intEnv(name: string, def: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : def;
}

function roots(): Root[] {
  const uploads = path.resolve(config.storageDir);
  const blurCache = path.resolve(
    process.env.UMATE_BLUR_CACHE_DIR || path.join(uploads, "..", "umate-blur-cache"),
  );
  return [
    // Si el directorio privado o el caché quedaran dentro de uploads, no se copian bajo el prefijo público.
    { dir: uploads, prefix: S3_PUBLIC_PREFIX, exclude: [PRIVATE_DIR, blurCache] },
    { dir: PRIVATE_DIR, prefix: S3_PRIVATE_PREFIX, exclude: [blurCache] },
  ];
}

function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
}

async function* walk(dir: string, exclude: string[]): AsyncGenerator<string> {
  let handle;
  try {
    handle = await fsp.opendir(dir);
  } catch (err: any) {
    if (err?.code === "ENOENT") return;
    // Una carpeta ilegible no debe frenar el resto: se registra y se sigue.
    setError(`no se pudo leer ${dir}: ${err?.code || err?.message || err}`);
    return;
  }
  for await (const entry of handle) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (exclude.some((ex) => isInside(abs, ex))) continue;
      yield* walk(abs, exclude);
    } else if (entry.isFile()) {
      yield abs;
    }
    // symlinks, sockets, etc. se ignoran
  }
}

function setError(msg: string) {
  status.lastError = msg;
  status.lastErrorAt = new Date().toISOString();
}

class Mirror {
  private remote = new Map<string, Remote>();
  private lastListAt = 0;
  private concurrency = intEnv("S3_MIRROR_CONCURRENCY", 3, 1);

  constructor(private cfg: S3Config) {}

  async selfTest(): Promise<void> {
    const key = "_healthcheck/api.txt";
    const body = `uzeed s3 ok ${os.hostname()} ${new Date().toISOString()}`;
    await putObjectBuffer(this.cfg, key, Buffer.from(body), "text/plain; charset=utf-8");
    const read = await getObjectText(this.cfg, key);
    if (read !== body) throw new Error("SELFTEST_MISMATCH: lo leído no coincide con lo escrito");
  }

  async relist(): Promise<void> {
    const next = new Map<string, Remote>();
    for (const r of roots()) {
      for (const o of await listAllObjects(this.cfg, r.prefix)) {
        next.set(o.key, { size: o.size, lastModified: o.lastModified });
      }
    }
    this.remote = next;
    this.lastListAt = Date.now();
    status.remoteObjects = next.size;
  }

  async pass(): Promise<void> {
    if (Date.now() - this.lastListAt > RELIST_EVERY_MS) await this.relist();

    const stats: PassStats = {
      startedAt: new Date().toISOString(),
      filesSeen: 0,
      uploaded: 0,
      bytesUploaded: 0,
      failed: 0,
    };
    status.lastPass = stats;

    const queue: Array<{ abs: string; key: string; size: number }> = [];
    const now = Date.now();
    for (const r of roots()) {
      for await (const abs of walk(r.dir, r.exclude)) {
        let st;
        try {
          st = await fsp.stat(abs);
        } catch {
          continue; // se borró mientras recorríamos
        }
        stats.filesSeen++;
        // ctime no se puede falsear (touch -d / cp -p cambian mtime, no ctime): así ningún cambio se escapa.
        const changedAt = Math.max(st.mtimeMs, st.ctimeMs);
        if (now - changedAt < SETTLE_MS) continue;
        const rel = path.relative(r.dir, abs).split(path.sep).join("/");
        const key = r.prefix + rel;
        const remote = this.remote.get(key);
        if (remote && remote.size === st.size && remote.lastModified >= changedAt) continue;
        queue.push({ abs, key, size: st.size });
      }
    }

    let i = 0;
    const worker = async () => {
      while (i < queue.length) {
        const item = queue[i++];
        try {
          // Re-stat justo antes de subir: el tamaño firmado debe ser el real.
          const uploadStartedAt = Date.now();
          const st = await fsp.stat(item.abs);
          await putObjectFromFile(this.cfg, item.key, item.abs, st.size, contentTypeForKey(item.key));
          // Se guarda la hora de inicio: si el archivo cambió durante la subida, la próxima pasada lo re-sube.
          this.remote.set(item.key, { size: st.size, lastModified: Math.max(uploadStartedAt, st.mtimeMs, st.ctimeMs) });
          stats.uploaded++;
          stats.bytesUploaded += st.size;
          status.totalUploaded++;
        } catch (err: any) {
          if (err?.code === "ENOENT") continue; // la app lo borró; nada que copiar
          stats.failed++;
          status.totalFailed++;
          setError(`${item.key}: ${err?.message || err}`);
        }
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, worker));

    status.remoteObjects = this.remote.size;
    stats.finishedAt = new Date().toISOString();
    status.passes++;
    if (stats.uploaded || stats.failed) {
      console.log(
        `[s3-mirror] pasada: ${stats.filesSeen} archivos en disco, ${stats.uploaded} subidos ` +
          `(${(stats.bytesUploaded / 1024 / 1024).toFixed(1)} MB), ${stats.failed} con error`,
      );
    }
  }
}

function missingS3Env(): string[] {
  const has = (...names: string[]) => names.some((n) => (process.env[n] || "").trim());
  const out: string[] = [];
  if (!has("S3_BUCKET")) out.push("S3_BUCKET");
  if (!has("AWS_REGION", "AWS_DEFAULT_REGION")) out.push("AWS_REGION");
  if (!has("AWS_ACCESS_KEY_ID")) out.push("AWS_ACCESS_KEY_ID");
  if (!has("AWS_SECRET_ACCESS_KEY")) out.push("AWS_SECRET_ACCESS_KEY");
  return out;
}

let started = false;

export function startS3Mirror(): void {
  if (started) return;
  started = true;
  status.driver = storageDriver();
  if (status.driver === "local") return;

  const cfg = activeS3Config();
  if (!cfg) {
    setError(`STORAGE_DRIVER=mirror pero faltan o están vacías: ${missingS3Env().join(", ")}`);
    // Sólo nombres, nunca valores: ayuda a ver errores de tipeo (ej. AWS_SECRET_ACCESS sin _KEY).
    const similar = Object.keys(process.env).filter((k) => /^\s*(AWS|S3)/i.test(k)).sort();
    console.error(
      `[s3-mirror] ${status.lastError}. Variables AWS/S3 que sí existen: ${similar.map((k) => JSON.stringify(k)).join(", ") || "(ninguna)"}. ` +
        "El espejo NO está activo; la app sigue usando sólo el disco.",
    );
    return;
  }
  status.bucket = cfg.bucket;
  status.region = cfg.region;
  status.startedAt = new Date().toISOString();

  const mirror = new Mirror(cfg);
  const intervalMs = intEnv("S3_MIRROR_INTERVAL_SECONDS", 120, 30) * 1000;

  const loop = async () => {
    if (status.running) return;
    status.running = true;
    try {
      if (!status.healthy) {
        await mirror.selfTest();
        await mirror.relist();
        status.healthy = true;
        console.log(`[s3-mirror] conectado a s3://${cfg.bucket} (${cfg.region}); ${status.remoteObjects} objetos ya en el bucket`);
      }
      await mirror.pass();
    } catch (err: any) {
      status.healthy = false;
      setError(err?.message || String(err));
      console.error(`[s3-mirror] error: ${status.lastError}. Se reintenta en ${intervalMs / 1000}s; el disco no se toca.`);
    } finally {
      status.running = false;
    }
  };

  // Arranca un poco después del boot para no competir con el inicio de la API.
  setTimeout(() => {
    void loop();
    setInterval(() => void loop(), intervalMs).unref();
  }, 10_000).unref();
}
