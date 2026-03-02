import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";

export const hotRouter = Router();

const RAPIDAPI_KEY = "3245e57012msh3537a150fb1bfe3p1b0a0bjsnf0e2dd3e4cb1";
const RAPIDAPI_HOST = "pornhub-api-xnxx.p.rapidapi.com";

hotRouter.get(
  "/hot/trending",
  asyncHandler(async (req, res) => {
    const page = req.query.page ? Math.max(1, Math.min(10, Number(req.query.page))) : 1;

    try {
      const response = await fetch(
        `https://${RAPIDAPI_HOST}/api/trending?page=${page}`,
        {
          method: "GET",
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
        },
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: "UPSTREAM_ERROR" });
      }

      const data = await response.json();
      return res.json(data);
    } catch {
      return res.status(502).json({ error: "UPSTREAM_UNAVAILABLE" });
    }
  }),
);
