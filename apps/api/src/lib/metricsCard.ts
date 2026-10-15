import sharp from "sharp";

/**
 * Tarjeta PNG con las métricas de un perfil, para mandarla por WhatsApp.
 * Se dibuja en SVG y sharp la pasa a PNG. Necesita fuentes instaladas en el
 * contenedor (fonts-dejavu-core en el Dockerfile): sin ellas el texto sale
 * en blanco.
 */

export type MetricValue = { actual: number; anterior: number };

export type MetricsCardData = {
  nombre: string;
  periodo: string; // ej. "Últimos 7 días · 8 al 14 oct"
  visitantes: MetricValue;
  contactos: MetricValue;
  impresiones: MetricValue;
  favoritos: MetricValue;
  mensajes: MetricValue;
};

const W = 1080;
const H = 1350;
const FONT = "DejaVu Sans, Arial, sans-serif";

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

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
  const nombre = d.nombre.length > 26 ? `${d.nombre.slice(0, 25)}…` : d.nombre;
  const gap = 32;
  const pad = 64;
  const tw = (W - pad * 2 - gap) / 2;
  const th = 270;
  const top = 360;
  const tasa = d.visitantes.actual > 0 ? Math.round((d.contactos.actual / d.visitantes.actual) * 1000) / 10 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a0f24"/>
      <stop offset="1" stop-color="#0e0e12"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e879f9"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="${pad}" y="72" width="140" height="10" rx="5" fill="url(#accent)"/>
  <text x="${pad}" y="150" font-family="${FONT}" font-size="40" font-weight="bold" fill="#e879f9" letter-spacing="6">UZEED</text>
  <text x="${pad}" y="232" font-family="${FONT}" font-size="64" font-weight="bold" fill="#ffffff">${esc(nombre)}</text>
  <text x="${pad}" y="292" font-family="${FONT}" font-size="34" fill="#94a3b8">${esc(d.periodo)}</text>
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

export async function renderMetricsCard(d: MetricsCardData): Promise<Buffer> {
  return sharp(Buffer.from(metricsCardSvg(d))).png({ compressionLevel: 9 }).toBuffer();
}
