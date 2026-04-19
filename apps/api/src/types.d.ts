import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: "USER" | "ADMIN";
    profileViewTracker?: Record<string, number>;
    // TEMPORARY — admin impersonation (remove along with the endpoints below
    // when the one-off content restore is done).
    impersonatedBy?: string;
    impersonatorRole?: "USER" | "ADMIN";
  }
}
