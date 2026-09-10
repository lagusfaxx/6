import { Router } from "express";
import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";

/**
 * Cuentas de equipo: altas y bajas del rol MODERATOR, que entra al panel y
 * trabaja casi todo (ver `MODERATOR_BLOCKED_PREFIXES` en auth/middleware).
 *
 * Todo este router queda detrás de requireAdmin y su prefijo está en la lista
 * negra del moderador, así que un moderador no puede ni listar el equipo ni,
 * mucho menos, crearse compañeros o ascenderse a sí mismo.
 */
export const adminTeamRouter = Router();

adminTeamRouter.use(requireAdmin);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 10;

function slugifyUsername(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

async function buildUniqueUsername(displayName: string): Promise<string> {
  const base = slugifyUsername(displayName) || "equipo";
  let username = base;
  for (let attempt = 0; attempt < 10; attempt++) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) return username;
    username = `${base}-${crypto.randomInt(1000, 9999)}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const teamSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  lastSeen: true,
  createdAt: true,
} as const;

/** Lista las cuentas con acceso al panel: administradores y equipo. */
adminTeamRouter.get(
  "/team",
  asyncHandler(async (_req, res) => {
    const members = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MODERATOR"] } },
      select: teamSelect,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return res.json({ members, ownerEmail: config.adminEmail });
  }),
);

/**
 * Crea una cuenta de equipo nueva. No pasa por la verificación de correo del
 * registro público: la cuenta la está creando el dueño del panel, que ya sabe
 * a quién se la entrega.
 */
adminTeamRouter.post(
  "/team",
  asyncHandler(async (req, res) => {
    const rawEmail = String(req.body?.email || "").trim().toLowerCase();
    const displayName = String(req.body?.displayName || "").trim();
    const password = String(req.body?.password || "");

    if (!EMAIL_REGEX.test(rawEmail)) {
      return res.status(400).json({
        error: "VALIDATION",
        message: "Correo inválido.",
      });
    }
    if (displayName.length < 2 || displayName.length > 60) {
      return res.status(400).json({
        error: "VALIDATION",
        message: "El nombre debe tener entre 2 y 60 caracteres.",
      });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: "VALIDATION",
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: rawEmail },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        error: "EMAIL_TAKEN",
        message: "Ya hay una cuenta con ese correo. Dale el rol desde la lista.",
      });
    }

    const member = await prisma.user.create({
      data: {
        email: rawEmail,
        username: await buildUniqueUsername(displayName),
        displayName,
        passwordHash: await argon2.hash(password),
        role: "MODERATOR",
        profileType: "VIEWER",
        isVerified: true,
      },
      select: teamSelect,
    });

    return res.status(201).json({ member });
  }),
);

/**
 * Da o quita el rol de equipo a una cuenta que ya existe.
 *
 * Las cuentas ADMIN son intocables desde acá: quitarle el rol a un
 * administrador (o al dueño del panel) es justo la jugada que convertiría un
 * error de clic en quedarse sin acceso, y ascender a alguien a ADMIN por esta
 * vía saltaría el punto entero de tener un rol reducido.
 */
adminTeamRouter.put(
  "/team/:id/role",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const nextRole = String(req.body?.role || "").toUpperCase();

    if (nextRole !== "MODERATOR" && nextRole !== "USER") {
      return res.status(400).json({
        error: "VALIDATION",
        message: "El rol sólo puede ser MODERATOR o USER.",
      });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!target) return res.status(404).json({ error: "NOT_FOUND" });

    if (target.role === "ADMIN" || target.email === config.adminEmail) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Las cuentas de administrador no se editan desde aquí.",
      });
    }
    if (target.id === req.session.userId) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "No puedes cambiar tu propio rol.",
      });
    }

    const member = await prisma.user.update({
      where: { id },
      data: { role: nextRole as "MODERATOR" | "USER" },
      select: teamSelect,
    });

    return res.json({ member });
  }),
);
