import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const adminExportsRouter = Router();

adminExportsRouter.use(requireAdmin);

/**
 * RFC-4180 compatible CSV escaping. Cells containing commas, quotes or
 * newlines are wrapped in double quotes; embedded quotes are doubled.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  // ISO yyyy-mm-dd hh:mm — Excel-friendly
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Download the registered professionals as a CSV with phone numbers and
 * display names. Excel and Google Sheets both open this with double-click
 * (UTF-8 BOM ensures accents render correctly on Windows Excel).
 */
adminExportsRouter.get(
  "/exports/professionals.csv",
  asyncHandler(async (req, res) => {
    const profileTypeFilter = String(req.query.profileType || "PROFESSIONAL").toUpperCase();
    const allowed = new Set(["PROFESSIONAL", "ESTABLISHMENT", "SHOP", "ALL"]);
    if (!allowed.has(profileTypeFilter)) {
      return res.status(400).json({ error: "INVALID_PROFILE_TYPE" });
    }

    const where: any = {};
    if (profileTypeFilter === "ALL") {
      where.profileType = { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] };
    } else {
      where.profileType = profileTypeFilter;
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        phone: true,
        profileType: true,
        tier: true,
        city: true,
        primaryCategory: true,
        serviceCategory: true,
        isActive: true,
        isVerified: true,
        isOnline: true,
        lastSeen: true,
        completedServices: true,
        profileViews: true,
        membershipExpiresAt: true,
        createdAt: true,
      },
    });

    const headers = [
      "ID",
      "Username",
      "Nombre",
      "Telefono",
      "Email",
      "Tipo",
      "Tier",
      "Ciudad",
      "Categoria",
      "Activa",
      "Verificada",
      "Online",
      "Ultima conexion",
      "Servicios completados",
      "Vistas al perfil",
      "Membresia hasta",
      "Registro",
    ];

    const lines: string[] = [headers.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.username,
          row.displayName || "",
          row.phone || "",
          row.email,
          row.profileType,
          row.tier || "",
          row.city || "",
          row.primaryCategory || row.serviceCategory || "",
          row.isActive ? "si" : "no",
          row.isVerified ? "si" : "no",
          row.isOnline ? "si" : "no",
          formatDate(row.lastSeen),
          row.completedServices,
          row.profileViews,
          formatDate(row.membershipExpiresAt),
          formatDate(row.createdAt),
        ]
          .map(csvCell)
          .join(","),
      );
    }

    const today = new Date();
    const datestamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const filename = `profesionales-${datestamp}.csv`;
    const csv = "﻿" + lines.join("\r\n") + "\r\n";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(csv);
  }),
);
