import { prisma } from "../db";
import { config } from "../config";
import { postTweet, uploadImage, xEnabled, XApiError, X_MAX_CHARS } from "./xClient";

/**
 * Anuncio automático en X de cada perfil profesional nuevo.
 *
 * El alta solo encola: publicar en caliente ataría el registro a que la API de
 * X responda, y además la ficha recién creada todavía está incompleta y sin
 * revisar. El worker publica más tarde, cuando el perfil ya está activo.
 */

/** Pasado este plazo el anuncio ya no es novedad y se descarta. */
export const MAX_AGE_DAYS = 7;
/** Reintentos ante fallos pasajeros de la API antes de darlo por perdido. */
export const MAX_ATTEMPTS = 5;

/** Espera entre reintentos, creciente: 15 min, 30, 60, 120… */
function backoffMinutes(attempts: number): number {
  return 15 * 2 ** Math.max(0, attempts - 1);
}

/**
 * Encola el anuncio del alta. Nunca lanza: un fallo aquí no puede tumbar un
 * registro, que es lo único que le importa a quien se está dando de alta.
 */
export async function enqueueNewProfessionalPost(userId: string): Promise<void> {
  try {
    // Margen configurable: da tiempo a terminar la ficha y a la revisión.
    const scheduledAt = new Date(Date.now() + config.x.delayMinutes * 60_000);
    await prisma.socialPost.upsert({
      where: {
        network_kind_userId: { network: "X", kind: "NEW_PROFESSIONAL", userId },
      },
      // Si ya existe no se toca: un reintento de alta no reprograma ni
      // reabre un anuncio que ya se publicó.
      update: {},
      create: { network: "X", kind: "NEW_PROFESSIONAL", userId, scheduledAt },
    });
  } catch (err) {
    console.error("[social/x] no se pudo encolar el anuncio", { userId, error: err });
  }
}

type ProfileForPost = {
  id: string;
  username: string;
  displayName: string | null;
  city: string | null;
  serviceCategory: string | null;
};

const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Misma palabra de categoría que usa la web para las URLs limpias. */
function categoryWord(serviceCategory?: string | null): "escort" | "masajista" {
  const c = (serviceCategory || "").toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
  return c.includes("masaj") ? "masajista" : "escort";
}

/**
 * URL pública del perfil. Replica `cleanProfileHref` de la web: si el username
 * es URL-safe se usa la ruta limpia y, si no, la antigua por UUID —que sigue
 * funcionando— para no publicar nunca un enlace roto.
 */
export function profileUrl(p: ProfileForPost): string {
  const base = config.appUrl.replace(/\/$/, "");
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.username)) {
    return `${base}/${categoryWord(p.serviceCategory)}/${p.username}`;
  }
  const slug = slugify([p.displayName, p.city].filter(Boolean).join(" "));
  return slug ? `${base}/profesional/${p.id}/${slug}` : `${base}/profesional/${p.id}`;
}

/** Etiqueta en CamelCase a partir de un texto libre ("Viña del Mar" → #ViñaDelMar). */
function hashtag(text: string): string {
  const words = text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  return "#" + words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
}

/**
 * Texto del anuncio. Solo usa lo que ya es público en la ficha: nombre,
 * categoría y ciudad. Nunca dirección, teléfono ni correo, aunque estén en la
 * base de datos.
 */
export function buildPostText(p: ProfileForPost): string {
  const name = (p.displayName || p.username).trim();
  const category = categoryWord(p.serviceCategory);
  const city = (p.city || "").trim();
  const url = profileUrl(p);

  const headline = city
    ? `✨ Nueva ${category} en ${city}: ${name}`
    : `✨ Nueva ${category} en UZEED: ${name}`;

  const tags = [hashtag(city), hashtag(`${category}s`), "#UZEED"].filter(Boolean);

  // El enlace y el titular son lo que no puede faltar; las etiquetas se caen
  // primero si el texto no entra en el límite de X.
  let text = `${headline}\n\nSu perfil en UZEED:\n${url}\n\n${tags.join(" ")}`;
  if (text.length > X_MAX_CHARS) text = `${headline}\n\n${url}\n\n#UZEED`;
  if (text.length > X_MAX_CHARS) text = `✨ Nueva ${category} en UZEED\n${url}`;
  return text;
}

/** Convierte una URL de la ficha en absoluta: las subidas se guardan relativas. */
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${config.apiUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Tope de la subida de imágenes de X para fotos. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Descarga el avatar para adjuntarlo. Devuelve null ante cualquier problema:
 * un post sin foto sigue sirviendo, uno que no sale no.
 */
async function fetchAvatar(url: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(absoluteMediaUrl(url));
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, mimeType };
  } catch (err) {
    console.error("[social/x] no se pudo descargar el avatar", { url, error: err });
    return null;
  }
}

type SkipReason = "perfil eliminado" | "ya no es profesional" | "caducado";

/**
 * Publica los anuncios pendientes que ya vencieron.
 *
 * Un perfil todavía inactivo no se descarta: se reprograma, porque lo normal
 * es que se active al poner la contraseña o tras la revisión.
 */
export async function publishPendingSocialPosts(): Promise<void> {
  if (!config.x.enabled) return;
  if (!xEnabled()) {
    console.log("[social/x] sin credenciales, no se publica");
    return;
  }

  const pending = await prisma.socialPost.findMany({
    where: { network: "X", status: "PENDING", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    // Por pasada, para no gastar la cuota de golpe ni parecer un bot en ráfaga.
    take: Math.max(1, config.x.batchSize),
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          city: true,
          serviceCategory: true,
          avatarUrl: true,
          isActive: true,
          profileType: true,
        },
      },
    },
  });

  for (const post of pending) {
    const user = post.user;
    const expired = Date.now() - post.createdAt.getTime() > MAX_AGE_DAYS * 86_400_000;

    let skip: SkipReason | null = null;
    if (!user) skip = "perfil eliminado";
    else if (user.profileType !== "PROFESSIONAL") skip = "ya no es profesional";
    else if (expired) skip = "caducado";

    if (skip) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "SKIPPED", lastError: skip },
      });
      console.log("[social/x] anuncio descartado", { userId: post.userId, motivo: skip });
      continue;
    }

    // Aún no está publicado de cara al público: se espera, no se descarta.
    if (!user.isActive) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { scheduledAt: new Date(Date.now() + 60 * 60_000) },
      });
      continue;
    }

    const text = buildPostText(user);
    try {
      const mediaIds: string[] = [];
      if (user.avatarUrl) {
        const image = await fetchAvatar(user.avatarUrl);
        if (image) {
          mediaIds.push(await uploadImage(image.bytes, image.mimeType));
        }
      }

      const externalId = await postTweet(text, mediaIds);
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: "POSTED",
          text,
          externalId,
          postedAt: new Date(),
          attempts: post.attempts + 1,
          lastError: null,
        },
      });
      console.log("[social/x] anuncio publicado", { userId: post.userId, externalId });
    } catch (err) {
      const attempts = post.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const retryable = err instanceof XApiError ? err.retryable : true;
      const giveUp = !retryable || attempts >= MAX_ATTEMPTS;

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          attempts,
          text,
          lastError: message.slice(0, 500),
          ...(giveUp
            ? { status: "FAILED" as const }
            : { scheduledAt: new Date(Date.now() + backoffMinutes(attempts) * 60_000) }),
        },
      });
      console.error("[social/x] fallo al publicar", {
        userId: post.userId,
        attempts,
        giveUp,
        error: message,
      });
    }
  }
}
