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
  /** Visitantes por día (o por semana en periodos largos) para el gráfico. */
  serie?: SeriePoint[];
};

export type SeriePoint = { etiqueta: string; valor: number };

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

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export function fmt(n: number): string {
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

export function photoHref(foto: Buffer): string {
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
    <linearGradient id="accentV" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#e879f9"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#0e0e12" stop-opacity="0"/>
      <stop offset="1" stop-color="#0e0e12" stop-opacity="1"/>
    </linearGradient>
  </defs>`;

/** "+12%", "−8%", "nuevo" o "" si no hay base para comparar. */
export function delta(v: MetricValue): { text: string; up: boolean | null } {
  if (v.anterior <= 0) return v.actual > 0 ? { text: "nuevo", up: true } : { text: "", up: null };
  const pct = Math.round(((v.actual - v.anterior) / v.anterior) * 100);
  if (pct === 0) return { text: "igual que antes", up: null };
  return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs anterior`, up: pct > 0 };
}

const deltaColor = (up: boolean | null) => (up === null ? "#94a3b8" : up ? "#6ee7b7" : "#fda4af");

function tile(x: number, y: number, w: number, h: number, label: string, v: MetricValue): string {
  const d = delta(v);
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="#17171e" stroke="#26262f" stroke-width="2"/>
  <text x="${x + 36}" y="${y + 58}" font-family="${FONT}" font-size="30" fill="#cbd5e1">${esc(label)}</text>
  <text x="${x + 36}" y="${y + 128}" font-family="${FONT}" font-size="64" font-weight="bold" fill="#ffffff">${fmt(v.actual)}</text>
  <text x="${x + 36}" y="${y + h - 26}" font-family="${FONT}" font-size="26" fill="${deltaColor(d.up)}">${esc(d.text)}</text>`;
}

/**
 * Barras de visitantes por día: una sola serie (sin leyenda), barras finas con
 * la punta redondeada sobre la línea base, 2 px de separación y etiqueta sólo
 * en el mejor día y en las fechas de los extremos.
 */
export type ChartTheme = { bar: string; label: string; muted: string; axis: string };
export const DARK_CHART: ChartTheme = { bar: "#3b2f4f", label: "#ffffff", muted: "#94a3b8", axis: "#33333d" };
export const LIGHT_CHART: ChartTheme = { bar: "#e9d5ff", label: "#1f2937", muted: "#6b7280", axis: "#d1d5db" };

export function barChart(x: number, y: number, w: number, h: number, serie: SeriePoint[], theme: ChartTheme = DARK_CHART): string {
  if (!serie.length) return "";
  const n = serie.length;
  const gap = n > 20 ? 4 : 8;
  const bw = Math.max(4, (w - gap * (n - 1)) / n);
  const max = Math.max(1, ...serie.map((p) => p.valor));
  const best = serie.reduce((bi, p, i) => (p.valor > serie[bi].valor ? i : bi), 0);
  const labelH = 40; // espacio sobre la barra más alta para su número
  const plotH = h - labelH;
  const base = y + h;
  const bars = serie
    .map((p, i) => {
      const bx = x + i * (bw + gap);
      const bh = p.valor > 0 ? Math.max(6, (p.valor / max) * plotH) : 0;
      const r = Math.min(6, bw / 2, bh);
      const top = base - bh;
      const fill = i === best && p.valor > 0 ? "url(#accentV)" : theme.bar;
      const bar = bh > 0
        ? `<path d="M${bx},${base} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + bw - r} Q${bx + bw},${top} ${bx + bw},${top + r} V${base} Z" fill="${fill}"/>`
        : "";
      const lbl = i === best && p.valor > 0
        ? `<text x="${bx + bw / 2}" y="${top - 12}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="bold" fill="${theme.label}">${fmt(p.valor)}</text>`
        : "";
      return bar + lbl;
    })
    .join("");
  const axis = `<line x1="${x}" y1="${base + 1}" x2="${x + w}" y2="${base + 1}" stroke="${theme.axis}" stroke-width="2"/>`;
  const ends = `
  <text x="${x}" y="${base + 40}" font-family="${FONT}" font-size="24" fill="${theme.muted}">${esc(serie[0].etiqueta)}</text>
  <text x="${x + w}" y="${base + 40}" text-anchor="end" font-family="${FONT}" font-size="24" fill="${theme.muted}">${esc(serie[n - 1].etiqueta)}</text>`;
  return axis + bars + ends;
}

export function metricsCardSvg(d: MetricsCardData): string {
  const pad = 56;
  const gap = 28;
  const r = 92;
  const tx = pad + r * 2 + 44;
  const tasa = d.visitantes.actual > 0 ? Math.round((d.contactos.actual / d.visitantes.actual) * 1000) / 10 : 0;
  const hd = delta(d.visitantes);

  // Panel principal: visitantes con su tendencia diaria.
  const hx = pad;
  const hy = 300;
  const hw = W - pad * 2;
  const hh = 520;
  // Cuatro tarjetas chicas en 2x2.
  const ty = hy + hh + gap;
  const tw = (hw - gap) / 2;
  const th = 196;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 120}" cy="120" r="260" fill="#7c3aed" opacity="0.10"/>
  ${avatar(pad + r, 64 + r, r, d.nombre, d.foto)}
  <text x="${tx}" y="112" font-family="${FONT}" font-size="30" font-weight="bold" fill="#e879f9" letter-spacing="6">UZEED · TUS MÉTRICAS</text>
  <text x="${tx}" y="186" font-family="${FONT}" font-size="58" font-weight="bold" fill="#ffffff">${esc(cut(d.nombre, 20))}</text>
  <text x="${tx}" y="236" font-family="${FONT}" font-size="30" fill="#94a3b8">${esc(cut(d.periodo, 40))}</text>

  <rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="36" fill="#17171e" stroke="#26262f" stroke-width="2"/>
  <text x="${hx + 44}" y="${hy + 66}" font-family="${FONT}" font-size="32" fill="#cbd5e1">Personas que vieron tu perfil</text>
  <text x="${hx + 44}" y="${hy + 178}" font-family="${FONT}" font-size="120" font-weight="bold" fill="#ffffff">${fmt(d.visitantes.actual)}</text>
  <text x="${hx + 44}" y="${hy + 228}" font-family="${FONT}" font-size="28" fill="${deltaColor(hd.up)}">${esc(hd.text)}</text>
  <rect x="${hx + hw - 320}" y="${hy + 44}" width="276" height="120" rx="24" fill="url(#accent)"/>
  <text x="${hx + hw - 182}" y="${hy + 108}" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="bold" fill="#ffffff">${tasa.toLocaleString("es-CL")}%</text>
  <text x="${hx + hw - 182}" y="${hy + 146}" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#ffffff">te escribió</text>
  ${barChart(hx + 44, hy + 270, hw - 88, 180, d.serie ?? [])}

  ${tile(hx, ty, tw, th, "Contactos WhatsApp", d.contactos)}
  ${tile(hx + tw + gap, ty, tw, th, "Apariciones", d.impresiones)}
  ${tile(hx, ty + th + gap, tw, th, "Mensajes recibidos", d.mensajes)}
  ${tile(hx + tw + gap, ty + th + gap, tw, th, "Nuevos favoritos", d.favoritos)}
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="${FONT}" font-size="26" fill="#64748b">uzeed.cl · Mejora tu perfil para recibir más contactos</text>
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
