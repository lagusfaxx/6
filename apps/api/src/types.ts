export type SessionUser = {
  userId: string;
  role: "USER" | "ADMIN";
};

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}
