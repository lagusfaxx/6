import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DARK_CHART, LIGHT_CHART, barChart, delta, esc, fmt, photoHref, type MetricsCardData } from "./metricsCard";

/**
 * Diseños propios para la imagen de WhatsApp: un SVG hecho en Figma/Canva
 * con textos variables ({{nombre}}, {{visitas}}...) que se llenan con los datos
 * de cada perfil. Viven en apps/api/assets/whatsapp/<nombre>.svg.
 *
 * - Textos: {{nombre}} {{usuario}} {{periodo}} {{visitas}} {{contactos}}
 *   {{apariciones}} {{mensajes}} {{favoritos}} {{tasa}} y {{variacion_<dato>}}
 *   (ej. {{variacion_visitas}} → "▲ 27% vs anterior").
 * - Foto: un elemento con id="foto" (la capa se llama "foto" en Figma). Si es
 *   una <image> se le cambia la imagen; si es un rect/círculo/elipse, la foto
 *   se recorta con esa forma.
 * - Gráfico: un rect con id="grafico" donde se dibujan las barras de
 *   visitantes por día.
 */

const NAME_RE = /^[a-z0-9_-]{1,40}$/;

function designsDir(): string {
  if (process.env.WHATSAPP_DESIGNS_DIR) return path.resolve(process.env.WHATSAPP_DESIGNS_DIR);
  // dist/ en producción, src/lib en desarrollo.
  const candidates = [path.resolve(__dirname, "../assets/whatsapp"), path.resolve(__dirname, "../../assets/whatsapp")];
  return candidates.find((d) => fs.existsSync(d)) ?? candidates[0];
}

export function listDesigns(): string[] {
  try {
    return fs.readdirSync(designsDir()).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)).sort();
  } catch {
    return [];
  }
}

export function loadDesign(name: string): string | null {
  if (!NAME_RE.test(name)) return null;
  try {
    return fs.readFileSync(path.join(designsDir(), `${name}.svg`), "utf8");
  } catch {
    return null;
  }
}

export type DesignData = MetricsCardData & { usuario: string };

function values(d: DesignData): Record<string, string> {
  const tasa = d.visitantes.actual > 0 ? Math.round((d.contactos.actual / d.visitantes.actual) * 1000) / 10 : 0;
  const metrics = { visitas: d.visitantes, contactos: d.contactos, apariciones: d.impresiones, mensajes: d.mensajes, favoritos: d.favoritos };
  const out: Record<string, string> = {
    nombre: d.nombre,
    usuario: d.usuario,
    periodo: d.periodo,
    tasa: `${tasa.toLocaleString("es-CL")}%`,
  };
  for (const [k, v] of Object.entries(metrics)) {
    out[k] = fmt(v.actual);
    out[`variacion_${k}`] = delta(v).text;
  }
  return out;
}

/** Marcadores {{...}} del diseño que no tienen dato (para avisar en la vista previa). */
export function unknownPlaceholders(svg: string): string[] {
  const known = new Set(Object.keys(values({
    nombre: "", usuario: "", periodo: "",
    visitantes: { actual: 0, anterior: 0 }, contactos: { actual: 0, anterior: 0 }, impresiones: { actual: 0, anterior: 0 },
    favoritos: { actual: 0, anterior: 0 }, mensajes: { actual: 0, anterior: 0 },
  })));
  const found = [...svg.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((k) => !known.has(k)))];
}

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (tag: string, name: string, def = 0) => Number(attr(tag, name) ?? def);

/** Primer elemento (etiqueta de apertura) con ese id, autocerrado o no. */
function findById(svg: string, id: string): { tag: string; name: string; start: number; end: number } | null {
  const re = new RegExp(`<([a-zA-Z]+)\\b[^>]*\\sid="${id}"[^>]*?(/?)>`);
  const m = re.exec(svg);
  if (!m) return null;
  let end = m.index + m[0].length;
  if (!m[2]) {
    // Con contenido: buscar el cierre correspondiente (los rect/image de Figma vienen autocerrados).
    const close = svg.indexOf(`</${m[1]}>`, end);
    if (close >= 0) end = close + `</${m[1]}>`.length;
  }
  return { tag: m[0], name: m[1], start: m.index, end };
}

function withPhoto(svg: string, foto: Buffer | null | undefined): string {
  const el = findById(svg, "foto");
  if (!el || !foto) return svg;
  const href = photoHref(foto);
  if (el.name === "image") {
    const tag = el.tag
      .replace(/\s(xlink:)?href="[^"]*"/g, "")
      .replace(/^<image/, `<image href="${href}" preserveAspectRatio="xMidYMid slice"`);
    return svg.slice(0, el.start) + tag + svg.slice(el.end);
  }
  let box: { x: number; y: number; w: number; h: number } | null = null;
  if (el.name === "rect") box = { x: num(el.tag, "x"), y: num(el.tag, "y"), w: num(el.tag, "width"), h: num(el.tag, "height") };
  if (el.name === "circle") {
    const r = num(el.tag, "r");
    box = { x: num(el.tag, "cx") - r, y: num(el.tag, "cy") - r, w: r * 2, h: r * 2 };
  }
  if (el.name === "ellipse") {
    const rx = num(el.tag, "rx");
    const ry = num(el.tag, "ry");
    box = { x: num(el.tag, "cx") - rx, y: num(el.tag, "cy") - ry, w: rx * 2, h: ry * 2 };
  }
  if (!box || !box.w || !box.h) return svg;
  const transform = attr(el.tag, "transform");
  const shape = el.tag.replace(/\sid="foto"/, "").replace(/\s(fill|stroke|style|filter)="[^"]*"/g, "").replace(/([^/])>$/, "$1/>");
  const image = `<clipPath id="uz-foto-clip">${shape}</clipPath><image href="${href}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#uz-foto-clip)"${transform ? ` transform="${transform}"` : ""}/>`;
  // La forma original queda debajo (si tenía borde, se dibuja encima de nuevo).
  const stroke = attr(el.tag, "stroke") ? el.tag.replace(/\sfill="[^"]*"/, "").replace(/^<(\w+)/, '<$1 fill="none"') : "";
  return svg.slice(0, el.end) + image + (stroke ? stroke.replace(/([^/])>$/, "$1/>") : "") + svg.slice(el.end);
}

/** El color de la caja "grafico" dice si el gráfico va sobre fondo claro u oscuro. */
function isLight(fill: string | null): boolean {
  const m = fill?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function withChart(svg: string, d: DesignData): string {
  const el = findById(svg, "grafico");
  if (!el || el.name !== "rect" || !d.serie?.length) return svg;
  const x = num(el.tag, "x");
  const y = num(el.tag, "y");
  const w = num(el.tag, "width");
  const h = num(el.tag, "height");
  if (!w || !h) return svg;
  // Deja 50 px abajo para las fechas; la caja guía no se dibuja.
  const defs = `<defs><linearGradient id="accentV" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs>`;
  return svg.slice(0, el.start) + defs + barChart(x, y, w, Math.max(40, h - 50), d.serie, isLight(attr(el.tag, "fill")) ? LIGHT_CHART : DARK_CHART) + svg.slice(el.end);
}

export function fillDesign(svg: string, d: DesignData): string {
  const vals = values(d);
  let out = svg.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (all, k) => (k in vals ? esc(vals[k]) : all));
  out = withChart(out, d);
  out = withPhoto(out, d.foto);
  return out;
}

export async function renderDesign(svg: string, d: DesignData): Promise<Buffer> {
  const png = await sharp(Buffer.from(fillDesign(svg, d)), { density: 72 }).png({ compressionLevel: 9 }).toBuffer();
  // WhatsApp acepta hasta 5 MB; con fotos grandes un PNG puede pasarse.
  return png.length > 4.5 * 1024 * 1024 ? sharp(png).jpeg({ quality: 88 }).toBuffer() : png;
}
