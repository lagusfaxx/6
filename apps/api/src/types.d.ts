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
    /**
     * When an admin still needs to pass the TOTP challenge before being
     * granted access. `requireAdmin` blocks all admin routes until the
     * pending flag is cleared via `POST /auth/2fa/verify`.
     */
    twoFactorPending?: boolean;
    /**
     * Temporary base32 secret created via `POST /auth/2fa/setup`. Replaced
     * with a persisted column once the user confirms the first valid code.
     */
    pendingTwoFactorSecret?: string;
  }
}
