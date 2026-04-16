import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./http";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = err as any;
  const status = e instanceof HttpError ? e.status : (typeof e.status === "number" ? e.status : 500);
  const message = e instanceof Error ? e.message : "Unknown error";
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  // In production, never expose internal error details to clients
  const safeMessage = status >= 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : message;
  res.status(status).json({ ok: false, error: safeMessage });
}
