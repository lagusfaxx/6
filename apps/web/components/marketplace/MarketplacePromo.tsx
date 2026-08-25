"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag, X } from "lucide-react";

import useMe from "../../hooks/useMe";

/**
 * Aviso de que el marketplace existe.
 *
 * En el teléfono la sección queda fuera de la barra inferior, así que sin esto
 * casi nadie la encuentra. Es una franja de una línea, no un cartel: se cierra
 * con la equis y no vuelve a aparecer por dos semanas, para que quien ya la vio
 * no la tenga encima en cada pantalla.
 */

const STORAGE_KEY = "uzeed:marketplacePromo";
const SNOOZE_DAYS = 14;

export default function MarketplacePromo() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setVisible(true);
        return;
      }
      const dismissedAt = new Date(raw).getTime();
      const expired = Date.now() - dismissedAt > SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      setVisible(expired);
    } catch {
      // Sin localStorage (modo privado, almacenamiento bloqueado) se muestra igual.
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Si no se puede guardar, volverá a aparecer: molesta menos que fallar.
    }
  };

  // Dentro del propio marketplace sobra, y en el mapa a pantalla completa estorba.
  if (!visible || pathname.startsWith("/marketplace") || pathname === "/cerca") return null;

  const profileType = String(me?.user?.profileType || "").toUpperCase();
  const isSeller = profileType === "PROFESSIONAL" || profileType === "CREATOR";

  // En el teléfono no cabe la frase larga: se corta y se pierde el mensaje.
  const copy = isSeller
    ? {
        href: "/marketplace/vender",
        short: "Vende tus fotos y videos",
        long: "Vende tus fotos, videos y ropa dentro de UZEED",
        cta: "Abrir mi tienda",
      }
    : {
        href: "/marketplace",
        short: "La tienda de las profesionales",
        long: "Packs, videos y artículos que venden las profesionales",
        cta: "Ver marketplace",
      };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.08] px-3 py-2.5">
      <ShoppingBag className="h-4 w-4 shrink-0 text-fuchsia-300" />

      <Link href={copy.href} className="group flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 rounded bg-fuchsia-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200">
          Nuevo
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-white/75 sm:text-sm">
          <span className="sm:hidden">{copy.short}</span>
          <span className="hidden sm:inline">{copy.long}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-fuchsia-200 group-hover:text-fuchsia-100 sm:flex">
          {copy.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-200 sm:hidden" />
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar aviso del marketplace"
        className="shrink-0 rounded p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
