"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { Sparkles, Store, Users, Building2 } from "lucide-react";

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
  position: string;
};

function kindLabel(kind: Category["kind"]) {
  if (kind === "PROFESSIONAL") return "Profesionales";
  if (kind === "ESTABLISHMENT") return "Establecimientos";
  return "Tiendas";
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
      } catch {
        setError("No se pudieron cargar las categorías.");
      }
      try {
        const res = await apiFetch<{ banners: Banner[] }>("/banners");
        setBanners(res?.banners ?? []);
      } catch {
        // banners opcionales
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const by = { PROFESSIONAL: [] as Category[], ESTABLISHMENT: [] as Category[], SHOP: [] as Category[] };
    for (const c of categories) by[c.kind].push(c);
    return by;
  }, [categories]);

  const inlineBanners = useMemo(() => banners.filter(b => (b.position || "").toUpperCase() === "INLINE"), [banners]);

  return (
    <div className="min-h-screen text-white antialiased">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#5a56a9]/70 via-[#6e5cc0]/50 to-[#ef3f97]/40 p-5 md:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-white/80">Uzeed</div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold">¿Qué estás buscando?</h1>
          <p className="mt-2 text-sm text-white/80">
            Selecciona una categoría para buscar profesionales, moteles o tiendas. Diseño optimizado para teléfono y PC.
          </p>
        </section>

        {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}

        {inlineBanners.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {inlineBanners.slice(0, 4).map((b) => (
              <a key={b.id} href={b.linkUrl ?? "#"} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
                <div className="p-3 text-sm text-white/80">{b.title}</div>
              </a>
            ))}
          </div>
        ) : null}

        <main className="mt-6 space-y-8">
          {(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const).map((kind) => {
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

                <div className="grid gap-3">
                  {items.length ? items.map((c) => (
                    <Link
                      key={c.id}
                      href={kindHref(c.kind, c.id)}
                      className="group flex items-center justify-between rounded-2xl border border-fuchsia-300/30 bg-gradient-to-r from-[#2c3a8f]/90 to-[#ec3f97]/85 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:brightness-110 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/30 bg-white/15">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-base font-semibold">{c.name}</div>
                          <div className="text-xs text-white/80">Entrar a resultados</div>
                        </div>
                      </div>
                      <Sparkles className="h-5 w-5 text-white/80 group-hover:text-white transition" />
                    </Link>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">No hay categorías disponibles.</div>
                  )}
                </div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
