/**
 * Filtros de seguridad de Acompañantes IA.
 *
 * Son la última barrera, no la única: el prompt de sistema también fija las
 * reglas y el proveedor aplica las suyas. Aquí se corta lo que nunca puede
 * pasar, venga del usuario o del modelo:
 *  - cualquier referencia sexual a menores o a personajes que lo aparenten;
 *  - imágenes de personas reales (famosos, conocidos, "la cara de…");
 *  - violencia sexual / falta de consentimiento, y otros límites duros.
 *
 * Los textos se normalizan (minúsculas, sin tildes, sin signos repetidos) para
 * que "Niñ@", "COLEGIALA" o "a d o l e s c e n t e" no esquiven las reglas.
 */
import { prisma } from "../db";

export type SafetySource = "chat_in" | "chat_out" | "image";

export type SafetyResult =
  | { ok: true }
  | { ok: false; reason: SafetyReason; message: string };

export type SafetyReason = "minors" | "real_person" | "non_consent" | "prohibited";

export function normalizeForSafety(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "a")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita los espacios entre letras sueltas: "n i n a" → "nina". */
function collapseSpacedLetters(text: string): string {
  return text.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, ""));
}

/* Menores: siempre bloqueado, en chat y en imágenes. */
const MINOR_PATTERNS: RegExp[] = [
  /\bmenor(es)? de edad\b/,
  /\bmenores\b/,
  /\binfantil(es)?\b/,
  /\bcolegial(a|as|es)?\b/,
  /\bescolar(es)?\b/,
  /\buniforme (del )?(colegio|liceo)\b/,
  /\b(liceo|liceana|primaria|secundaria|kinder|jardin infantil)\b/,
  /\badolescen(te|tes|cia)\b/,
  /\b(pre ?)?puber(es|tad|al)?\b/,
  /\bquincea(nera|ñera)\b/,
  /\b(loli|lolita|lolis|shota|shotacon|lolicon)\b/,
  /\b(teen|teens|teenager|underage|jailbait|preteen)\b/,
  /\b(child|children|kid|kids|minor|minors|toddler)\b/,
  /\b(pedo|pedofil\w*|pederast\w*|cp)\b/,
  // Edades explícitas por debajo de 18 ("tengo 16 años", "de 15 anos", "16yo").
  /\b(tengo|tienes|tiene|tenga|tenia|aparenta|aparente|finge|fingir|edad de) (1[0-7]|[1-9]) (anos|ano|años)\b/,
  /\b(1[0-7]|[1-9]) ?(yo|y o|years? old|anitos)\b/,
  /\b(1[0-7]|[1-9]) (anos|años) de edad\b/,
];

/* En imágenes se exige más: palabras que en el chat pueden ser cariñosas
   ("mi niña") en una imagen describen el cuerpo representado. */
const MINOR_IMAGE_PATTERNS: RegExp[] = [
  /\b(nina|ninas|nino|ninos|niña|niñas|niño|niños|nena|nenas|cabra chica|guagua|bebe|baby ?face|young ?looking|aniñad\w*|petite ?girl|little ?girl|schoolgirl)\b/,
  /\b(cuerpo|apariencia|cara) de (nina|niña|nino|niño|menor)\b/,
];

/* Personas reales: no se generan imágenes de nadie real. */
const REAL_PERSON_PATTERNS: RegExp[] = [
  /\b(deep ?fake|face ?swap|cambio de cara|intercambi\w* (de )?cara)\b/,
  /\b(con|usa|usando|ponle|pon) (la|su) cara de\b/,
  /\b(que se parezca|parecid[ao]|identic[ao]|igual(ita|ito)?) a\b/,
  /\b(famos[ao]s?|celebridad\w*|celebrity|actriz|actor|cantante|influencer|youtuber|tiktoker|streamer|modelo real|politic[ao]|futbolista)\b/,
  /\b(foto|fotos|imagen|imagenes) (real(es)? )?de (mi|mis|una|un|la|el) (ex|polola|pololo|novia|novio|esposa|esposo|vecin[ao]|jef[ao]|compañer[ao]|companer[ao]|amig[ao]|prima|primo|herman[ao]|profe\w*)\b/,
  /\b(desnud[ao]|desvist\w*|sin ropa) a (mi|mis|una|un|la|el)\b/,
  /\b(de|a) (esta|este|la) (persona|foto)\b/,
];

/* Violencia sexual y falta de consentimiento. */
const NON_CONSENT_PATTERNS: RegExp[] = [
  /\b(violacion|violar|violad[ao]|violando|rape|raped)\b/,
  /\bsin (su )?consentimiento\b/,
  /\b(drogad[ao]|inconsciente|desmayad[ao]|dormid[ao] mientras|sedad[ao])\b.*\b(sexo|follar|tocar|coger|penetr\w*)\b/,
  /\b(abuso sexual|abusar de|forzad[ao] a|obligad[ao] a tener sexo)\b/,
];

/* Otros límites duros de la plataforma. */
const PROHIBITED_PATTERNS: RegExp[] = [
  /\b(zoofilia|bestialismo|bestiality|necrofilia|incesto|incest)\b/,
  /\bsexo con (un |una )?(animal|perro|caballo|cadaver)\b/,
];

const MESSAGES: Record<SafetyReason, string> = {
  minors:
    "Este contenido no está permitido. En UZEED todos los personajes son adultos y no se aceptan referencias a menores de edad.",
  real_person:
    "No se pueden crear imágenes de personas reales ni parecidas a alguien real. Pide una imagen del personaje.",
  non_consent: "No se permite contenido sin consentimiento ni violencia sexual.",
  prohibited: "Este contenido no está permitido en la plataforma.",
};

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function checkText(text: string, source: SafetySource): SafetyResult {
  const base = normalizeForSafety(text);
  const variants = [base, collapseSpacedLetters(base)];

  const hit = (patterns: RegExp[]) => variants.some((v) => matchAny(v, patterns));

  if (hit(MINOR_PATTERNS) || (source === "image" && hit(MINOR_IMAGE_PATTERNS))) {
    return { ok: false, reason: "minors", message: MESSAGES.minors };
  }
  if (source === "image" && hit(REAL_PERSON_PATTERNS)) {
    return { ok: false, reason: "real_person", message: MESSAGES.real_person };
  }
  if (hit(NON_CONSENT_PATTERNS)) {
    return { ok: false, reason: "non_consent", message: MESSAGES.non_consent };
  }
  if (hit(PROHIBITED_PATTERNS)) {
    return { ok: false, reason: "prohibited", message: MESSAGES.prohibited };
  }
  return { ok: true };
}

/** Términos que siempre van en el prompt negativo de las imágenes. */
export const IMAGE_NEGATIVE_PROMPT = [
  "child", "minor", "teen", "underage", "young-looking", "childlike", "loli",
  "school uniform", "petite body", "flat chest", "baby face",
  "real person", "celebrity", "identifiable person",
  "deformed", "extra limbs", "watermark", "text", "logo",
].join(", ");

/** Registra un bloqueo para revisión en el panel. Nunca lanza. */
export async function recordFlag(params: {
  userId?: string | null;
  companionId?: string | null;
  source: SafetySource;
  reason: string;
  text: string;
}): Promise<void> {
  try {
    await prisma.aiCompanionFlag.create({
      data: {
        userId: params.userId || null,
        companionId: params.companionId || null,
        source: params.source,
        reason: params.reason,
        excerpt: String(params.text || "").slice(0, 600),
      },
    });
  } catch (err) {
    console.error("[ai-companions] no se pudo registrar el bloqueo", err);
  }
}
