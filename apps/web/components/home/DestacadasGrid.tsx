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
};

type FeaturedResponse = {
  byUser: Record<string, FeaturedStoryMedia[]>;
};

export default function DestacadasGrid({
  profiles,
  title = "Destacadas",
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
