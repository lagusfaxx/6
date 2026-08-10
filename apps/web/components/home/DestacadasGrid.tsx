"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { apiFetch } from "../../lib/api";
import DestacadaCard, {
  type DestacadaCardProfile,
  type FeaturedStoryMedia,
} from "./DestacadaCard";

export type DestacadaProfile = DestacadaCardProfile;

type Props = {
  profiles: DestacadaProfile[];
  title?: string;
  /**
   * Versión reducida para ir sobre el mapa: fila horizontal de tarjetas
   * chicas en vez de grilla. El objetivo de esa posición es que el mapa
   * quede a la vista al entrar, así que esta sección no puede ocupar alto.
   */
  compact?: boolean;
};

type FeaturedResponse = {
  byUser: Record<string, FeaturedStoryMedia[]>;
};

export default function DestacadasGrid({
  profiles,
  title = "Destacadas",
  compact = false,
}: Props) {
  const userIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const [byUser, setByUser] = useState<Record<string, FeaturedStoryMedia[]>>({});

  useEffect(() => {
    if (userIds.length === 0) {
      setByUser({});
      return;
    }
    const controller = new AbortController();
    apiFetch<FeaturedResponse>("/stories/home-featured", {
      method: "POST",
      body: JSON.stringify({ userIds }),
      signal: controller.signal,
    })
      .then((res) => {
        if (res && res.byUser) setByUser(res.byUser);
      })
      .catch(() => {
        // Silent: the grid keeps showing plain covers if anything goes wrong
      });
    return () => controller.abort();
  }, [userIds.join(",")]);

  if (!profiles.length) return null;

  if (compact) {
    return (
      <section className="mb-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {profiles.map((p) => (
            <div key={p.id} className="w-[104px] shrink-0 sm:w-[120px]">
              <DestacadaCard profile={p} stories={byUser[p.id] || []} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-400" />
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {profiles.map((p) => (
          <DestacadaCard
            key={p.id}
            profile={p}
            stories={byUser[p.id] || []}
          />
        ))}
      </div>
    </section>
  );
}
