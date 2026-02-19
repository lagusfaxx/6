"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";
import { HeaderCategory, useCategoryFilter } from "../hooks/useCategoryFilter";

const HEADER_CATEGORIES: Array<{ key: HeaderCategory; label: string }> = [
  { key: "moteles", label: "Moteles" },
  { key: "sex-shop", label: "Sex Shop" },
  { key: "escorts", label: "Escorts" },
  { key: "masajes", label: "Masajes" },
  { key: "trans", label: "Trans" },
  { key: "maduras", label: "Maduras" },
];

export default function TopHeader() {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const profileType = String(me?.user?.profileType || "").toUpperCase();
  const canPublish = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(profileType);
  const publishHref = !isAuthed
    ? "/register?type=business"
    : canPublish
      ? "/dashboard/services"
      : "/register?type=business";
  const router = useRouter();

  const { selectedCategory, setSelectedCategory } = useCategoryFilter();
  const [availableNow, setAvailableNow] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      apiFetch<{ total: number }>("/stats/available-now")
        .then((res) => {
          if (mounted) setAvailableNow(Number(res?.total || 0));
        })
        .catch(() => {
          if (mounted) setAvailableNow(0);
        });
    };

    load();
    const interval = setInterval(load, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCategoryClick = (category: HeaderCategory) => {
    setSelectedCategory(category);
    setMenuOpen(false);
    router.push("/services");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 md:left-[240px]">
      <div className="w-full border-b border-white/10 bg-[#090909f2] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl md:px-5">
        <div className="flex min-h-[56px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/brand/isotipo-new.png" alt="UZEED" className="h-10 w-10 object-contain md:h-11 md:w-11" />
              <span className="text-xl font-semibold tracking-tight text-white md:text-2xl">Uzeed</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white md:hidden"
            aria-label="Alternar menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {!isAuthed ? (
              <>
                <Link href="/login" className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10">Acceder</Link>
                <Link href="/register" className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10">Registro</Link>
              </>
            ) : (
              <Link href="/cuenta" className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10">Cuenta</Link>
            )}
            <Link href={publishHref} className="rounded-xl bg-[#ff4b4b] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Publicar</Link>
          </div>
        </div>

        <div className="mt-2 hidden items-center gap-2 overflow-x-auto pb-1 md:flex">
          <div className="mr-2 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <span>Disponibles ahora</span>
            <span className="rounded-full bg-[#ff4b4b] px-2 py-0.5 font-bold text-white">{availableNow}</span>
          </div>
          {HEADER_CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleCategoryClick(item.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
                selectedCategory === item.key
                  ? "border-[#ff4b4b] bg-[#ff4b4b] text-white"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {menuOpen ? (
          <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-[#111111] p-3 md:hidden">
            <div className="mb-2 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-sm text-white/80">
              <span>Disponibles ahora</span>
              <span className="rounded-full bg-[#ff4b4b] px-2 py-0.5 text-xs font-bold text-white">{availableNow}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {HEADER_CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleCategoryClick(item.key)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    selectedCategory === item.key
                      ? "border-[#ff4b4b] bg-[#ff4b4b] text-white"
                      : "border-white/15 bg-white/5 text-white/80"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {!isAuthed ? (
                <>
                  <Link href="/login" className="rounded-xl border border-white/15 px-2 py-2 text-center text-sm text-white/85">Acceder</Link>
                  <Link href="/register" className="rounded-xl border border-white/15 px-2 py-2 text-center text-sm text-white/85">Registro</Link>
                </>
              ) : (
                <Link href="/cuenta" className="col-span-2 rounded-xl border border-white/15 px-2 py-2 text-center text-sm text-white/85">Cuenta</Link>
              )}
              <Link href={publishHref} className="rounded-xl bg-[#ff4b4b] px-2 py-2 text-center text-sm font-semibold text-white">Publicar</Link>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
