import argon2 from "argon2";
import { prisma } from "../db";
import { config } from "../config";

/**
 * Ensure an ADMIN user exists. Behavior:
 *   - If no admin exists at all → create one using ADMIN_EMAIL/ADMIN_PASSWORD.
 *   - If the configured admin user exists but is missing the ADMIN role → grant it.
 *   - We do NOT overwrite the password on every boot. Doing that means the
 *     admin password is whatever happens to be in the env at deploy time,
 *     which (a) defeats any UI password change and (b) silently rotates the
 *     credential whenever someone redeploys with a different env. If the
 *     operator really wants to reset, they can set ADMIN_RESET_PASSWORD=true
 *     for a single boot.
 *   - If 2FA is enabled on the admin account, we never touch the password
 *     even with ADMIN_RESET_PASSWORD — that signal must come from the user.
 */
export async function ensureAdminUser() {
  const email = config.adminEmail;
  const wantsReset = process.env.ADMIN_RESET_PASSWORD === "true";

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, totpEnabled: true, passwordHash: true },
  });

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (existing.role !== "ADMIN") updates.role = "ADMIN";

    // Only (re)set password when:
    //   - the account has no password at all (first boot from an SSO-only state), OR
    //   - operator explicitly opted in via ADMIN_RESET_PASSWORD AND 2FA is OFF.
    const shouldSetPassword =
      !existing.passwordHash || (wantsReset && !existing.totpEnabled);

    if (shouldSetPassword) {
      updates.passwordHash = await argon2.hash(config.adminPassword);
      console.warn(
        `[seedAdmin] admin password ${existing.passwordHash ? "reset" : "initialized"} from env`,
      );
    } else if (wantsReset && existing.totpEnabled) {
      console.warn(
        "[seedAdmin] ADMIN_RESET_PASSWORD ignored: target admin has 2FA enabled",
      );
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: updates });
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
      role: "ADMIN",
    },
  });
  console.warn("[seedAdmin] initial admin user created — please enable 2FA on first login");
}
