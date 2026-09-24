"use client";

/**
 * Favoritas de la cuenta, compartidas entre todas las tarjetas del inicio.
 *
 * Diamond, Gold, Novedades y el feed muestran la misma estrella: un solo
 * pedido a /favorites alimenta a todas, y marcar una en una sección la marca
 * en las demás.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { buildCurrentPathWithSearch, buildLoginHref } from "../lib/chat";
import useMe from "./useMe";

let ids = new Set<string>();
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function emit(next: Set<string>) {
  ids = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY = new Set<string>();

export default function useFavorites() {
  const router = useRouter();
  const { me } = useMe();
  const userId: string | null = me?.user?.id ?? null;
  const favorites = useSyncExternalStore(subscribe, () => ids, () => EMPTY);

  useEffect(() => {
    if (!userId) {
      loadedFor = null;
      if (ids.size) emit(new Set());
      return;
    }
    if (loadedFor === userId) return;
    loadedFor = userId;
    apiFetch<{ favorites: Array<{ professional?: { id: string } | null }> }>("/favorites")
      .then((res) =>
        emit(
          new Set(
            (res?.favorites ?? []).map((f) => f.professional?.id).filter(Boolean) as string[],
          ),
        ),
      )
      .catch(() => {
        loadedFor = null;
      });
  }, [userId]);

  const toggle = useCallback(
    (id: string) => {
      if (!userId) {
        router.push(buildLoginHref(buildCurrentPathWithSearch()));
        return;
      }
      const wasFav = ids.has(id);
      const flip = (on: boolean) => {
        const next = new Set(ids);
        if (on) next.add(id);
        else next.delete(id);
        emit(next);
      };
      flip(!wasFav);
      apiFetch(`/favorites/${id}`, { method: wasFav ? "DELETE" : "POST" }).catch(() =>
        flip(wasFav),
      );
    },
    [router, userId],
  );

  return { favorites, toggle };
}
