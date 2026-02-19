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
  res.status(status).json({ ok: false, error: message });
}
