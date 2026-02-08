import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"]
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
});
