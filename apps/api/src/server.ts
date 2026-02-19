import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";

import { env, assertEnv } from "./lib/env";
import { configureSession } from "./lib/session";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { feedRouter } from "./routes/feed";
import { adminRouter } from "./routes/admin";
import { paymentsRouter } from "./routes/payments";
import { webhooksRouter } from "./routes/webhooks";

assertEnv();

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(morgan("combined"));
const allowedOrigins = env.WEB_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120
  })
);

configureSession(app);

// Webhooks need raw body for signature
app.use("/webhooks", express.raw({ type: "application/json" }));
app.use("/webhooks", webhooksRouter);

// Normal JSON for app
app.use(express.json({ limit: "2mb" }));

// Serve uploaded files (local provider)
// NOTE: The web app runs on a different origin (e.g. https://uzeed.cl) than the API (https://api.uzeed.cl).
// Some browsers (notably iOS Safari) can block <video>/<img> loading across origins when the API replies with
// "Cross-Origin-Resource-Policy: same-origin". We explicitly allow cross-origin for static uploads.
const uploadsPath = path.join(process.cwd(), env.UPLOADS_DIR);
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsPath)
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(authRouter);
app.use(meRouter);
app.use(feedRouter);
app.use(paymentsRouter);
app.use(adminRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

app.listen(env.PORT, () => {
  console.log(`UZEED API listening on :${env.PORT}`);
});
