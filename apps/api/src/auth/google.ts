import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";

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

    // Find or create the user. Google already verified the email, so we skip
    // the 6-digit code flow. New accounts are always created as CLIENT via
    // Google — professionals/establishments/shops use the multi-step form.
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      const displayName =
        userInfo.name?.trim() || userInfo.given_name?.trim() || "Cliente";
      const baseSlug = slugify(displayName) || "user";
      let username = baseSlug;
      let attempts = 0;
      while (attempts < 10) {
        const taken = await prisma.user.findUnique({ where: { username } });
        if (!taken) break;
        username = `${baseSlug}-${crypto.randomInt(1000, 9999)}`;
        attempts++;
      }

      try {
        user = await prisma.user.create({
          data: {
            email,
            username,
            displayName,
            profileType: "CLIENT",
            role: "USER",
            isVerified: true,
            isOnline: true,
            lastSeen: new Date(),
            termsAcceptedAt: new Date(),
            avatarUrl: userInfo.picture || null,
          },
          select: { id: true, role: true },
        });
      } catch (err) {
        // Race: another concurrent Google callback just created the user.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true },
          });
        } else {
          console.error("[auth/google] user create failed", { email, error: err });
          return res.redirect(buildFrontendRedirect("/login", "create_failed"));
        }
      }

      if (!user) {
        return res.redirect(buildFrontendRedirect("/login", "create_failed"));
      }
    } else {
      // Existing user — just mark them online.
      await prisma.user
        .update({
          where: { id: user.id },
          data: { isOnline: true, lastSeen: new Date() },
        })
        .catch(() => undefined);
    }

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
