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

  return { me, loading };
}
