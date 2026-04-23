import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { Prisma, ProfileType } from "@prisma/client";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";
import { Genders, PreferenceGenders } from "@uzeed/shared";
import { createProfessionalForumThread } from "./registerHelpers";
import { redeemReferralCode } from "../referral/redeem";

export const googleAuthRouter = Router();

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPES = ["openid", "email", "profile"].join(" ");

function googleConfigured() {
  return Boolean(
    config.googleOAuth.clientId &&
      config.googleOAuth.clientSecret &&
      config.googleOAuth.redirectUri,
  );
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

function safePath(input: string | undefined): string {
  // Only allow same-origin paths. Reject absolute URLs, protocol-relative URLs,
  // and anything that isn't a single leading slash path.
  if (!input || typeof input !== "string") return "/";
  if (!input.startsWith("/")) return "/";
  if (input.startsWith("//")) return "/";
  return input;
}

function persistSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: unknown) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function buildFrontendRedirect(pathname: string, errorCode?: string) {
  const base = config.appUrl.replace(/\/$/, "");
  const safe = safePath(pathname);
  if (errorCode) {
    const sep = safe.includes("?") ? "&" : "?";
    return `${base}${safe}${sep}oauth_error=${encodeURIComponent(errorCode)}`;
  }
  return `${base}${safe}`;
}

googleAuthRouter.get(
  "/google/start",
  asyncHandler(async (req, res) => {
    if (!googleConfigured()) {
      return res.status(503).json({
        error: "GOOGLE_OAUTH_UNAVAILABLE",
        message: "El inicio de sesión con Google no está configurado.",
      });
    }

    const state = crypto.randomBytes(24).toString("base64url");
    const next = safePath((req.query.next as string) || "/");

    (req.session as any).googleOAuthState = state;
    (req.session as any).googleOAuthNext = next;
    await persistSession(req);

    const params = new URLSearchParams({
      client_id: config.googleOAuth.clientId,
      redirect_uri: config.googleOAuth.redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      state,
      access_type: "online",
      prompt: "select_account",
      include_granted_scopes: "true",
    });

    return res.redirect(`${GOOGLE_AUTHORIZE_URL}?${params.toString()}`);
  }),
);

googleAuthRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    if (!googleConfigured()) {
      return res.redirect(buildFrontendRedirect("/login", "google_unavailable"));
    }

    const { code, state, error: googleError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    const next = safePath((req.session as any).googleOAuthNext || "/");
    const expectedState = (req.session as any).googleOAuthState;

    // Clear one-shot OAuth state regardless of outcome.
    (req.session as any).googleOAuthState = undefined;
    (req.session as any).googleOAuthNext = undefined;

    if (googleError) {
      return res.redirect(buildFrontendRedirect("/login", googleError));
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(buildFrontendRedirect("/login", "invalid_state"));
    }

    // Exchange code for tokens
    let tokenPayload: any;
    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.googleOAuth.clientId,
          client_secret: config.googleOAuth.clientSecret,
          redirect_uri: config.googleOAuth.redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenRes.ok) {
        console.error("[auth/google] token exchange failed", {
          status: tokenRes.status,
        });
        return res.redirect(buildFrontendRedirect("/login", "token_exchange_failed"));
      }
      tokenPayload = await tokenRes.json();
    } catch (err) {
      console.error("[auth/google] token exchange threw", { error: err });
      return res.redirect(buildFrontendRedirect("/login", "token_exchange_failed"));
    }

    const accessToken = tokenPayload?.access_token as string | undefined;
    if (!accessToken) {
      return res.redirect(buildFrontendRedirect("/login", "no_access_token"));
    }

    // Fetch user info
    let userInfo: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      given_name?: string;
      picture?: string;
    };
    try {
      const uiRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!uiRes.ok) {
        console.error("[auth/google] userinfo failed", { status: uiRes.status });
        return res.redirect(buildFrontendRedirect("/login", "userinfo_failed"));
      }
      userInfo = await uiRes.json();
    } catch (err) {
      console.error("[auth/google] userinfo threw", { error: err });
      return res.redirect(buildFrontendRedirect("/login", "userinfo_failed"));
    }

    const rawEmail = userInfo.email?.trim();
    if (!rawEmail || userInfo.email_verified === false) {
      return res.redirect(buildFrontendRedirect("/login", "email_not_verified"));
    }
    const email = rawEmail.toLowerCase();

    // If the email already has an account, log in as that user (preserving
    // whatever profileType they registered with). If the email is new, stash
    // the Google identity in the session and send them to the account-type
    // chooser — we no longer silently create new accounts as CLIENT, because
    // professionals/establishments/shops were ending up miscategorised.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (!user) {
      const displayName =
        userInfo.name?.trim() || userInfo.given_name?.trim() || "Usuario";
      req.session.pendingGoogleSignup = {
        email,
        displayName,
        avatarUrl: userInfo.picture || null,
        next,
      };
      await persistSession(req);
      return res.redirect(buildFrontendRedirect("/register/tipo-cuenta"));
    }

    // Existing user — just mark them online.
    await prisma.user
      .update({
        where: { id: user.id },
        data: { isOnline: true, lastSeen: new Date() },
      })
      .catch(() => undefined);

    // Regenerate session to prevent session fixation, then attach userId.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    req.session.userId = user.id;
    req.session.role = user.role as "USER" | "ADMIN";
    await persistSession(req);

    return res.redirect(buildFrontendRedirect(next));
  }),
);

const ALLOWED_SIGNUP_TYPES: ProfileType[] = ["CLIENT", "PROFESSIONAL"];

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const phoneRegex =
  /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/;

const professionalCompleteSchema = z.object({
  profileType: z.literal("PROFESSIONAL"),
  displayName: z.string().min(2).max(50),
  phone: z
    .string()
    .regex(phoneRegex, "Ingresa un número válido con código de país (+56, +57, +58 o +51)."),
  gender: Genders,
  preferenceGender: PreferenceGenders.optional(),
  birthdate: z.string().min(1, "required"),
  primaryCategory: z.string().min(1, "required").max(120),
  address: z.string().min(6, "required").max(200),
  city: z.string().max(120).optional(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  bio: z.string().max(1000).optional(),
  referralCode: z.string().max(20).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Terms must be accepted" }),
  }),
});

googleAuthRouter.get(
  "/google/pending",
  asyncHandler(async (req, res) => {
    const pending = req.session.pendingGoogleSignup;
    if (!pending) {
      return res.status(404).json({ error: "NO_PENDING_SIGNUP" });
    }
    return res.json({
      email: pending.email,
      displayName: pending.displayName,
      avatarUrl: pending.avatarUrl,
    });
  }),
);

googleAuthRouter.post(
  "/google/cancel",
  asyncHandler(async (req, res) => {
    req.session.pendingGoogleSignup = undefined;
    await persistSession(req);
    return res.json({ ok: true });
  }),
);

async function pickUniqueUsername(baseDisplayName: string) {
  const baseSlug = slugify(baseDisplayName) || "user";
  let username = baseSlug;
  let attempts = 0;
  while (attempts < 10) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) break;
    username = `${baseSlug}-${crypto.randomInt(1000, 9999)}`;
    attempts++;
  }
  return username;
}

async function finalizeGoogleSession(
  req: any,
  user: { id: string; role: string },
): Promise<void> {
  req.session.pendingGoogleSignup = undefined;
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err: unknown) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;
  req.session.role = user.role as "USER" | "ADMIN";
  await persistSession(req);
}

googleAuthRouter.post(
  "/google/complete",
  asyncHandler(async (req, res) => {
    const pending = req.session.pendingGoogleSignup;
    if (!pending) {
      return res.status(400).json({
        error: "NO_PENDING_SIGNUP",
        message: "La sesión de Google expiró. Inicia sesión con Google de nuevo.",
      });
    }

    const rawType = String(req.body?.profileType || "").toUpperCase();
    if (!ALLOWED_SIGNUP_TYPES.includes(rawType as ProfileType)) {
      return res.status(400).json({
        error: "PROFILE_TYPE_INVALID",
        message: "Tipo de cuenta inválido.",
      });
    }
    const profileType = rawType as ProfileType;

    // Race with another tab that created the account already — log in instead.
    const existing = await prisma.user.findUnique({
      where: { email: pending.email },
      select: { id: true, role: true },
    });
    if (existing) {
      await finalizeGoogleSession(req, existing);
      return res.json({ redirect: safePath(pending.next) });
    }

    // ─── CLIENT: instant, minimal account ───
    if (profileType === "CLIENT") {
      const username = await pickUniqueUsername(pending.displayName);
      let user;
      try {
        user = await prisma.user.create({
          data: {
            email: pending.email,
            username,
            displayName: pending.displayName,
            profileType: "CLIENT",
            role: "USER",
            isVerified: true,
            isOnline: true,
            lastSeen: new Date(),
            termsAcceptedAt: new Date(),
            avatarUrl: pending.avatarUrl,
          },
          select: { id: true, role: true },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const recovered = await prisma.user.findUnique({
            where: { email: pending.email },
            select: { id: true, role: true },
          });
          if (recovered) {
            await finalizeGoogleSession(req, recovered);
            return res.json({ redirect: safePath(pending.next) });
          }
        }
        console.error("[auth/google] client create failed", {
          email: pending.email,
          error: err,
        });
        return res.status(500).json({
          error: "CREATE_FAILED",
          message: "No pudimos crear la cuenta. Intenta de nuevo.",
        });
      }

      await finalizeGoogleSession(req, user);
      return res.json({ redirect: safePath(pending.next) });
    }

    // ─── PROFESSIONAL: validate full form payload ───
    const parsed = professionalCompleteSchema.safeParse({
      ...req.body,
      profileType: "PROFESSIONAL",
    });
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    // Age check (same rules as /auth/register)
    const parsedBirthdate = new Date(data.birthdate);
    if (Number.isNaN(parsedBirthdate.getTime())) {
      return res.status(400).json({
        error: "BIRTHDATE_INVALID",
        message: "La fecha de nacimiento no es válida.",
      });
    }
    const now = new Date();
    let age = now.getFullYear() - parsedBirthdate.getFullYear();
    const monthDiff = now.getMonth() - parsedBirthdate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < parsedBirthdate.getDate())
    ) {
      age -= 1;
    }
    if (age < 18) {
      return res.status(400).json({
        error: "BIRTHDATE_UNDERAGE",
        message: "Debes ser mayor de 18 años.",
      });
    }

    // Resolve category (forum + service)
    let resolvedCategoryId: string | null = null;
    let resolvedCategoryName: string | null = null;
    if (data.primaryCategory) {
      const cat = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: data.primaryCategory },
            { name: { equals: data.primaryCategory, mode: "insensitive" } },
            {
              displayName: {
                equals: data.primaryCategory,
                mode: "insensitive",
              },
            },
          ],
        },
        select: { id: true, displayName: true, name: true },
      });
      if (cat) {
        resolvedCategoryId = cat.id;
        resolvedCategoryName = cat.displayName || cat.name;
      } else {
        resolvedCategoryName = data.primaryCategory;
      }
    }

    const username = await pickUniqueUsername(data.displayName);
    const shopTrialEndsAt = addDays(new Date(), config.freeTrialDays);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: pending.email,
          username,
          phone: data.phone,
          gender: data.gender,
          preferenceGender: data.preferenceGender || null,
          profileType: "PROFESSIONAL",
          address: data.address,
          city: data.city || null,
          primaryCategory: data.primaryCategory,
          serviceCategory: resolvedCategoryName,
          categoryId: resolvedCategoryId,
          latitude: data.latitude,
          longitude: data.longitude,
          displayName: data.displayName,
          bio: data.bio || null,
          birthdate: parsedBirthdate,
          termsAcceptedAt: new Date(),
          shopTrialEndsAt,
          subscriptionPrice: 2500,
          isOnline: true,
          lastSeen: new Date(),
          role: "USER",
          isVerified: false,
          avatarUrl: pending.avatarUrl,
        },
        select: {
          id: true,
          username: true,
          role: true,
          displayName: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = Array.isArray((err.meta as any)?.target)
          ? ((err.meta as any).target as string[])
          : [];
        if (target.includes("email")) {
          const recovered = await prisma.user.findUnique({
            where: { email: pending.email },
            select: { id: true, role: true },
          });
          if (recovered) {
            await finalizeGoogleSession(req, recovered);
            return res.json({ redirect: "/cuenta" });
          }
        }
        if (target.includes("username")) {
          return res.status(409).json({
            error: "USERNAME_IN_USE",
            message: "Nombre de usuario no disponible. Intenta de nuevo.",
          });
        }
      }
      console.error("[auth/google] professional create failed", {
        email: pending.email,
        error: err,
      });
      return res.status(500).json({
        error: "CREATE_FAILED",
        message: "No pudimos crear la cuenta. Intenta de nuevo.",
      });
    }

    await createProfessionalForumThread({
      userId: user.id,
      username: user.username,
      displayName: user.displayName || null,
      primaryCategory: data.primaryCategory,
    }).catch((error) => {
      console.error("[auth/google] failed to create forum thread", {
        userId: user.id,
        error,
      });
    });

    await emitAdminEvent({
      type: "profile_verification_requested",
      user: user.username || null,
    }).catch(() => {});

    if (data.referralCode) {
      try {
        await redeemReferralCode(data.referralCode.toUpperCase(), user.id);
      } catch (err) {
        console.error("[auth/google] referral redemption failed", {
          userId: user.id,
          referralCode: data.referralCode,
          error: err,
        });
      }
    }

    await finalizeGoogleSession(req, user);
    return res.json({ redirect: "/cuenta" });
  }),
);
