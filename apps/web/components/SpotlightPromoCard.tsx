"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { apiFetch } from "../lib/api";
import FlashBadge from "./FlashBadge";

/*
 * Tarjeta de /cuenta para la profesional: si está destacada ve su sello con
 * el contador; si no, ve cómo se vería el suyo y la invita a destacarse.
 * La idea es que al ver destacadas a otras (regalos del equipo) quiera el
 * suyo.
 */

type Catalog = {
  billingEnabled: boolean;
  products: Array<{ kind: string; code: string; priceClp: number; duration: number }>;
  me: { boosts: Array<{ code: string; startsAt: string; endsAt: string }> } | null;
};

function activeSpotlightEnd(c: Catalog): string | null {
  const now = Date.now();
  const mine = (c.me?.boosts ?? []).filter((b) => b.code === "SPOTLIGHT");
  if (!mine.some((b) => Date.parse(b.startsAt) <= now && Date.parse(b.endsAt) > now)) return null;
  return new Date(Math.max(...mine.map((b) => Date.parse(b.endsAt)))).toISOString();
}

export default function SpotlightPromoCard() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    apiFetch<Catalog>("/promo/catalog").then(setCatalog).catch(() => setCatalog(null));
  }, []);

  if (!catalog) return null;
  const endsAt = activeSpotlightEnd(catalog);
  const offer = catalog.products
    .filter((p) => p.kind === "BOOST" && p.code === "SPOTLIGHT")
    .sort((a, b) => a.priceClp - b.priceClp)[0];

  if (endsAt) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/[0.14] via-orange-500/[0.08] to-transparent p-5">
        <FlashBadge endsAt={endsAt} size="md" />
        <p className="mt-3 text-base font-bold text-white">Tu perfil está destacado</p>
        <p className="mt-1 text-sm text-white/60">
          Sales primero en las búsquedas y en “Destacadas” del inicio, con este sello en tu tarjeta. Aprovecha: sube
          una historia para que te vean aún más.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.10] via-orange-500/[0.05] to-transparent p-5">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
        <p className="text-base font-bold text-white">Destaca tu perfil</p>
      </div>
      <p className="mt-1.5 text-sm text-white/60">
        Las destacadas salen primero en las búsquedas y arriba del inicio, con este sello y su contador:
      </p>
      {/* Vista previa del sello (24 h de ejemplo). */}
      <FlashBadge endsAt={new Date(Date.now() + 23 * 3600_000 + 59 * 60_000).toISOString()} size="md" className="mt-3" />
      {catalog.billingEnabled && offer ? (
        <Link
          href="/planes"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 px-4 py-3 text-sm font-extrabold text-black transition hover:brightness-105"
        >
          <Zap className="h-4 w-4 fill-black" />
          Quiero destacarme · ${offer.priceClp.toLocaleString("es-CL")}
        </Link>
      ) : (
        <p className="mt-4 text-xs text-white/45">Muy pronto podrás activarlo desde aquí.</p>
      )}
    </div>
  );
}
