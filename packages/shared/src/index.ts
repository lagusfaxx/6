import { z } from "zod";

/**
 * Tope de largo del nombre público. Un nombre kilométrico rompe las tarjetas
 * del inicio y los listados, que es donde se decide el contacto, así que se
 * bloquea en el registro en vez de arreglarlo después a mano.
 */
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MIN_LENGTH = 2;

const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`)
  .max(DISPLAY_NAME_MAX_LENGTH, `El nombre no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`);

export const Roles = z.enum(["USER", "ADMIN"]);
export type Role = z.infer<typeof Roles>;

export const ProfileTypes = z.enum([
  "CLIENT",
  "VIEWER",
  "CREATOR",
  "PROFESSIONAL",
  "ESTABLISHMENT",
  "SHOP",
]);
export type ProfileType = z.infer<typeof ProfileTypes>;

export const Genders = z.enum(["MALE", "FEMALE", "OTHER"]);
export type Gender = z.infer<typeof Genders>;

export const PreferenceGenders = z.enum(["MALE", "FEMALE", "ALL", "OTHER"]);
export type PreferenceGender = z.infer<typeof PreferenceGenders>;

/**
 * Respuestas rápidas de la profesional: preguntas típicas que el cliente toca
 * en el chat y que responden al instante con el texto que ella dejó.
 * Tarifa y servicios son obligatorias en el registro: son justo lo que los
 * clientes preguntan y lo que se queda sin responder.
 */
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

/**
 * Deja sólo las claves conocidas, con el texto recortado y sin vacíos.
 * Acepta un objeto o su versión en JSON (el registro con Google llega como
 * multipart y los campos vienen como texto).
 */
export function normalizeQuickReplies(input: unknown): QuickReplies {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: QuickReplies = {};
  for (const topic of QUICK_REPLY_TOPICS) {
    const value = (raw as Record<string, unknown>)[topic.key];
    if (typeof value !== "string") continue;
    const text = value.trim().slice(0, QUICK_REPLY_MAX_LENGTH);
    if (text) out[topic.key] = text;
  }
  return out;
}

/** Obligatorias que faltan (o que son demasiado cortas para decir algo). */
export function missingQuickReplies(replies: QuickReplies): QuickReplyKey[] {
  return QUICK_REPLY_TOPICS.filter(
    (t) => t.required && (replies[t.key]?.length ?? 0) < QUICK_REPLY_MIN_LENGTH,
  ).map((t) => t.key);
}

export function quickRepliesRequiredMessage(missing: QuickReplyKey[]): string {
  const labels = QUICK_REPLY_TOPICS.filter((t) => missing.includes(t.key)).map((t) =>
    t.label.toLowerCase(),
  );
  return `Completa tus respuestas rápidas: ${labels.join(" y ")}.`;
}

export const registerInputSchema = z
  .object({
    phone: z
      .string()
      .regex(
        /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/,
        "Ingresa un número válido con código de país (+56, +57, +58 o +51).",
      ),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    displayName: displayNameSchema,
    gender: Genders.optional(),
    profileType: ProfileTypes,
    preferenceGender: PreferenceGenders.optional(),
    address: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    latitude: z.number().finite().optional(),
    longitude: z.number().finite().optional(),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, "Terms must be accepted"),
    birthdate: z.string().optional(),
    bio: z.string().max(1000).optional(),
    primaryCategory: z.string().max(120).optional(),
    referralCode: z.string().max(20).optional(),
    // Respuesta automática: la profesional puede dejarla configurada desde el
    // propio registro.
    autoReplyEnabled: z.boolean().optional(),
    autoReplyMessage: z.string().max(500).optional(),
    quickReplies: z.record(z.string().max(QUICK_REPLY_MAX_LENGTH)).optional(),
  })
  .superRefine((data, ctx) => {
    const isBusiness = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(
      data.profileType,
    );

    if (data.profileType === "PROFESSIONAL") {
      if (!data.gender) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gender"],
          message: "required",
        });
      }
      if (!data.birthdate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["birthdate"],
          message: "required",
        });
      }
      // Bio is optional at registration; professionals complete it later
      const missing = missingQuickReplies(normalizeQuickReplies(data.quickReplies));
      if (missing.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quickReplies"],
          message: quickRepliesRequiredMessage(missing),
        });
      }
    }

    // Address/geolocation required for all business profiles (used for distance search)
    if (isBusiness) {
      if (!data.address || data.address.trim().length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address"],
          message: "required",
        });
      }
      if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address"],
          message: "Debes validar la dirección usando el buscador de Mapbox.",
        });
      }
    }
  });
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const quickRegisterSchema = z.object({
  displayName: displayNameSchema,
  primaryCategory: z.string().min(1),
  address: z.string().min(6),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  serviceDescription: z.string().min(3).max(500),
  email: z.string().email(),
  phone: z.string().regex(/^\+\d{8,15}$/),
  acceptTerms: z.literal(true),
  // Optional extended fields
  bio: z.string().max(500).optional(),
  gender: z.enum(["FEMALE", "MALE", "OTHER"]).optional(),
  birthMonth: z.string().optional(),
  birthYear: z.string().optional(),
  profileTags: z.string().optional(),
  serviceTags: z.string().optional(),
  baseRate: z
    .number()
    .int()
    .min(1000, "La tarifa base mínima es $1.000 CLP.")
    .optional(),
  minDurationMinutes: z.number().int().min(0).optional(),
  acceptsIncalls: z.boolean().optional(),
  acceptsOutcalls: z.boolean().optional(),
  selectedPlan: z.enum(["free", "gold"]).default("free"),
});
export type QuickRegisterInput = z.infer<typeof quickRegisterSchema>;

export const PostMediaType = z.enum(["IMAGE", "VIDEO"]);
export type MediaType = z.infer<typeof PostMediaType>;

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(20000),
  isPublic: z.boolean().default(false),
  price: z.number().int().min(0).max(5000).default(0),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

// Date utils (shared between api & web)
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
  username: string;
  profileType: ProfileType;
  gender: Gender | null;
  preferenceGender: PreferenceGender | null;
  role: Role;
  membershipExpiresAt: string | null;
  subscriptionPrice?: number | null;
};

export type FeedPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  price: number;
  media: { id: string; type: MediaType; url: string }[];
  paywalled: boolean;
};

export function isMembershipActive(
  expiresAt: string | null | undefined,
): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}
