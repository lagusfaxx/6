import { Router } from "express";
import { verifyKhipuSignature, khipuGetPayment } from "../lib/khipu";
import { prisma } from "../lib/prisma";
import { markPaymentPaid } from "./payments";

export const webhooksRouter = Router();

// This router must be mounted with express.raw({type:'application/json'})
webhooksRouter.post("/khipu", async (req, res) => {
  const rawBody = req.body as Buffer;
  const ok = verifyKhipuSignature(rawBody, req.header("x-khipu-signature"));
  if (!ok) return res.status(400).json({ error: "INVALID_SIGNATURE" });

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "INVALID_JSON" });
  }

  const payment_id = payload.payment_id as string | undefined;
  if (!payment_id) return res.status(400).json({ error: "MISSING_PAYMENT_ID" });

  // Find local payment by providerPaymentId
  const local = await prisma.payment.findUnique({ where: { providerPaymentId: payment_id } });
  if (!local) return res.status(404).json({ error: "PAYMENT_NOT_FOUND" });

  // Idempotent: if already paid, acknowledge
  if (local.status === "PAID") return res.json({ ok: true, status: "ALREADY_PAID" });

  // Verify server-to-server
  const remote = await khipuGetPayment(payment_id);
  if (remote.status !== "done") {
    return res.json({ ok: true, status: "IGNORED_NOT_DONE" });
  }

  await markPaymentPaid(local.id);
  res.json({ ok: true });
});
