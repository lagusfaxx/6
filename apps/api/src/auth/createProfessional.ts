import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";
import { sendSetPasswordEmail } from "./verification";

/**
 * Thrown by createProfessionalUser when the target email is already in use.
 * Callers (e.g. quick-register, Flow Gold webhook) can catch this and
 * surface a sensible error or mark a pending payment as failed.
 */
export class EmailInUseError extends Error {
  code = "EMAIL_IN_USE" as const;
  constructor(public email: string) {
    super(`Email already registered: ${email}`);
  }
}

export const MIN_PROFESSIONAL_GALLERY_PHOTOS = 3;

/**
 * Thrown when a caller tries to create a professional with fewer than the
 * required gallery photos. The web UI enforces this too, but we also enforce
 * it here so no path (quick-register, Gold webhook replay, future callers)
 * can create a professional with an incomplete gallery.
 */
export class InsufficientGalleryPhotosError extends Error {
  code = "INSUFFICIENT_PHOTOS" as const;
  constructor(public received: number) {
    super(
      `Professional registration requires at least ${MIN_PROFESSIONAL_GALLERY_PHOTOS} gallery photos, got ${received}`,
    );
  }
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

export type CreateProfessionalInput = {
  displayName: string;
  primaryCategory: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceDescription: string;
  email: string;
  phone: string;
  bio?: string | null;
  gender?: string | null;
  birthMonth?: string | null;
  birthYear?: string | null;
  profileTags?: string[];
  serviceTags?: string[];
  baseRate?: number | null;
  minDurationMinutes?: number | null;
  acceptsIncalls?: boolean | null;
  acceptsOutcalls?: boolean | null;
  galleryUrls?: string[];
  /** "SILVER" for free, "GOLD" for paid */
  tier: "SILVER" | "GOLD";
};

/**
 * Creates a professional user from form data.
 * Used by both free quick-register (directly) and Gold webhook (after payment).
 */
export async function createProfessionalUser(input: CreateProfessionalInput) {
  const email = input.email.toLowerCase().trim();

  const galleryUrls = (input.galleryUrls || []).filter((u) => typeof u === "string" && u.length > 0);
  if (galleryUrls.length < MIN_PROFESSIONAL_GALLERY_PHOTOS) {
    throw new InsufficientGalleryPhotosError(galleryUrls.length);
  }

  // Explicit email uniqueness check. Prevents orphan Gold payments where
  // the webhook would otherwise try to create a second user with the same
  // email and silently swallow the P2002.
  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingEmail) {
    throw new EmailInUseError(email);
  }

  // Generate unique username
  const baseSlug = slugify(input.displayName) || "user";
  let username = baseSlug;
  let usernameAttempts = 0;
  while (usernameAttempts < 10) {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) break;
    username = `${baseSlug}-${crypto.randomInt(1000, 9999)}`;
    usernameAttempts++;
  }

  // Resolve category
  let resolvedCategoryId: string | null = null;
  let resolvedCategoryName: string | null = null;
  if (input.primaryCategory) {
    const cat = await prisma.category.findFirst({
      where: {
        OR: [
          { slug: input.primaryCategory },
          { name: { equals: input.primaryCategory, mode: "insensitive" } },
          { displayName: { equals: input.primaryCategory, mode: "insensitive" } },
        ],
      },
      select: { id: true, displayName: true, name: true },
    });
    if (cat) {
      resolvedCategoryId = cat.id;
      resolvedCategoryName = cat.displayName || cat.name;
    } else {
      resolvedCategoryName = input.primaryCategory;
    }
  }

  // Build birthdate
  let safeBirthdate: Date | null = null;
  if (input.birthYear) {
    const month = input.birthMonth ? parseInt(input.birthMonth, 10) - 1 : 0;
    safeBirthdate = new Date(parseInt(input.birthYear, 10), month, 15);
  }

  const now = new Date();
  const isGold = input.tier === "GOLD";
  const shopTrialEndsAt = isGold ? null : addDays(now, config.freeTrialDays);
  const membershipExpiresAt = isGold ? addDays(now, 7) : null;

  const passwordSetToken = crypto.randomBytes(32).toString("hex");
  const passwordSetTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        username,
        phone: input.phone,
        profileType: "PROFESSIONAL",
        displayName: input.displayName,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        primaryCategory: input.primaryCategory,
        serviceCategory: resolvedCategoryName,
        categoryId: resolvedCategoryId,
        serviceDescription: input.serviceDescription,
        bio: input.bio || null,
        gender: (input.gender as any) || null,
        birthdate: safeBirthdate,
        profileTags: input.profileTags || [],
        serviceTags: input.serviceTags || [],
        baseRate: input.baseRate ?? null,
        minDurationMinutes: input.minDurationMinutes ?? null,
        acceptsIncalls: input.acceptsIncalls ?? null,
        acceptsOutcalls: input.acceptsOutcalls ?? null,
        termsAcceptedAt: now,
        shopTrialEndsAt,
        subscriptionPrice: 2500,
        tier: input.tier,
        membershipExpiresAt,
        isOnline: false,
        isActive: false,
        isVerified: false,
        role: "USER",
        passwordSetToken,
        passwordSetTokenExpiresAt,
      },
      select: { id: true, email: true, username: true, displayName: true },
    });
  } catch (err) {
    // Translate the race where another concurrent request inserted the
    // same email between our findUnique check and this create.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = Array.isArray((err.meta as any)?.target)
        ? ((err.meta as any).target as string[])
        : [];
      if (target.includes("email")) {
        throw new EmailInUseError(email);
      }
    }
    throw err;
  }

  // Create ProfileMedia from gallery URLs (validated above to be >= MIN)
  for (const url of galleryUrls) {
    try {
      await prisma.profileMedia.create({
        data: { ownerId: user.id, type: "IMAGE", url, isLocked: true },
      });
    } catch (err) {
      console.error("[createProfessional] gallery media failed", { userId: user.id, url, error: err });
    }
  }

  // Set first gallery photo as avatar so profile cards show an image
  if (galleryUrls.length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: galleryUrls[0] },
    });
  }

  // Send password-set email
  await sendSetPasswordEmail(email, passwordSetToken).catch((err) => {
    console.error("[createProfessional] password email failed", { email, error: err });
  });

  return { user, resolvedCategoryId, resolvedCategoryName, username };
}
