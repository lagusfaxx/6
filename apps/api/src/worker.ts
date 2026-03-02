import "dotenv/config";
import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiryEmail, smtpEnabled } from "./worker/email";

async function tick() {
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Users expiring within ~3 days (between 2.5 and 3.5 days) to avoid spamming daily.
  if (smtpEnabled()) {
    const soon = await prisma.user.findMany({
      where: {
        membershipExpiresAt: { gte: new Date(in3.getTime() - 12*60*60*1000), lte: new Date(in3.getTime() + 12*60*60*1000) }
      }
    });
    for (const u of soon) {
      await sendExpiryEmail(u.email, u.membershipExpiresAt!);
    }
  }
}

async function main() {
  console.log("[worker] started");
  // run daily at 03:10 UTC
  cron.schedule("10 3 * * *", () => {
    tick().catch((e) => console.error("[worker] tick error", e));
  });
  // run once on startup
  tick().catch((e) => console.error("[worker] initial tick error", e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
