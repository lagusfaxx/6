import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "../config";

/**
 * Imágenes PNG por perfil para mandar por WhatsApp: la tarjeta de métricas
 * y el flyer con texto libre, ambas con la foto del perfil. Se dibujan en
 * SVG y sharp las pasa a PNG. Necesitan fuentes instaladas en el contenedor
 * (fonts-dejavu-core en el Dockerfile): sin ellas el texto sale en blanco.
 */

export type MetricValue = { actual: number; anterior: number };

export type MetricsCardData = {
  nombre: string;
  periodo: string; // ej. "Del 8 al 14 de octubre"
  /** Foto del perfil ya cargada con loadProfilePhoto; sin ella va la inicial. */
  foto?: Buffer | null;
  visitantes: MetricValue;
  contactos: MetricValue;
  impresiones: MetricValue;
  favoritos: MetricValue;
  mensajes: MetricValue;
};

export type FlyerData = {
  nombre: string;
  titulo: string;
  texto: string;
  foto?: Buffer | null;
  /** Línea final, ej. "uzeed.cl/profesional/vale". */
  pie: string;
};

export const W = 1080;
const H = 1350;
/** Alto de la foto en el flyer y diámetro del avatar en la tarjeta. */
export const FLYER_PHOTO_H = 860;
export const AVATAR_PX = 420;
const FONT = "DejaVu Sans, Arial, sans-serif";
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Parte el texto en líneas de hasta `max` caracteres (respeta saltos de línea). */
function wrap(text: string, max: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if ((line + " " + word).length <= max) line += " " + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  const out = lines.map((l) => cut(l, max));
  if (out.length > maxLines) {
    out.length = maxLines;
    out[maxLines - 1] = cut(out[maxLines - 1] + "…", max);
  }
  return out;
}

/**
 * Lee la foto del perfil (avatarUrl). Las de /uploads se leen del disco; las
 * que vienen con URL completa se descargan. Devuelve un JPEG recortado al
 * tamaño pedido (centrado en lo más llamativo, normalmente la cara), o null
 * si no hay foto o no se pudo leer.
 */
export async function loadProfilePhoto(avatarUrl: string | null | undefined, width: number, height: number): Promise<Buffer | null> {
  if (!avatarUrl) return null;
  try {
    let raw: Buffer | null = null;
    const url = new URL(avatarUrl, config.apiUrl);
    if (url.pathname.startsWith("/uploads/")) {
      const base = path.resolve(config.storageDir);
      const file = path.resolve(base, decodeURIComponent(url.pathname.slice("/uploads/".length)));
      if (file.startsWith(base + path.sep)) raw = await fs.readFile(file).catch(() => null);
    }
    if (!raw && (url.protocol === "https:" || url.protocol === "http:")) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const len = Number(res.headers.get("content-length") || 0);
      if (res.ok && len <= MAX_PHOTO_BYTES) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length <= MAX_PHOTO_BYTES) raw = buf;
      }
    }
    if (!raw) return null;
    return await sharp(raw).rotate().resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
}

function photoHref(foto: Buffer): string {
  return `data:image/jpeg;base64,${foto.toString("base64")}`;
}

/** Foto redonda con borde de color, o la inicial si no hay foto. */
function avatar(cx: number, cy: number, r: number, nombre: string, foto?: Buffer | null): string {
  const inner = foto
    ? `<clipPath id="av"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
  <image href="${photoHref(foto)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a2a35"/>
  <text x="${cx}" y="${cy + r * 0.35}" text-anchor="middle" font-family="${FONT}" font-size="${r}" font-weight="bold" fill="#e879f9">${esc((nombre.trim()[0] || "U").toUpperCase())}</text>`;
  return `${inner}
  <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="url(#accent)" stroke-width="8"/>`;
}

const DEFS = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a0f24"/>
      <stop offset="1" stop-color="#0e0e12"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e879f9"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#0e0e12" stop-opacity="0"/>
      <stop offset="1" stop-color="#0e0e12" stop-opacity="1"/>
    </linearGradient>
  </defs>`;

/** "+12%", "−8%", "nuevo" o "" si no hay base para comparar. */
function delta(v: MetricValue): { text: string; up: boolean | null } {
  if (v.anterior <= 0) return v.actual > 0 ? { text: "nuevo", up: true } : { text: "", up: null };
  const pct = Math.round(((v.actual - v.anterior) / v.anterior) * 100);
  if (pct === 0) return { text: "= periodo anterior", up: null };
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs anterior`, up: pct > 0 };
}

function tile(x: number, y: number, w: number, h: number, label: string, v: MetricValue): string {
  const d = delta(v);
  const color = d.up === null ? "#94a3b8" : d.up ? "#6ee7b7" : "#fda4af";
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="32" fill="#18181f" stroke="#2a2a35" stroke-width="2"/>
  <text x="${x + 40}" y="${y + 70}" font-family="${FONT}" font-size="34" fill="#cbd5e1">${esc(label)}</text>
  <text x="${x + 40}" y="${y + 172}" font-family="${FONT}" font-size="96" font-weight="bold" fill="#ffffff">${fmt(v.actual)}</text>
  <text x="${x + 40}" y="${y + h - 40}" font-family="${FONT}" font-size="30" fill="${color}">${esc(d.text)}</text>`;
}

export function metricsCardSvg(d: MetricsCardData): string {
  const gap = 32;
  const pad = 64;
  const tw = (W - pad * 2 - gap) / 2;
  const th = 270;
  const top = 360;
  const tasa = d.visitantes.actual > 0 ? Math.round((d.contactos.actual / d.visitantes.actual) * 1000) / 10 : 0;
  // Encabezado: foto a la izquierda, marca, nombre y periodo a la derecha.
  const r = 105;
  const tx = pad + r * 2 + 48;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${avatar(pad + r, 190, r, d.nombre, d.foto)}
  <text x="${tx}" y="130" font-family="${FONT}" font-size="36" font-weight="bold" fill="#e879f9" letter-spacing="6">UZEED</text>
  <text x="${tx}" y="212" font-family="${FONT}" font-size="60" font-weight="bold" fill="#ffffff">${esc(cut(d.nombre, 20))}</text>
  <text x="${tx}" y="268" font-family="${FONT}" font-size="32" fill="#94a3b8">${esc(cut(d.periodo, 38))}</text>
  ${tile(pad, top, tw, th, "Vieron tu perfil", d.visitantes)}
  ${tile(pad + tw + gap, top, tw, th, "Contactos WhatsApp", d.contactos)}
  ${tile(pad, top + th + gap, tw, th, "Apariciones", d.impresiones)}
  ${tile(pad + tw + gap, top + th + gap, tw, th, "Mensajes recibidos", d.mensajes)}
  ${tile(pad, top + (th + gap) * 2, tw, th, "Nuevos favoritos", d.favoritos)}
  <rect x="${pad + tw + gap}" y="${top + (th + gap) * 2}" width="${tw}" height="${th}" rx="32" fill="url(#accent)"/>
  <text x="${pad + tw + gap + 40}" y="${top + (th + gap) * 2 + 70}" font-family="${FONT}" font-size="34" fill="#ffffff">Tasa de contacto</text>
  <text x="${pad + tw + gap + 40}" y="${top + (th + gap) * 2 + 172}" font-family="${FONT}" font-size="96" font-weight="bold" fill="#ffffff">${tasa.toLocaleString("es-CL")}%</text>
  <text x="${pad + tw + gap + 40}" y="${top + (th + gap) * 2 + th - 40}" font-family="${FONT}" font-size="30" fill="#ffffff">de tus visitas te escribió</text>
  <text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-family="${FONT}" font-size="30" fill="#64748b">uzeed.cl · Mejora tu perfil para recibir más contactos</text>
</svg>`;
}

/** Flyer: foto grande arriba que se funde con el fondo, nombre, título y texto. */
export function flyerSvg(d: FlyerData): string {
  const pad = 72;
  const photoH = FLYER_PHOTO_H;
  const titulo = wrap(d.titulo, 22, 2);
  const texto = wrap(d.texto, 44, 4);
  let y = photoH - 40;
  const nameY = y;
  y += 110;
  const tituloSvg = titulo
    .map((l, i) => `<text x="${pad}" y="${y + i * 80}" font-family="${FONT}" font-size="68" font-weight="bold" fill="url(#accent)">${esc(l)}</text>`)
    .join("\n  ");
  y += titulo.length * 80 + 10;
  const textoSvg = texto
    .map((l, i) => `<text x="${pad}" y="${y + i * 50}" font-family="${FONT}" font-size="38" fill="#e2e8f0">${esc(l)}</text>`)
    .join("\n  ");

  const photo = d.foto
    ? `<image href="${photoHref(d.foto)}" x="0" y="0" width="${W}" height="${photoH}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${W}" height="${photoH}" fill="url(#accent)" opacity="0.35"/>
  <text x="${W / 2}" y="${photoH / 2 + 120}" text-anchor="middle" font-family="${FONT}" font-size="360" font-weight="bold" fill="#ffffff" opacity="0.5">${esc((d.nombre.trim()[0] || "U").toUpperCase())}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${DEFS}
  <rect width="${W}" height="${H}" fill="#0e0e12"/>
  ${photo}
  <rect width="${W}" height="${photoH}" fill="url(#fade)"/>
  <rect x="${pad}" y="64" width="190" height="64" rx="32" fill="#0e0e12" fill-opacity="0.65"/>
  <text x="${pad + 95}" y="108" text-anchor="middle" font-family="${FONT}" font-size="32" font-weight="bold" fill="#e879f9" letter-spacing="5">UZEED</text>
  <text x="${pad}" y="${nameY}" font-family="${FONT}" font-size="84" font-weight="bold" fill="#ffffff">${esc(cut(d.nombre, 20))}</text>
  ${tituloSvg}
  ${textoSvg}
  <rect x="0" y="${H - 110}" width="${W}" height="110" fill="url(#accent)"/>
  <text x="${W / 2}" y="${H - 42}" text-anchor="middle" font-family="${FONT}" font-size="36" font-weight="bold" fill="#ffffff">${esc(cut(d.pie, 46))}</text>
</svg>`;
}

export async function renderMetricsCard(d: MetricsCardData): Promise<Buffer> {
  return sharp(Buffer.from(metricsCardSvg(d))).png({ compressionLevel: 9 }).toBuffer();
}

export async function renderFlyer(d: FlyerData): Promise<Buffer> {
  // JPEG: con la foto a pantalla completa un PNG pesa varios MB.
  return sharp(Buffer.from(flyerSvg(d))).jpeg({ quality: 88 }).toBuffer();
}
