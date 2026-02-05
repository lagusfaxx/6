"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { HeartHandshake, Sparkles, Store, Users, Building2 } from "lucide-react";

type Category = {
  id: string;
  name: string;
  kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
};

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string; // LEFT | RIGHT | INLINE
};

function kindLabel(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Profesionales";
  if (kind === "ESTABLISHMENT") return "Establecimientos";
  return "Sex Shop";
}

function kindHref(kind: Category["kind"], categoryId: string) {
  if (kind === "PROFESSIONAL") return `/profesionales?categoryId=${encodeURIComponent(categoryId)}`;
  if (kind === "ESTABLISHMENT") return `/establecimientos?categoryId=${encodeURIComponent(categoryId)}`;
  return `/sexshops?categoryId=${encodeURIComponent(categoryId)}`;
}

function kindIcon(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return Users;
  if (kind === "ESTABLISHMENT") return Building2;
  return Store;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiFetch<Category[]>("/categories");
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (e) {
        setError("No se pudieron cargar las categorías.");
      }
      try {
        const res = await apiFetch<{ banners: Banner[] }>("/banners");
        setBanners(res?.banners ?? []);
      } catch {
        // banners son opcionales
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const by = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    for (const c of categories) by[c.kind].push(c);
    // Mantener Home limpio: mostramos máximo 6 por sección + botón "Ver todas"
    return {
      PROFESSIONAL: by.PROFESSIONAL.slice(0, 6),
      ESTABLISHMENT: by.ESTABLISHMENT.slice(0, 6),
      SHOP: by.SHOP.slice(0, 6)
    };
  }, [categories]);

  const leftBanners = useMemo(() => banners.filter(b => (b.position || "").toUpperCase() === "LEFT"), [banners]);
  const rightBanners = useMemo(() => banners.filter(b => (b.position || "").toUpperCase() === "RIGHT"), [banners]);
  const inlineBanners = useMemo(() => banners.filter(b => (b.position || "").toUpperCase() === "INLINE"), [banners]);

  return (
    <div className="min-h-screen text-white antialiased">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-2xl font-semibold">Directorio de servicios</h1>
          <p className="mt-1 text-white/70">
            Elige una categoría para comenzar: podrás buscar, chatear y solicitar servicios desde ahí.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr_220px]">
          {/* Left banners */}
          <aside className="hidden lg:block">
            <div className="space-y-4">
              {leftBanners.length ? leftBanners.map((b) => (
                <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
                  <div className="p-3 text-sm text-white/80">{b.title}</div>
                </a>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Banners laterales (Admin).
                </div>
              )}
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-8">
            {/* inline banners (mobile/tablet) */}
            {inlineBanners.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                {inlineBanners.slice(0, 4).map((b) => (
                  <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
                    <div className="p-3 text-sm text-white/80">{b.title}</div>
                  </a>
                ))}
              </div>
            ) : null}

            {(["PROFESSIONAL","ESTABLISHMENT","SHOP"] as const).map((kind) => {
              const items = grouped[kind];
              const Icon = kindIcon(kind);
              return (
                <section key={kind}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{kindLabel(kind)}</h2>
                    <Link className="text-sm text-white/70 hover:text-white" href={kind === "PROFESSIONAL" ? "/profesionales" : kind === "ESTABLISHMENT" ? "/establecimientos" : "/sexshops"}>
                      Ver todas
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {items.length ? items.map((c) => (
                      <Link
                        key={c.id}
                        href={kindHref(c.kind, c.id)}
                        className="group flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/5 to-fuchsia-500/10 p-4 hover:from-white/10 hover:to-fuchsia-500/20 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <Icon className="h-5 w-5 text-white/80" />
                          </div>
                          <div>
                            <div className="text-base font-medium">{c.name}</div>
                            <div className="text-xs text-white/60">Toca para buscar disponibles</div>
                          </div>
                        </div>
                        <Sparkles className="h-5 w-5 text-white/40 group-hover:text-white/70 transition" />
                      </Link>
                    )) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
                        No hay categorías disponibles.
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </main>

          {/* Right banners */}
          <aside className="hidden lg:block">
            <div className="space-y-4">
              {rightBanners.length ? rightBanners.map((b) => (
                <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
                  <div className="p-3 text-sm text-white/80">{b.title}</div>
                </a>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Banners laterales (Admin).
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
