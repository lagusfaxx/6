import { prisma } from "../db";
import { withActivePlan } from "../lib/billingSettings";
import { cleanMotelAmenities } from "@uzeed/shared/motel";

/**
 * Datos del directorio público de moteles (/moteles y sus landings por
 * comuna). Junta dos fuentes:
 *  - locales con cuenta (User ESTABLISHMENT): los maneja el dueño, reservan;
 *  - fichas cargadas por el equipo (Establishment externalOnly): sólo
 *    muestran datos y el sitio web del motel.
 * La web agrupa por comuna y filtra; acá sólo se arma la tarjeta.
 */

type Prices = { "3H": number | null; "6H": number | null; NIGHT: number | null };

export type DirectoryMotel = {
  id: string;
  slug: string;
  kind: "profile" | "listing";
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  photos: string[];
  isOpen: boolean;
  amenities: string[];
  roomAmenities: string[];
  roomsCount: number;
  prices: Prices;
  promo: { title: string; discountPercent: number | null; discountClp: number | null } | null;
  rating: number | null;
  reviewsCount: number;
  websiteUrl: string | null;
  schedule: string | null;
  updatedAt: string;
};

/* Fichas del equipo que NO son moteles: "Espacios exclusivos" es otra cosa y
   sigue en /establecimientos. El resto de categorías de local son moteles u
   hoteles por hora. */
const NON_MOTEL_CATEGORY_SLUGS = ["espacios-exclusivos"];

const SLUG_SAFE = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** URL pública: /motel/{username} si el username sirve de slug; si no, el id. */
export function motelSlug(username: string | null | undefined, id: string) {
  const u = String(username || "").toLowerCase();
  return SLUG_SAFE.test(u) ? u : id;
}

function minPrice(values: Array<number | null | undefined>) {
  const valid = values.map((v) => Number(v || 0)).filter((v) => v > 0);
  return valid.length ? Math.min(...valid) : null;
}

/** Promo vigente hoy (empezó y no terminó). */
function isLivePromo(p: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now: number) {
  if (!p.isActive) return false;
  if (p.startsAt && p.startsAt.getTime() > now) return false;
  if (p.endsAt && p.endsAt.getTime() < now) return false;
  return true;
}

export async function loadMotelDirectory(): Promise<DirectoryMotel[]> {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: withActivePlan({
      profileType: "ESTABLISHMENT" as const,
      isActive: true,
      isVerified: true,
      businessPublished: true,
    }),
    select: {
      id: true, username: true, displayName: true, city: true, address: true,
      latitude: true, longitude: true, coverUrl: true, avatarUrl: true,
      businessOpen: true, profileTags: true, serviceDescription: true, lastEditedAt: true, createdAt: true,
      profileMedia: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, take: 5, select: { url: true } },
      motelRooms: {
        where: { isActive: true },
        select: { price: true, price3h: true, price6h: true, priceNight: true, amenities: true, photoUrls: true },
      },
      motelPromotions: {
        where: { isActive: true },
        select: { title: true, discountPercent: true, discountClp: true, isActive: true, startsAt: true, endsAt: true },
      },
    },
    take: 500,
  });

  const listings = await prisma.establishment.findMany({
    where: { externalOnly: true, category: { kind: "ESTABLISHMENT", slug: { notIn: NON_MOTEL_CATEGORY_SLUGS } } },
    select: {
      id: true, name: true, city: true, address: true, latitude: true, longitude: true,
      galleryUrls: true, websiteUrl: true, description: true, updatedAt: true,
    },
    take: 500,
  });

  const ids = [...users.map((u) => u.id), ...listings.map((l) => l.id)];
  const reviewRows = ids.length
    ? await prisma.establishmentReview.groupBy({
        by: ["establishmentId"],
        where: { establishmentId: { in: ids } },
        _avg: { stars: true },
        _count: { _all: true },
      })
    : [];
  const reviews = new Map(reviewRows.map((r) => [r.establishmentId, { avg: r._avg.stars, count: r._count._all }]));
  const ratingOf = (id: string) => {
    const r = reviews.get(id);
    return { rating: r?.avg ? Number(r.avg.toFixed(1)) : null, reviewsCount: r?.count || 0 };
  };

  const fromProfiles: DirectoryMotel[] = users.map((u) => {
    const rooms = u.motelRooms;
    const roomPhotos = rooms.flatMap((r) => r.photoUrls || []);
    const gallery = u.profileMedia.map((m) => m.url);
    const photos = Array.from(new Set([u.coverUrl, ...gallery, ...roomPhotos].filter(Boolean) as string[])).slice(0, 5);
    const promos = u.motelPromotions.filter((p) => isLivePromo(p, now));
    const best = promos.sort((a, b) => Number(b.discountPercent || 0) - Number(a.discountPercent || 0))[0];
    return {
      id: u.id,
      slug: motelSlug(u.username, u.id),
      kind: "profile",
      name: u.displayName || u.username,
      city: u.city,
      address: u.address,
      latitude: u.latitude,
      longitude: u.longitude,
      coverUrl: photos[0] || u.avatarUrl || null,
      photos,
      isOpen: u.businessOpen,
      amenities: cleanMotelAmenities(u.profileTags),
      roomAmenities: Array.from(new Set(rooms.flatMap((r) => r.amenities || []))),
      roomsCount: rooms.length,
      prices: {
        "3H": minPrice(rooms.map((r) => r.price3h || r.price)),
        "6H": minPrice(rooms.map((r) => r.price6h)),
        NIGHT: minPrice(rooms.map((r) => r.priceNight)),
      },
      promo: best ? { title: best.title, discountPercent: best.discountPercent, discountClp: best.discountClp } : null,
      ...ratingOf(u.id),
      websiteUrl: null,
      schedule: u.serviceDescription,
      /* lastEditedAt y no updatedAt: updatedAt cambia con cada conexión. */
      updatedAt: (u.lastEditedAt ?? u.createdAt).toISOString(),
    };
  });

  const fromListings: DirectoryMotel[] = listings.map((l) => ({
    id: l.id,
    slug: l.id,
    kind: "listing",
    name: l.name,
    city: l.city,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    coverUrl: l.galleryUrls?.[0] || null,
    photos: (l.galleryUrls || []).slice(0, 5),
    isOpen: true,
    amenities: [],
    roomAmenities: [],
    roomsCount: 0,
    prices: { "3H": null, "6H": null, NIGHT: null },
    promo: null,
    ...ratingOf(l.id),
    websiteUrl: l.websiteUrl,
    schedule: null,
    updatedAt: l.updatedAt.toISOString(),
  }));

  /* Primero los que tienen cuenta (se puede reservar), después el resto. */
  return [...fromProfiles, ...fromListings];
}

/** Ficha pública de un motel por username, id de cuenta o id de ficha del equipo. */
export async function loadMotelDetail(ref: string, viewerId: string | null) {
  const raw = String(ref || "").trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  const u = await prisma.user.findFirst({
    where: {
      profileType: "ESTABLISHMENT",
      ...(isUuid ? { id: raw } : { username: { equals: raw, mode: "insensitive" as const } }),
    },
    select: {
      id: true, username: true, displayName: true, city: true, address: true, phone: true,
      latitude: true, longitude: true, coverUrl: true, avatarUrl: true, bio: true,
      serviceDescription: true, profileTags: true, isActive: true, isVerified: true,
      businessOpen: true, businessPublished: true, lastEditedAt: true, createdAt: true,
      profileMedia: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, take: 24, select: { url: true } },
      motelRooms: { where: { isActive: true }, orderBy: [{ price: "asc" }, { createdAt: "asc" }] },
      motelPromotions: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (u) {
    const isOwner = viewerId === u.id;
    if (!isOwner && (!u.isActive || !u.businessPublished || !u.isVerified)) return null;
    const now = Date.now();
    const reviewList = await prisma.establishmentReview.findMany({
      where: { establishmentId: u.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, stars: true, comment: true, createdAt: true },
    });
    const avg = reviewList.length ? reviewList.reduce((a, r) => a + r.stars, 0) / reviewList.length : null;
    return {
      id: u.id,
      slug: motelSlug(u.username, u.id),
      kind: "profile" as const,
      isOwner,
      name: u.displayName || u.username,
      city: u.city,
      address: u.address,
      phone: u.phone,
      latitude: u.latitude,
      longitude: u.longitude,
      coverUrl: u.coverUrl,
      avatarUrl: u.avatarUrl,
      description: u.bio,
      schedule: u.serviceDescription,
      amenities: cleanMotelAmenities(u.profileTags),
      isOpen: u.businessOpen,
      isPublished: u.businessPublished,
      isVerified: u.isVerified,
      gallery: Array.from(new Set([u.coverUrl, ...u.profileMedia.map((m) => m.url)].filter(Boolean) as string[])),
      rooms: u.motelRooms.map((r) => ({
        id: r.id, name: r.name, description: r.description, roomType: r.roomType,
        amenities: r.amenities, photoUrls: r.photoUrls,
        price3h: r.price3h || r.price || null, price6h: r.price6h || null, priceNight: r.priceNight || null,
      })),
      promotions: u.motelPromotions
        .filter((p) => isLivePromo(p, now))
        .map((p) => ({
          id: p.id, title: p.title, description: p.description, discountPercent: p.discountPercent,
          discountClp: p.discountClp, roomIds: p.roomIds?.length ? p.roomIds : p.roomId ? [p.roomId] : [],
          endsAt: p.endsAt?.toISOString() ?? null,
        })),
      rating: avg ? Number(avg.toFixed(1)) : null,
      reviewsCount: reviewList.length,
      reviews: reviewList.slice(0, 12).map((r) => ({ id: r.id, stars: r.stars, comment: r.comment, createdAt: r.createdAt.toISOString() })),
      websiteUrl: null as string | null,
      updatedAt: (u.lastEditedAt ?? u.createdAt).toISOString(),
    };
  }

  if (!isUuid) return null;
  const l = await prisma.establishment.findUnique({
    where: { id: raw },
    include: { category: { select: { kind: true, slug: true } } },
  });
  if (!l || !l.externalOnly || l.category.kind !== "ESTABLISHMENT" || NON_MOTEL_CATEGORY_SLUGS.includes(l.category.slug)) return null;
  const reviewList = await prisma.establishmentReview.findMany({
    where: { establishmentId: l.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, stars: true, comment: true, createdAt: true },
  });
  const avg = reviewList.length ? reviewList.reduce((a, r) => a + r.stars, 0) / reviewList.length : null;
  return {
    id: l.id,
    slug: l.id,
    kind: "listing" as const,
    isOwner: false,
    name: l.name,
    city: l.city,
    address: l.address,
    phone: l.phone,
    latitude: l.latitude,
    longitude: l.longitude,
    coverUrl: l.galleryUrls?.[0] || null,
    avatarUrl: null as string | null,
    description: l.description,
    schedule: null as string | null,
    amenities: [] as string[],
    isOpen: true,
    isPublished: true,
    isVerified: false,
    gallery: l.galleryUrls || [],
    rooms: [] as any[],
    promotions: [] as any[],
    rating: avg ? Number(avg.toFixed(1)) : null,
    reviewsCount: reviewList.length,
    reviews: reviewList.slice(0, 12).map((r) => ({ id: r.id, stars: r.stars, comment: r.comment, createdAt: r.createdAt.toISOString() })),
    websiteUrl: l.websiteUrl,
    updatedAt: l.updatedAt.toISOString(),
  };
}
