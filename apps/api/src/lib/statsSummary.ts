import sharp from "sharp";
import { esc, fmt } from "./metricsCard";

/**
 * Resumen de estadísticas por perfil (imagen vertical para WhatsApp): la
 * inicial del nombre (nunca la foto del perfil), contactos totales (WhatsApp
 * + chat), embudo apariciones → visitas → contactos, ranking de contactos
 * anónimo, posición promedio, fotos vs las
 * 10 más contactadas, consejos según su cuenta y el llamado a subir de
 * posición. Usa Inter (fonts-inter) con DejaVu de respaldo.
 */

export type SummaryData = {
  nombre: string;
  usuario: string;
  /** "Escort · La Unión" (categoría y comuna/ciudad, lo que haya). */
  detalle: string;
  /** rosa (por defecto) o azul (perfiles de hombre). */
  tema?: SummaryTheme;
  dias: number;
  /** Días desde que se registró, si son menos que el periodo. */
  diasEnUzeed?: number | null;
  contactosWhatsapp: number;
  contactosChat: number;
  apariciones: number;
  visitantes: number;
  /** Promedio de UZEED: % de visitantes que contacta (0-100). */
  tasaPromedio: number;
  ranking: {
    posicion: number;
    total: number;
    /** Filas alrededor (incluida ella) con su posición y contactos. */
    filas: { posicion: number; contactos: number; yo: boolean }[];
  };
  posicionPromedio: number | null;
  fotos: number;
  fotosTop10: number;
  consejos: string[];
  /** Cuántas veces más visitas/contactos reciben los perfiles del top 10 de la página (null = no mostrar). */
  multiplicador: { visitas: number; contactos: number } | null;
};

export const SUMMARY_W = 1080;
export const SUMMARY_AVATAR = 220;

const F = "Inter, DejaVu Sans, sans-serif";
const INK = "#ffffff";

/** Rosa para mujeres (y por defecto), azul para hombres. */
const THEMES = {
  rosa: { bg: "#17121a", card: "#2a2230", card2: "#3d3045", accent: "#f4a3c8", dark: "#1d1420", muted: "#cfc6d6", dim: "#9a8fa3", avatar: "#3a2a40", stroke: "#4a3f52", ctaBg: "#f6eef5", ctaText: "#3b2a40" },
  azul: { bg: "#11151c", card: "#202936", card2: "#2c3a4d", accent: "#8ec5ff", dark: "#0f1824", muted: "#c6d0de", dim: "#8e9bb0", avatar: "#22324a", stroke: "#3a4a60", ctaBg: "#eef4fb", ctaText: "#24334a" },
} as const;
export type SummaryTheme = keyof typeof THEMES;
const PAD = 72;
const INNER = SUMMARY_W - PAD * 2;

const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Corta en líneas según un ancho aproximado de Inter (≈ 0,52 em por letra). */
function wrap(text: string, width: number, size: number): string[] {
  const max = Math.max(8, Math.floor(width / (size * 0.52)));
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = w;
    else if ((line + " " + w).length <= max) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(x: number, y: number, text: string, width: number, size: number, color: string, lh = 1.3, weight = 400): { svg: string; h: number } {
  const lines = wrap(text, width, size);
  const svg = lines
    .map((l, i) => `<text x="${x}" y="${y + size + i * size * lh}" font-family="${F}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(l)}</text>`)
    .join("");
  return { svg, h: size + (lines.length - 1) * size * lh + size * 0.35 };
}

function pill(x: number, y: number, bold: string, rest: string, size: number, bg: string, fg: string): { svg: string; w: number } {
  const w = Math.round((bold.length + rest.length + 1) * size * 0.54 + 40);
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${size * 2}" rx="${size}" fill="${bg}"/>
  <text x="${x + 20}" y="${y + size * 1.36}" font-family="${F}" font-size="${size}" fill="${fg}"><tspan font-weight="700">${esc(bold)}</tspan> ${esc(rest)}</text>`,
  };
}

export function summarySvg(d: SummaryData): { svg: string; height: number } {
  const T = THEMES[d.tema ?? "rosa"];
  const parts: string[] = [];
  let y = 0;
  const total = d.contactosWhatsapp + d.contactosChat;

  // Encabezado
  parts.push(`<text x="${PAD}" y="96" font-family="${F}" font-size="34" font-weight="800" fill="${INK}" letter-spacing="3">UZEED</text>
  <text x="${SUMMARY_W - PAD}" y="94" text-anchor="end" font-family="${F}" font-size="23" fill="${T.muted}">Tus métricas de los últimos ${d.dias} días</text>`);

  // Foto o inicial
  const r = SUMMARY_AVATAR / 2;
  const cx = PAD + r;
  const cy = 190 + r - 40;
  const avatar = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${T.avatar}"/>
  <text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="${F}" font-size="${r}" font-weight="700" fill="${INK}">${esc((d.nombre.trim()[0] || "U").toUpperCase())}</text>`;
  const tx = PAD + SUMMARY_AVATAR + 40;
  parts.push(`${avatar}
  <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="${T.accent}" stroke-width="5"/>
  <text x="${tx}" y="${cy - 52}" font-family="${F}" font-size="29" fill="${T.muted}">Tus ${d.dias} días en UZEED</text>
  <text x="${tx}" y="${cy + 30}" font-family="${F}" font-size="${d.nombre.length > 12 ? 62 : 76}" font-weight="800" fill="${INK}">${esc(cut(d.nombre, 16))}</text>
  <text x="${tx}" y="${cy + 76}" font-family="${F}" font-size="24" fill="${T.dim}">${esc(cut(`@${d.usuario}${d.detalle ? ` · ${d.detalle}` : ""}`, 44))}</text>`);
  y = cy + r + 40;

  // Aviso si lleva menos días que el periodo
  if (d.diasEnUzeed && d.diasEnUzeed < d.dias) {
    const t = textBlock(PAD + 28, y + 18, `Llevas ${d.diasEnUzeed} días en UZEED: estos son tus números desde que llegaste.`, INNER - 56, 25, T.muted);
    parts.push(`<rect x="${PAD}" y="${y}" width="${INNER}" height="${t.h + 40}" rx="18" fill="${T.card}"/>${t.svg}`);
    y += t.h + 40 + 40;
  } else y += 10;

  // Número grande de contactos
  const big = fmt(total);
  const bigW = big.length * 0.6 * 200 + 30;
  parts.push(`<text x="${PAD - 6}" y="${y + 168}" font-family="${F}" font-size="210" font-weight="800" fill="${T.accent}" letter-spacing="-6">${big}</text>
  <text x="${PAD + bigW}" y="${y + 118}" font-family="${F}" font-size="44" font-weight="700" fill="${INK}">${total === 1 ? "persona te contactó" : "personas te contactaron"}</text>
  <text x="${PAD + bigW}" y="${y + 168}" font-family="${F}" font-size="44" font-weight="700" fill="${INK}">desde UZEED</text>`);
  const p1 = pill(PAD + bigW, y + 196, String(d.contactosWhatsapp), "por WhatsApp", 26, T.card, INK);
  const p2 = pill(PAD + bigW + p1.w + 14, y + 196, String(d.contactosChat), "por el chat", 26, T.card, INK);
  parts.push(p1.svg, p2.svg);
  y += 290;

  // Embudo
  const rows: [string, string, number, string, string][] = [
    ["Apareciste en la página", `${fmt(d.apariciones)} veces`, INNER, T.card, INK],
    ["Vieron tu perfil", `${fmt(d.visitantes)} ${d.visitantes === 1 ? "persona" : "personas"}`, INNER * 0.86, T.card2, INK],
    ["Te contactaron", fmt(total), INNER * 0.7, T.accent, T.dark],
  ];
  for (const [label, value, w, bg, fg] of rows) {
    parts.push(`<rect x="${PAD}" y="${y}" width="${w}" height="74" rx="16" fill="${bg}"/>
  <text x="${PAD + 28}" y="${y + 48}" font-family="${F}" font-size="29" font-weight="${fg === T.dark ? 600 : 400}" fill="${fg}">${esc(label)}</text>
  <text x="${PAD + w - 28}" y="${y + 49}" text-anchor="end" font-family="${F}" font-size="35" font-weight="700" fill="${fg}">${esc(value)}</text>`);
    y += 86;
  }
  let why: string;
  if (total > 0 && d.visitantes > 0) {
    const n = Math.max(1, Math.round(d.visitantes / total));
    const rate = (total / d.visitantes) * 100;
    why = rate >= d.tasaPromedio
      ? `Tu perfil convence: 1 de cada ${n} personas que lo abren te contacta. Lo que falta es que más gente lo abra.`
      : `1 de cada ${n} personas que abren tu perfil te contacta; el promedio en UZEED es mejor. Fotos nuevas y tarifa clara ayudan a convencer.`;
  } else if (d.visitantes > 0) {
    why = "Te están viendo, pero nadie te ha contactado todavía. Fotos nuevas y tarifa clara ayudan a convencer.";
  } else {
    why = "Todavía casi nadie abre tu perfil. Una buena foto principal es lo que más ayuda a que lo abran.";
  }
  const wb = textBlock(PAD, y + 12, why, INNER, 28, INK, 1.32);
  parts.push(wb.svg);
  y += wb.h + 12 + 52;

  // Ranking
  parts.push(`<text x="${PAD}" y="${y}" font-family="${F}" font-size="22" font-weight="600" fill="${T.dim}" letter-spacing="4">RANKING DE CONTACTOS</text>
  <text x="${SUMMARY_W - PAD}" y="${y}" text-anchor="end" font-family="${F}" font-size="20" fill="${T.dim}">WhatsApp + chat en ${d.dias} días · ${fmt(d.ranking.total)} perfiles</text>`);
  y += 22;
  for (const f of d.ranking.filas) {
    if (f.yo) {
      parts.push(`<rect x="${PAD}" y="${y}" width="${INNER}" height="64" rx="16" fill="${T.accent}"/>
  <text x="${PAD + 24}" y="${y + 43}" font-family="${F}" font-size="31" font-weight="700" fill="${T.dark}">#${f.posicion}</text>
  <text x="${PAD + 124}" y="${y + 43}" font-family="${F}" font-size="31" font-weight="700" fill="${T.dark}">Tú, ${esc(cut(d.nombre, 18))}</text>
  <text x="${SUMMARY_W - PAD - 24}" y="${y + 43}" text-anchor="end" font-family="${F}" font-size="31" font-weight="700" fill="${T.dark}">${fmt(f.contactos)}</text>`);
    } else {
      parts.push(`<text x="${PAD + 24}" y="${y + 41}" font-family="${F}" font-size="28" fill="${T.dim}">#${f.posicion}</text>
  <text x="${PAD + 124}" y="${y + 41}" font-family="${F}" font-size="28" fill="${T.dim}">Otro perfil</text>
  <text x="${SUMMARY_W - PAD - 24}" y="${y + 41}" text-anchor="end" font-family="${F}" font-size="28" fill="${T.dim}">${fmt(f.contactos)}</text>`);
    }
    y += 62;
  }
  const me = d.ranking.filas.find((f) => f.yo);
  const above = d.ranking.filas.filter((f) => !f.yo && f.posicion < d.ranking.posicion).sort((a, b) => b.posicion - a.posicion);
  let climb: string;
  if (d.ranking.posicion === 1) climb = "Eres el perfil con más contactos de UZEED en este periodo.";
  else if (me && above.length) {
    const steps = above.slice(0, 2).map((f) => ({ pos: f.posicion, need: f.contactos - me.contactos + 1 }));
    climb = steps.length > 1
      ? `Con ${steps[0].need} ${steps[0].need === 1 ? "contacto" : "contactos"} más pasas al #${steps[0].pos}, y con ${steps[1].need} al #${steps[1].pos}.`
      : `Con ${steps[0].need} ${steps[0].need === 1 ? "contacto" : "contactos"} más pasas al #${steps[0].pos}.`;
  } else climb = "";
  if (climb) {
    const cb = textBlock(PAD, y + 8, climb, INNER, 28, INK);
    parts.push(cb.svg);
    y += cb.h + 8;
  }
  y += 40;

  // Dos tarjetas
  const cw = (INNER - 24) / 2;
  const cards: [string, string][] = [
    d.posicionPromedio
      ? [`Posición ${Math.round(d.posicionPromedio)}`, "es donde apareces en promedio en la página. Muchos clientes no bajan tanto."]
      : ["Sin posición", "todavía no apareces en los listados de la página en este periodo."],
    [`${d.fotos} ${d.fotos === 1 ? "foto" : "fotos"}`, `tiene tu perfil. Las 10 con más contactos tienen ${fmt(d.fotosTop10)} en promedio.`],
  ];
  const blocks = cards.map(([t, body], i) => ({ x: PAD + i * (cw + 24), t, b: textBlock(PAD + i * (cw + 24) + 28, 0, body, cw - 56, 24, T.muted) }));
  const ch = 110 + Math.max(...blocks.map((b) => b.b.h));
  for (const b of blocks) {
    const body = textBlock(b.x + 28, y + 86, cards[blocks.indexOf(b)][1], cw - 56, 24, T.muted);
    parts.push(`<rect x="${b.x}" y="${y}" width="${cw}" height="${ch}" rx="20" fill="none" stroke="${T.stroke}" stroke-width="2"/>
  <text x="${b.x + 28}" y="${y + 74}" font-family="${F}" font-size="52" font-weight="800" fill="${INK}">${esc(b.t)}</text>${body.svg}`);
  }
  y += ch + 50;

  // Consejos
  if (d.consejos.length) {
    parts.push(`<text x="${PAD}" y="${y}" font-family="${F}" font-size="22" font-weight="600" fill="${T.dim}" letter-spacing="4">PARA SUBIR EN EL RANKING</text>`);
    y += 14;
    d.consejos.slice(0, 4).forEach((c, i) => {
      const t = textBlock(PAD + 40, y, c, INNER - 40, 28, INK, 1.28);
      parts.push(`<text x="${PAD}" y="${y + 28}" font-family="${F}" font-size="28" font-weight="700" fill="${T.accent}">${i + 1}</text>${t.svg}`);
      y += t.h + 14;
    });
    y += 30;
  }

  // Llamado final
  const lines = wrap(
    d.multiplicador
      ? `Los perfiles que aparecen ahí reciben ${d.multiplicador.visitas >= 2 && d.multiplicador.contactos >= 2 ? "más del doble" : "bastantes más"} de visitas y de contactos que los que están en tu posición. Súbelo con el plan mensual en uzeed.cl`
      : "Los perfiles que aparecen primero reciben más visitas y contactos. Súbelo con el plan mensual en uzeed.cl",
    INNER - 64,
    27,
  );
  const top = y;
  let iy = top + 32;
  let ctaParts = "";
  if (d.multiplicador) {
    const a = pill(PAD + 32, iy, `x${d.multiplicador.visitas.toLocaleString("es-CL")}`, "visitas", 34, T.dark, T.accent);
    const b = pill(PAD + 32 + a.w + 14, iy, `x${d.multiplicador.contactos.toLocaleString("es-CL")}`, "contactos", 34, T.dark, T.accent);
    ctaParts += a.svg + b.svg;
    iy += 68 + 26;
  }
  ctaParts += `<text x="${PAD + 32}" y="${iy + 34}" font-family="${F}" font-size="38" font-weight="800" fill="${T.dark}">Sube a los 10 primeros lugares de la página.</text>`;
  iy += 56;
  ctaParts += lines.map((l, i) => `<text x="${PAD + 32}" y="${iy + 27 + i * 36}" font-family="${F}" font-size="27" fill="${T.ctaText}">${esc(l)}</text>`).join("");
  iy += 27 + (lines.length - 1) * 36 + 36;
  parts.push(`<rect x="${PAD}" y="${top}" width="${INNER}" height="${iy - top}" rx="26" fill="${T.ctaBg}"/>${ctaParts}`);
  y = iy + 60;

  const height = Math.ceil(y);
  return {
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${SUMMARY_W}" height="${height}" viewBox="0 0 ${SUMMARY_W} ${height}">
  <rect width="${SUMMARY_W}" height="${height}" fill="${T.bg}"/>
  ${parts.join("\n  ")}
</svg>`,
  };
}

export async function renderSummary(d: SummaryData): Promise<Buffer> {
  const { svg } = summarySvg(d);
  return sharp(Buffer.from(svg)).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
}
