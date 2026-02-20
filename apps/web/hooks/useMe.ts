"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

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
};

export default function useMe() {
  const [me, setMe] = useState<{ user: MeUser } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiFetch<{ user: MeUser }>("/auth/me")
      .then((r) => {
        if (!alive) return;
        setMe(r);
      })
      .catch((err: any) => {
        if (!alive) return;
        // Only clear session on real auth errors (401/403).
        // Transient errors (429, 5xx, network) must NOT reset `me` so the
        // app doesn't wrongly show the logged-out state.
        const status = err?.status;
        if (status === 401 || status === 403) {
          setMe(null);
        }
        // For any other error keep the previous value (null on first load is fine).
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { me, loading };
}
