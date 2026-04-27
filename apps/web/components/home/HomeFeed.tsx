"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { Sparkles, ShieldCheck, Hand, Building2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import NovedadesCarousel, {
  type NovedadProfile,
} from "./NovedadesCarousel";
import CollapsibleSection, {
  type CollapsibleProfile,
} from "./CollapsibleSection";
import DestacadasGrid, { type DestacadaProfile } from "./DestacadasGrid";
import InfiniteFeed from "./InfiniteFeed";

type AnyProfile = {
  id: string;
  displayName?: string | null;
  name?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  availableNow?: boolean;
  profileTags?: string[];
  serviceTags?: string[];
  userLevel?: string | null;
};

type Props = {
  newProfiles: AnyProfile[];
  availableProfiles: AnyProfile[];
  examProfiles: AnyProfile[];
  centroProfiles: AnyProfile[];
  destacadasProfiles: AnyProfile[];
};

const CENTRO_HINT = "centro";

function name(p: AnyProfile): string {
  return p.displayName || p.name || "Perfil";
}

function toNovedad(p: AnyProfile): NovedadProfile {
  return {
    id: p.id,
    displayName: name(p),
    city: p.city ?? null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    availableNow: !!p.availableNow,
  };
}

function toCollapsible(p: AnyProfile): CollapsibleProfile {
  return {
    id: p.id,
    displayName: name(p),
    city: p.city ?? null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
  };
}

function toDestacada(p: AnyProfile): DestacadaProfile {
  return {
    id: p.id,
    displayName: name(p),
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    availableNow: !!p.availableNow,
  };
}

export default function HomeFeed({
  newProfiles,
  availableProfiles,
  examProfiles,
  centroProfiles,
  destacadasProfiles,
}: Props) {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;

  const [masajistas, setMasajistas] = useState<AnyProfile[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      entityType: "professional",
      categorySlug: "masajes",
      sort: "featured",
      limit: "12",
      gender: "FEMALE",
    });
    if (effectiveLoc) {
      params.set("lat", String(effectiveLoc[0]));
      params.set("lng", String(effectiveLoc[1]));
      params.set("radiusKm", "100");
    }
    apiFetch<{ results: AnyProfile[] }>(
      `/directory/search?${params.toString()}`,
      { signal: controller.signal },
    )
      .then((res) => setMasajistas(res?.results ?? []))
      .catch(() => {
        /* silenciado: la sección simplemente no se mostrará si falla */
      });
    return () => controller.abort();
  }, [effectiveLoc?.[0], effectiveLoc?.[1]]);

  const novedades = useMemo(
    () => newProfiles.slice(0, 12).map(toNovedad),
    [newProfiles],
  );

  const disponibles = useMemo(
    () => availableProfiles.slice(0, 24).map(toCollapsible),
    [availableProfiles],
  );

  const examenes = useMemo(
    () => examProfiles.slice(0, 24).map(toCollapsible),
    [examProfiles],
  );

  const masajistasCollapsible = useMemo(
    () => masajistas.slice(0, 24).map(toCollapsible),
    [masajistas],
  );

  const centro = useMemo(() => {
    const fromProps = centroProfiles
      .filter((p) =>
        (p.city || "").toLowerCase().includes(CENTRO_HINT),
      )
      .map(toCollapsible);
    return fromProps.slice(0, 24);
  }, [centroProfiles]);

  const destacadas = useMemo(
    () => destacadasProfiles.slice(0, 6).map(toDestacada),
    [destacadasProfiles],
  );

  return (
    <>
      {novedades.length > 0 && (
        <NovedadesCarousel
          profiles={novedades}
          ctaHref="/escorts?sort=new"
          ctaLabel="Descubre todas las novedades"
        />
      )}

      <div className="mb-8">
        {disponibles.length > 0 && (
          <CollapsibleSection
            title="Disponibles ahora"
            count={disponibles.length}
            icon={<Sparkles className="h-5 w-5" />}
            tone="fuchsia"
            alwaysOpen
            profiles={disponibles}
          />
        )}

        {examenes.length > 0 && (
          <CollapsibleSection
            title="Escorts con exámenes"
            count={examenes.length}
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="sky"
            profiles={examenes}
            ctaHref="/escorts?profileTags=profesional+con+examenes"
            ctaLabel="Ver todas con exámenes"
          />
        )}

        {masajistasCollapsible.length > 0 && (
          <CollapsibleSection
            title="Masajistas"
            count={masajistasCollapsible.length}
            icon={<Hand className="h-5 w-5" />}
            tone="violet"
            profiles={masajistasCollapsible}
            ctaHref="/masajistas"
            ctaLabel="Ver todas las masajistas"
          />
        )}

        {centro.length > 0 && (
          <CollapsibleSection
            title="Santiago Centro"
            count={centro.length}
            icon={<Building2 className="h-5 w-5" />}
            tone="emerald"
            profiles={centro}
            ctaHref="/escorts?q=Santiago+Centro"
            ctaLabel="Ver Santiago Centro"
          />
        )}
      </div>

      {destacadas.length > 0 && <DestacadasGrid profiles={destacadas} />}

      <InfiniteFeed categorySlug="escort,masajes" />
    </>
  );
}
