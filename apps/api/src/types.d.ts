import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: "USER" | "ADMIN";
    profileViewTracker?: Record<string, number>;
    pendingGoogleSignup?: {
      email: string;
      displayName: string;
      avatarUrl: string | null;
      next: string;
    };
    // ── Two-factor authentication (TOTP) ──
    // When a user with 2FA enabled logs in, we set userId+pendingTotp first.
    // Until /auth/2fa/login-verify succeeds we treat the session as
    // half-authenticated: requireAuth blocks anything except /auth/2fa/*
    // and /auth/logout. Once verified we clear pendingTotp and set
    // totpVerifiedAt.
    pendingTotp?: boolean;
    totpVerifiedAt?: number; // ms epoch — used by requireRecentTotp step-up
  }
}
