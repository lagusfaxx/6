import sharp from "sharp";
import { delta, esc, fmt, photoHref, type MetricValue, type SeriePoint } from "./metricsCard";

/**
 * Afiche de estadísticas por perfil (estilo del flyer de marketing de UZEED):
 * titular con el nombre, cuatro tarjetas con sus números, barras de
 * visitantes, "1 de cada N te escribió" contra el promedio de UZEED, consejos
 * y botón a su perfil. La foto del perfil va arriba a la derecha, fundida con
 * el fondo. Usa Inter (fonts-inter en el Dockerfile) con DejaVu de respaldo.
 */

export type PosterData = {
  nombre: string;
  /** "Del 26 de octubre al 1 de noviembre" */
  periodo: string;
  foto?: Buffer | null;
  visitantes: MetricValue;
  contactos: MetricValue;
  impresiones: MetricValue;
  favoritos: MetricValue;
  /** Pocas barras (≤ 8): por día, semana o mes según el largo del periodo. */
  serie: SeriePoint[];
  /** "día" | "semana" | "mes": cómo está agrupada la serie. */
  serieUnidad: string;
  promedio: { tasaContacto: number; top10Contactos: number };
  /** Línea del botón, ej. "uzeed.cl/profesional/vale". */
  enlace: string;
};

export const POSTER_W = 1080;
export const POSTER_H = 1720;
/* Zona de la foto (arriba a la derecha). */
export const POSTER_PHOTO = { x: 500, y: 0, w: 580, h: 1000 };

const F = "Inter, DejaVu Sans, sans-serif";
const BG = "#141018";
const PINK = "#f4a3c8";
const PINK_TEXT = "#f0a6c9";
const INK = "#ffffff";
const MUTED = "#cfc6d6";
const CARD = "#1f1a24";
const CARD_STROKE = "#3a3140";

const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/* Íconos de trazo en una caja de 48×48. */
const ICONS: Record<string, string> = {
  eye: `<path d="M3 24C10 12 38 12 45 24C38 36 10 36 3 24Z"/><circle cx="24" cy="24" r="7"/>`,
  chat: `<path d="M10 9h28a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H22l-10 8v-8h-2a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6z"/><circle cx="16" cy="23" r="1.6" fill="currentColor"/><circle cx="24" cy="23" r="1.6" fill="currentColor"/><circle cx="32" cy="23" r="1.6" fill="currentColor"/>`,
  search: `<circle cx="21" cy="21" r="13"/><path d="M31 31l12 12"/>`,
  heart: `<path d="M24 41C10 31 4 24 4 16a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 8-6 15-20 25z"/>`,
  people: `<circle cx="24" cy="14" r="6"/><circle cx="10" cy="18" r="4.5"/><circle cx="38" cy="18" r="4.5"/><path d="M13 38c0-7 5-12 11-12s11 5 11 12z" fill="currentColor"/><path d="M2 36c0-5 3-8 8-8 2 0 4 1 5 2M46 36c0-5-3-8-8-8-2 0-4 1-5 2"/>`,
  camera: `<rect x="4" y="13" width="40" height="28" rx="5"/><circle cx="24" cy="27" r="8"/><path d="M17 13l3-5h8l3 5"/>`,
  story: `<circle cx="24" cy="24" r="19" stroke-dasharray="6 4"/><path d="M20 16l12 8-12 8z" fill="currentColor"/>`,
  shield: `<path d="M24 4l17 6v12c0 11-7 19-17 22C14 41 7 33 7 22V10z"/><path d="M16 24l6 6 11-12"/>`,
  user: `<circle cx="20" cy="14" r="9" fill="currentColor"/><path d="M3 44c0-10 8-16 17-16s17 6 17 16z" fill="currentColor"/><path d="M38 12v14M31 19h14"/>`,
};

function icon(name: string, x: number, y: number, size: number, color: string, stroke = 3): string {
  const s = size / 48;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="${stroke / s > 6 ? 6 : stroke / s}" stroke-linecap="round" stroke-linejoin="round" color="${color}">${ICONS[name]}</g>`;
}

function statCard(x: number, y: number, w: number, h: number, ic: string, value: MetricValue, label: string[], highlight: boolean): string {
  const d = delta(value);
  const fg = highlight ? "#2a1a2e" : INK;
  const sub = highlight ? "#3b2a40" : MUTED;
  const dColor = highlight ? "#7a1f4f" : d.up === null ? "#9a8fa3" : d.up ? "#8ee6c0" : "#f7a1a1";
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${highlight ? PINK : CARD}" ${highlight ? "" : `stroke="${CARD_STROKE}" stroke-width="2"`}/>
  ${icon(ic, x + 30, y + h / 2 - 26, 52, highlight ? "#2a1a2e" : PINK)}
  <text x="${x + 112}" y="${y + 66}" font-family="${F}" font-size="52" font-weight="700" fill="${fg}">${fmt(value.actual)}</text>
  ${label.map((l, i) => `<text x="${x + 112}" y="${y + 100 + i * 27}" font-family="${F}" font-size="22" fill="${sub}">${esc(l)}</text>`).join("")}
  ${d.text ? `<text x="${x + w - 22}" y="${y + 40}" text-anchor="end" font-family="${F}" font-size="19" font-weight="600" fill="${dColor}">${esc(d.text.replace(" vs anterior", ""))}</text>` : ""}`;
}

function chart(x: number, y: number, w: number, h: number, d: PosterData): string {
  const n = Math.max(1, d.serie.length);
  const left = x + 30;
  const right = x + w - 30;
  const gap = n > 6 ? 14 : 20;
  const bw = (right - left - gap * (n - 1)) / n;
  const base = y + h - 62;
  const top = y + 130;
  const max = Math.max(1, ...d.serie.map((p) => p.valor));
  const best = d.serie.reduce((bi, p, i) => (p.valor > d.serie[bi].valor ? i : bi), 0);
  const dv = delta(d.visitantes);
  const bars = d.serie
    .map((p, i) => {
      const bx = left + i * (bw + gap);
      const bh = p.valor > 0 ? Math.max(8, ((base - top) * p.valor) / max) : 3;
      const r = Math.min(6, bw / 2);
      const fill = i === best && p.valor > 0 ? PINK : "#6b5070";
      return `<path d="M${bx},${base} V${base - bh + r} Q${bx},${base - bh} ${bx + r},${base - bh} H${bx + bw - r} Q${bx + bw},${base - bh} ${bx + bw},${base - bh + r} V${base} Z" fill="${fill}"/>
  <text x="${bx + bw / 2}" y="${base - bh - 12}" text-anchor="middle" font-family="${F}" font-size="21" fill="${MUTED}">${fmt(p.valor)}</text>
  <text x="${bx + bw / 2}" y="${base + 36}" text-anchor="middle" font-family="${F}" font-size="21" fill="${MUTED}">${esc(p.etiqueta)}</text>`;
    })
    .join("");
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${CARD}" fill-opacity="0.92" stroke="${CARD_STROKE}" stroke-width="2"/>
  <g transform="translate(${x + 30} ${y + 34})" fill="${PINK}"><rect x="0" y="18" width="7" height="14" rx="2"/><rect x="11" y="10" width="7" height="22" rx="2"/><rect x="22" y="2" width="7" height="30" rx="2"/></g>
  <text x="${x + 76}" y="${y + 64}" font-family="${F}" font-size="30" font-weight="600" fill="${INK}">Visitantes por ${esc(d.serieUnidad)}</text>
  ${dv.text ? `<text x="${x + w - 30}" y="${y + 64}" text-anchor="end" font-family="${F}" font-size="28" font-weight="700" fill="${PINK_TEXT}">${esc(dv.text)}</text>` : ""}
  <line x1="${left}" y1="${base + 1}" x2="${right}" y2="${base + 1}" stroke="#4a3f52" stroke-width="2"/>
  ${bars}`;
}

function banner(x: number, y: number, w: number, h: number, d: PosterData): string {
  const v = d.visitantes.actual;
  const c = d.contactos.actual;
  const split = x + w * 0.6;
  let big: string;
  let lines: string[];
  if (c > 0 && v > 0) {
    const n = Math.max(1, Math.round(v / c));
    big = n === 1 ? "Todas" : `1 de cada ${n}`;
    lines = n === 1 ? ["las personas que abrieron tu perfil", "te escribieron por WhatsApp."] : ["personas que abrieron tu perfil", "te escribió por WhatsApp."];
  } else {
    big = "Aún sin contactos";
    lines = ["Fotos nuevas y tarifa clara ayudan", "a que te escriban por WhatsApp."];
  }
  const avg = Math.round(d.promedio.tasaContacto * 10) / 10;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#f6eef5"/>
  ${icon("people", x + 28, y + h / 2 - 28, 56, "#5b3a66")}
  <text x="${x + 106}" y="${y + 62}" font-family="${F}" font-size="42" font-weight="700" fill="#2a1a2e">${esc(big)}</text>
  ${lines.map((l, i) => `<text x="${x + 106}" y="${y + 98 + i * 28}" font-family="${F}" font-size="22" fill="#3b2a40">${esc(l)}</text>`).join("")}
  <line x1="${split}" y1="${y + 28}" x2="${split}" y2="${y + h - 28}" stroke="#2a1a2e" stroke-opacity="0.35" stroke-width="2"/>
  <text x="${split + 28}" y="${y + 56}" font-family="${F}" font-size="21" fill="#3b2a40">Promedio en UZEED:</text>
  <text x="${split + 28}" y="${y + 84}" font-family="${F}" font-size="21" font-weight="700" fill="#c2417f">${avg.toLocaleString("es-CL")}% escribe</text>
  <text x="${split + 28}" y="${y + 116}" font-family="${F}" font-size="21" fill="#3b2a40">Las 10 más contactadas:</text>
  <text x="${split + 28}" y="${y + 144}" font-family="${F}" font-size="21" font-weight="700" fill="#c2417f">${fmt(d.promedio.top10Contactos)} contactos c/u</text>`;
}

function tips(y: number): string {
  const items: [string, string, string[]][] = [
    ["1", "camera", ["Sube fotos", "nuevas y claras."]],
    ["2", "story", ["Publica historias", "seguido."]],
    ["3", "shield", ["Verifica tu perfil:", "da más confianza."]],
  ];
  const colW = (POSTER_W - 120) / 3;
  return `
  <text x="60" y="${y}" font-family="${F}" font-size="22" font-weight="600" fill="${INK}" letter-spacing="5">PARA RECIBIR MÁS CONTACTOS</text>
  ${items
    .map(([n, ic, lines], i) => {
      const cx = 60 + i * colW;
      const sep = i > 0 ? `<line x1="${cx - 14}" y1="${y + 30}" x2="${cx - 14}" y2="${y + 110}" stroke="${CARD_STROKE}" stroke-width="2"/>` : "";
      return `${sep}
  <circle cx="${cx + 18}" cy="${y + 58}" r="18" fill="${PINK}"/>
  <text x="${cx + 18}" y="${y + 66}" text-anchor="middle" font-family="${F}" font-size="21" font-weight="700" fill="#2a1a2e">${n}</text>
  ${icon(ic, cx + 50, y + 38, 40, PINK)}
  ${lines.map((l, j) => `<text x="${cx + 104}" y="${y + 58 + j * 27}" font-family="${F}" font-size="21" fill="${MUTED}">${esc(l)}</text>`).join("")}`;
    })
    .join("")}`;
}

export function posterSvg(d: PosterData): string {
  const W = POSTER_W;
  const H = POSTER_H;
  const P = POSTER_PHOTO;
  const name = cut(d.nombre.split(" ")[0] || d.nombre || "Hola", 12);
  // "(hasta hoy)" no cabe en el subtítulo y no aporta en una imagen.
  const clean = d.periodo.replace(/\s*\(hasta hoy\)\s*$/, "");
  const periodo = clean ? clean[0].toLowerCase() + clean.slice(1) : "";
  const photo = d.foto
    ? `<image href="${photoHref(d.foto)}" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="url(#fadeL)"/>
  <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="url(#fadeB)"/>`
    : `<circle cx="900" cy="260" r="420" fill="url(#glow)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${BG}" stop-opacity="1"/><stop offset="0.45" stop-color="${BG}" stop-opacity="0.25"/><stop offset="1" stop-color="${BG}" stop-opacity="0.05"/></linearGradient>
    <linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="1"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.35"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${photo}

  <rect x="56" y="40" width="74" height="74" rx="20" fill="#ffffff"/>
  <path d="M93 56c-11 0-19 8-19 18 0 13 19 28 19 28s19-15 19-28c0-10-8-18-19-18z" fill="#6d28d9"/><circle cx="93" cy="74" r="7" fill="#ffffff"/>
  <text x="152" y="99" font-family="${F}" font-size="46" font-weight="600" fill="${INK}" letter-spacing="9">UZEED</text>

  <text x="60" y="178" font-family="${F}" font-size="22" font-weight="500" fill="${PINK_TEXT}" letter-spacing="5">TUS ESTADÍSTICAS EN UZEED</text>
  <text font-family="${F}" font-size="78" font-weight="600" fill="${INK}">
    <tspan x="56" y="268">${esc(name)},</tspan>
    <tspan x="56" y="352">así le fue a</tspan>
    <tspan x="56" y="436" fill="${PINK}">tu perfil.</tspan>
  </text>
  <text x="60" y="490" font-family="${F}" font-size="25" fill="${MUTED}">${esc(cut(`Esto pasó ${periodo}.`, 52))}</text>

  ${statCard(56, 524, 474, 150, "eye", d.visitantes, ["personas vieron", "tu perfil"], false)}
  ${statCard(550, 524, 474, 150, "chat", d.contactos, ["clientes te escribieron", "por WhatsApp"], true)}
  ${statCard(56, 690, 474, 150, "search", d.impresiones, ["veces apareciste", "en los listados"], false)}
  ${statCard(550, 690, 474, 150, "heart", d.favoritos, ["te guardaron", "en favoritos"], false)}

  ${chart(56, 862, 968, 320, d)}
  ${banner(56, 1202, 968, 170, d)}
  ${tips(1418)}

  <rect x="70" y="1570" width="940" height="92" rx="46" fill="${PINK}"/>
  ${icon("user", 150, 1592, 48, "#2a1a2e")}
  <line x1="232" y1="1592" x2="232" y2="1640" stroke="#2a1a2e" stroke-opacity="0.35" stroke-width="2"/>
  <text x="270" y="1630" font-family="${F}" font-size="38" font-weight="600" fill="#2a1a2e">Ver mi perfil en uzeed.cl</text>
  <path d="M930 1598l18 18-18 18" fill="none" stroke="#2a1a2e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-family="${F}" font-size="18" fill="#8f8597">Datos de UZEED, sin bots · ${esc(cut(d.enlace, 40))}</text>
</svg>`;
}

export async function renderPoster(d: PosterData): Promise<Buffer> {
  // JPEG: con la foto de fondo un PNG pesa demasiado para WhatsApp.
  return sharp(Buffer.from(posterSvg(d))).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
}
