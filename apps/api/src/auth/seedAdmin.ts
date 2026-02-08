import argon2 from "argon2";
import { prisma } from "../db";
import { config } from "../config";

export async function ensureAdminUser() {
  const email = config.adminEmail;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    }
    return;
  }

  const passwordHash = await argon2.hash(config.adminPassword);
  const usernameBase = "admin";
  let username = usernameBase;
  const usernameTaken = await prisma.user.findUnique({ where: { username: usernameBase } });
  if (usernameTaken) {
    username = `${usernameBase}_${Math.floor(Math.random() * 10000)}`;
  }
  await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      displayName: "Administrador",
      role: "ADMIN"
    }
  });
}
