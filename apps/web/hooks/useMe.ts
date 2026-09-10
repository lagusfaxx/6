"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, cachedApiFetch } from "../lib/api";

export type ProfileCompletion = {
  complete: boolean;
  missing: { key: string; label: string; tab: string }[];
  /** Perfil que ya estaba publicado antes de la regla: se avisa, no se baja. */
  grandfathered: boolean;
};

type MeUser = {
  id: string;
  email?: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  profileType: string | null;
  role?: string | null;
  membershipExpiresAt?: string | null;
  gender?: string | null;
  preferenceGender?: string | null;
  address?: string | null;
  birthdate?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorPending?: boolean;
  isActive?: boolean;
  isVerified?: boolean;
  /* Lo calcula /auth/me para las profesionales: qué le falta a la ficha para
     poder publicarse. */
  profileCompletion?: ProfileCompletion;
};

export default function useMe() {
  const [me, setMe] = useState<{ user: MeUser } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await apiFetch<{ user: MeUser }>("/auth/me");
      setMe(r);
      return r;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    cachedApiFetch<{ user: MeUser }>("/auth/me")
      .then((r) => {
        if (!alive) return;
        setMe(r);
      })
      .catch(() => {
        if (!alive) return;
        setMe(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { me, loading, refresh };
}
