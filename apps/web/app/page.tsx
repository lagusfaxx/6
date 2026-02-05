"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, isAuthError } from "../lib/api";
import { Briefcase, HeartHandshake, Sparkles, Store, Users } from "lucide-react";

type Category = {
  id: string;
  name: string;
  kind: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
};

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Category[]>("/categories")
      .then((res) => setCategories(Array.isArray(res) ? res : (res as any)?.categories ?? []))
      .catch((err: any) => {
        // Sin sesión, /auth/me puede dar 401 y NO debe romper el Home.
        // Si por alguna razón /categories está protegido, mostramos un estado vacío en vez de error fatal.
        if (isAuthError(err)) {
          setCategories([]);
          setError(null);
          return;
        }
        setError(err?.message || "No se pudieron cargar las categorías.");
      })
.finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    return {
      professionals: categories.filter((c) => c.kind === "PROFESSIONAL"),
      establishments: categories.filter((c) => c.kind === "ESTABLISHMENT"),
      shops: categories.filter((c) => c.kind === "SHOP")
    };
  }, [categories]);

  const isEmpty = !grouped.professionals.length && !grouped.establishments.length && !grouped.shops.length;
  const professionalIcons = [Users, HeartHandshake, Sparkles, Briefcase];
  const establishmentIcons = [Store, Briefcase, Sparkles, Users];

  const iconForCategory = (kind: Category["kind"], index: number) => {
    const list = kind === "PROFESSIONAL" ? professionalIcons : kind === "ESTABLISHMENT" ? establishmentIcons : establishmentIcons;
    return list[index % list.length];
  };

  return (
    <div className="grid gap-8">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Directorio de servicios</h1>
        <p className="mt-2 text-sm text-white/70">
          Elige una categoría para comenzar: podrás buscar, chatear y solicitar servicios desde ahí.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6">
          <section className="grid gap-3">
            <div className="h-5 w-32 rounded-full bg-white/10" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                  <div className="h-9 w-9 rounded-xl bg-white/10" />
                  <div className="mt-4 h-4 w-24 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-32 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : error ? (
        <div className="card p-6 text-red-200 border-red-500/30 bg-red-500/10">{error}</div>
      ) : isEmpty ? (
        <div className="card p-6 text-white/70">No hay categorías disponibles.</div>
      ) : (
        <div className="grid gap-6">
          {grouped.professionals.length ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">Profesionales</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.professionals.map((cat, index) => {
                  const Icon = iconForCategory("PROFESSIONAL", index);
                  return (
                    <Link
                      key={cat.id}
                      href={`/profesionales?categoryId=${cat.id}`}
                      className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm font-medium transition hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 group-hover:text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-base font-semibold">{cat.name}</div>
                      <div className="mt-2 text-xs text-white/60">Buscar profesionales disponibles</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {grouped.establishments.length ? (
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">Establecimientos</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.establishments.map((cat, index) => {
                  const Icon = iconForCategory("ESTABLISHMENT", index);
                  return (
                    <Link
                      key={cat.id}
                      href={`/establecimientos?categoryId=${cat.id}`}
                      className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm font-medium transition hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 group-hover:text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-base font-semibold">{cat.name}</div>
                      <div className="mt-2 text-xs text-white/60">Explorar establecimientos cercanos</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Sex Shop</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/sexshops"
                className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm font-medium transition hover:border-white/30 hover:bg-white/10"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <Store className="h-5 w-5 text-white/80" />
                  </div>
                  <div className="grid gap-1">
                    <div className="font-semibold">Sex Shops</div>
                    <div className="text-xs text-white/60">Productos, stock y precios en tiempo real</div>
                  </div>
                </div>
              </Link>
            </div>
          </section>
</div>
      )}
    </div>
  );
}
