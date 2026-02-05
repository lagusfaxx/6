import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import type { Express } from "express";
import { env } from "./env";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function configureSession(app: Express) {
  const PgSession = connectPgSimple(session);
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  app.use(
    session({
      name: env.SESSION_COOKIE_NAME,
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true
      }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
        maxAge: 1000 * 60 * 60 * 24 * 30
      }
    })
  );
}
