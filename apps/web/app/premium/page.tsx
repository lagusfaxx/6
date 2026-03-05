"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import Avatar from "../../components/Avatar";

type PremiumProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  profileViews: number;
  completedServices: number;
  serviceCategory?: string | null;
};

export default function PremiumPage() {
  const [profiles, setProfiles] = useState<PremiumProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPremiumProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        entityType: "professional",
        profileTags: "premium",
        sort: "featured",
        limit: "60",
      });
      const response = await apiFetch<{ results?: PremiumProfile[]; profiles?: PremiumProfile[] }>(`/directory/search?${params.toString()}`);
      const items = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response?.profiles)
          ? response.profiles
          : [];
      setProfiles(items);
    } catch {
      setError("No se pudo cargar la sección Premium.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPremiumProfiles();
  }, [loadPremiumProfiles]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-white">
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1e1630] via-[#171425] to-[#110f1b] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15">
            <Crown className="h-6 w-6 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Premium</h1>
            <p className="text-sm text-white/60">Perfiles profesionales exclusivos seleccionados por administración.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
          <p>{error}</p>
          <button onClick={loadPremiumProfiles} className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10 transition">
            Reintentar
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
          No hay perfiles premium publicados por el momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {profiles.map((profile) => (
            <Link
              key={profile.id}
              href={`/profesional/${profile.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] transition hover:-translate-y-0.5 hover:border-amber-400/40"
            >
              <div className="relative h-44 overflow-hidden bg-black/30">
                {profile.coverUrl ? (
                  <img
                    src={resolveMediaUrl(profile.coverUrl) || ""}
                    alt={profile.displayName || profile.username}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#2b233a] to-[#161423]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute left-3 top-3 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Premium
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Avatar src={profile.avatarUrl ?? undefined} alt={profile.displayName || profile.username} size={46} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{profile.displayName || profile.username}</p>
                    <p className="truncate text-xs text-white/55">@{profile.username}</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-white/65">
                  <p>{profile.city || "Chile"}</p>
                  {profile.serviceCategory ? <p>{profile.serviceCategory}</p> : null}
                  <p>{profile.completedServices} servicios completados</p>
                  <p>{profile.profileViews} visitas de perfil</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
