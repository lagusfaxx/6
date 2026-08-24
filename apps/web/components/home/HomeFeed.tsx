"use client";

/**
 * Cuerpo del home.
 *
 * Antes eran seis bloques apilados (carrusel de novedades + cuatro secciones
 * plegables + grilla de destacadas) antes de llegar al feed real. Cada uno era
 * un riel horizontal distinto sobre el mismo conjunto de perfiles.
 *
 * La evidencia de usabilidad va en contra de eso: en móvil la gente hace
 * scroll, no swipe, y de un carrusel prácticamente solo se ve la primera
 * lámina. Un grid vertical denso de fotos es lo que se escanea bien.
 *
 * Así que el cuerpo queda en tres piezas: una barra de filtros con lo que
 * decide la compra en este rubro (disponibilidad, novedad, exámenes, formato),
 * las destacadas, y el grid infinito. Las secciones que se quitaron no
 * desaparecen como función: cada una es ahora un filtro que lleva al listado
 * completo, con más opciones de las que tenía la sección plegable.
 */

import Link from "next/link";
import { Clock, ShieldCheck, ShoppingBag, Sparkles, Star } from "lucide-react";
import DestacadasGrid, { type DestacadaProfile } from "./DestacadasGrid";
import InfiniteFeed from "./InfiniteFeed";

type AnyProfile = {
  id: string;
  displayName?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
};

type Props = {
  destacadasProfiles: AnyProfile[];
};

/* Filtros por estado del perfil, no por categoría: la categoría ya vive en el
   hero. Cada uno apunta a un listado que ya existe. */
const FEED_FILTERS = [
  { label: "Disponible ahora", href: "/escorts?availableNow=true", icon: Sparkles },
  { label: "Nuevas", href: "/escorts?sort=new", icon: Clock },
  { label: "Con exámenes", href: "/escorts?profileTags=profesional+con+examenes", icon: ShieldCheck },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "Premium", href: "/premium", icon: Star },
];

function toDestacada(p: AnyProfile): DestacadaProfile {
  return {
    id: p.id,
    displayName: p.displayName || p.name || "Perfil",
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    availableNow: !!p.availableNow,
  };
}

export default function HomeFeed({ destacadasProfiles }: Props) {
  const destacadas = destacadasProfiles.slice(0, 6).map(toDestacada);

  return (
    <>
      <nav
        aria-label="Filtros rápidos"
        className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {FEED_FILTERS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/65 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05] hover:text-white"
          >
            <f.icon className="h-3.5 w-3.5 text-white/40" aria-hidden />
            {f.label}
          </Link>
        ))}
      </nav>

      {destacadas.length > 0 && <DestacadasGrid profiles={destacadas} />}

      <InfiniteFeed categorySlug="escort,masajes" />
    </>
  );
}
