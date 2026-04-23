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
  }
}
