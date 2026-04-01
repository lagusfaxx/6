import "dotenv/config";
import express from "express";
import compression from "compression";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import session from "express-session";
import pg from "pg";
import PgSession from "connect-pg-simple";
import path from "path";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import { config } from "./config";
import { authRouter } from "./auth/routes";
import { verificationRouter } from "./auth/verification";
import { ensureAdminUser } from "./auth/seedAdmin";
import { seedCategories } from "./client/seedCategories";
import { feedRouter } from "./feed/routes";
import { adminRouter } from "./admin/routes";
import { plansRouter } from "./khipu/plans";
import { profileRouter } from "./profile/routes";
import { servicesRouter } from "./services/routes";
import { directoryRouter } from "./directory/routes";
import { messagesRouter } from "./messages/routes";
import { creatorRouter } from "./creator/routes";
import { billingRouter } from "./billing/routes";
import { notificationsRouter } from "./notifications/routes";
import { realtimeRouter } from "./realtime/routes";
import { FlowError } from "./khipu/client";
import { statsRouter } from "./stats/routes";
import { clientRouter } from "./client/routes";
import { shopRouter } from "./shop/routes";
import { motelRouter } from "./motel/routes";
import { favoritesRouter } from "./favorites/routes";
import { storiesRouter } from "./stories/routes";
import { hotRouter } from "./hot/routes";
import { forumRouter } from "./forum/routes";
import { walletRouter } from "./routes/wallet";
import { videocallRouter } from "./routes/videocall";
import { livestreamRouter } from "./routes/livestream";
import { signalingRouter } from "./routes/signaling";
import { livekitRouter } from "./routes/livekit";
import { adminTokensRouter } from "./routes/adminTokens";
import { privacyRouter } from "./privacy/routes";
import { analyticsRouter } from "./analytics/routes";
import { umateRouter } from "./umate/routes";
import { prisma } from "./db";
import { requireAuth } from "./auth/middleware";
import { startWorker } from "./worker";

const app = express();
app.set("trust proxy", 1);

// gzip compression — reduce response size ~10x for JSON
app.use(compression());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const corsOrigins = Array.from(
  new Set([
    "https://uzeed.cl",
    "https://www.uzeed.cl",
    // Capacitor native app origins
    "capacitor://localhost",
    "http://localhost",
    ...config.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
  ])
);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS_NOT_ALLOWED"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(cookieParser());

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// JSON body parser
app.use((req, res, next) => {
  express.json({ limit: "2mb" })(req, res, next);
});

// Flow webhooks (and some third-party callbacks) arrive as application/x-www-form-urlencoded.
// Parse them globally so endpoints like /webhooks/flow/payment can read `token` and `s`.
app.use((req, res, next) => {
  express.urlencoded({ extended: true, limit: "2mb" })(req, res, next);
});

const pgPool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
const PgStore = PgSession(session);

app.use(
  session({
    name: "uzeed_session",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env !== "development",
      domain: config.cookieDomain,
      maxAge: 1000 * 60 * 60 * 24 * 30
    },
    store: new PgStore({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
      pruneSessionInterval: 900,   // limpiar sesiones expiradas cada 15 min
      disableTouch: true,          // no actualizar sesión en cada request (reduce writes)
    })
  })
);

// ── CSRF protection: validate Origin header on state-changing requests ──
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  // Skip for webhooks (server-to-server)
  if (req.path.startsWith("/webhooks/")) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // Same-origin requests (non-CORS) don't send Origin
  if (corsOrigins.includes(origin)) return next();
  return res.status(403).json({ error: "CSRF_REJECTED", message: "Origin not allowed" });
});

// ✅ Global auth allowlist (categories/auth/health/etc quedan públicos dentro del middleware)
app.use(requireAuth);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "DB_NOT_READY" });
  }
});
app.get("/version", (_req, res) => res.json({ sha: process.env.GIT_SHA || "unknown", env: config.env }));

// static uploads
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id");
    res.setHeader("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range, Content-Length");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  },
  express.static(path.resolve(config.storageDir), {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res, filePath) => {
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Prevent any uploaded file from being rendered as HTML
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'");
      // WebP files get longer cache since they're content-addressed by timestamp
      if (filePath.endsWith(".webp")) {
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      }
    },
  })
);

app.use("/auth", authRouter);
app.use("/auth/verification", verificationRouter);
app.use("/", clientRouter);
app.use("/shop", shopRouter);
app.use("/", feedRouter);
app.use("/admin", adminRouter);
app.use("/", adminTokensRouter);
app.use("/", plansRouter);
app.use("/", profileRouter);
app.use("/", directoryRouter);
app.use("/", servicesRouter);
app.use("/", motelRouter);
app.use("/", messagesRouter);
app.use("/", creatorRouter);
app.use("/", billingRouter);
app.use("/", notificationsRouter);
app.use("/", realtimeRouter);
app.use("/", statsRouter);
app.use("/", favoritesRouter);
app.use("/", storiesRouter);
app.use("/", hotRouter);
app.use("/", forumRouter);
app.use("/", walletRouter);
app.use("/", videocallRouter);
app.use("/", livestreamRouter);
app.use("/", signalingRouter);
app.use("/", livekitRouter);
app.use("/", privacyRouter);
app.use("/", analyticsRouter);
app.use("/", umateRouter);

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as any).requestId;
  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      route: req.originalUrl,
      message: err?.message || "Unknown error",
      code: err?.code
    })
  );

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2021" || err.code === "P2022") {
      return res.status(500).json({ error: "DB_SCHEMA_MISMATCH" });
    }
  }

  if (err instanceof FlowError) {
    return res.status(err.status).json({ error: "FLOW_ERROR", status: err.status, message: err.message, payload: err.payload });
  }

  if (err?.message === "CORS_NOT_ALLOWED") return res.status(403).json({ error: "CORS_NOT_ALLOWED" });

  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

process.on("unhandledRejection", (err) => console.error("[api] unhandledRejection", err));
process.on("uncaughtException", (err) => console.error("[api] uncaughtException", err));

async function boot() {
  await ensureAdminUser().catch((err) => console.error("[api] admin seed failed", err));
  await seedCategories().catch((err) => console.error("[api] category seed failed", err));

  app.listen(config.port, () => {
    console.log(`[api] listening on :${config.port}`);
    startWorker();
  });
}

boot().catch((err) => {
  console.error("[api] boot failed", err);
  process.exit(1);
});
