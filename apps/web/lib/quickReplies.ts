/* Mismas preguntas que `QUICK_REPLY_TOPICS` en @uzeed/shared (la API valida
   con esa lista). Se repiten aquí para no arrastrar el paquete compartido —y
   zod con él— al bundle del cliente. */
export const QUICK_REPLY_TOPICS = [
  {
    key: "tarifa",
    label: "Tarifa",
    question: "¿Cuál es tu tarifa?",
    required: true,
    placeholder: "Ej: 1 hora $60.000 · 2 horas $110.000 · Noche $250.000",
  },
  {
    key: "servicios",
    label: "Servicios",
    question: "¿Qué servicios ofreces?",
    required: true,
    placeholder: "Ej: Masajes, trato de polola, despedidas...",
  },
  {
    key: "horario",
    label: "Horario",
    question: "¿Qué horario tienes?",
    required: false,
    placeholder: "Ej: Lunes a sábado de 11:00 a 23:00",
  },
  {
    key: "ubicacion",
    label: "Ubicación",
    question: "¿Dónde atiendes?",
    required: false,
    placeholder: "Ej: Depto propio en Providencia, también voy a hoteles",
  },
  {
    key: "pago",
    label: "Formas de pago",
    question: "¿Qué formas de pago aceptas?",
    required: false,
    placeholder: "Ej: Efectivo o transferencia",
  },
] as const;

export type QuickReplyKey = (typeof QUICK_REPLY_TOPICS)[number]["key"];
export type QuickReplies = Partial<Record<QuickReplyKey, string>>;

export const QUICK_REPLY_MAX_LENGTH = 500;
export const QUICK_REPLY_MIN_LENGTH = 3;

/** Texto recortado y sin vacíos, listo para enviar a la API. */
export function cleanQuickReplies(replies: QuickReplies): QuickReplies {
  const out: QuickReplies = {};
  for (const t of QUICK_REPLY_TOPICS) {
    const text = (replies[t.key] || "").trim();
    if (text) out[t.key] = text.slice(0, QUICK_REPLY_MAX_LENGTH);
  }
  return out;
}

/** Mensaje de error si falta alguna obligatoria; null si está todo. */
export function quickRepliesError(replies: QuickReplies): string | null {
  const missing = QUICK_REPLY_TOPICS.filter(
    (t) => t.required && (replies[t.key] || "").trim().length < QUICK_REPLY_MIN_LENGTH,
  );
  if (!missing.length) return null;
  return `Completa tus respuestas rápidas: ${missing
    .map((t) => t.label.toLowerCase())
    .join(" y ")}.`;
}
