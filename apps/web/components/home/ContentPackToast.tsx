"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useDiscreet } from "../DiscreetProvider";

/*
 * Anuncio del inicio que lleva a /contenido sin pasar por el menú: una
 * tarjeta arriba a la derecha con las fotos de las creadoras rotando. No
 * finge un mensaje ("te escribió"): dice lo que es, contenido de creadoras
 * reales, y lleva a la sección.
 *
 * Para no molestar: sale una vez por visita, a los pocos segundos, nunca
 * encima del aviso de edad ni en modo discreto; se va sola si no la tocan y
 * "Ahora no" la apaga por 24 horas.
 */

type Creator = {
  id: string;
  displayName: string;
  age: number | null;
  photos: string[];
  shop: { productCount: number; minPriceClp: number | null } | null;
};

const AGE_KEY = "uzeed:ageVerified";
const SESSION_KEY = "uzeed:packToastShown";
const SNOOZE_KEY = "uzeed:packToastSnoozedUntil";
const APPEAR_MS = 6_000;
const VISIBLE_MS = 25_000;
const ROTATE_MS = 2_600;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/* La edad se mira al momento de mostrar: quien la confirma recién entrando
   igual lo ve en esta visita. */
function canShow(checkAge = true) {
  try {
    if (checkAge && !localStorage.getItem(AGE_KEY)) return false;
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return !(until && until > Date.now());
  } catch {
    return false;
  }
}

export default function ContentPackToast() {
  const { discreet } = useDiscreet();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (discreet || !canShow(false)) return;
    const controller = new AbortController();
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      apiFetch<{ creators: Creator[] }>("/directory/creators?limit=10&gender=FEMALE", { signal: controller.signal })
        .then((r) => {
          const list = (r?.creators ?? []).filter((c) => c.photos[0]);
          if (!list.length || !canShow()) return;
          setCreators(list);
          setOpen(true);
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            /* sin storage: sale igual, una vez */
          }
          hideTimer = window.setTimeout(() => setOpen(false), VISIBLE_MS);
        })
        .catch(() => {});
    }, APPEAR_MS);
    return () => {
      controller.abort();
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [discreet]);

  /* Rotación de fotos mientras está a la vista (se detiene con el mouse encima). */
  useEffect(() => {
    if (!open || hovered || creators.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % creators.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [open, hovered, creators.length]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* nada que recordar */
    }
  }

  if (!creators.length) return null;
  const current = creators[index];
  const minPrice = creators
    .map((c) => c.shop?.minPriceClp)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b)[0];

  return (
    <div
      role="complementary"
      aria-label="Contenido exclusivo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`fixed right-3 top-[76px] z-40 w-[calc(100vw-24px)] max-w-[360px] transition-all duration-500 ease-out md:right-6 md:top-[92px] ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] bg-[#14101f]/90 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <Link href="/contenido" onClick={() => setOpen(false)} className="flex gap-3 p-3 pr-9">
          {/* Fotos apiladas: se ve una y cambia con un fundido. */}
          <div className="relative h-[84px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-white/5">
            {creators.map((c, i) => (
              <img
                key={c.id}
                src={resolveMediaUrl(c.photos[0]) ?? undefined}
                alt={i === index ? c.displayName : ""}
                loading={i < 2 ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-300/80">Contenido exclusivo</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {current.displayName}
              {current.age != null && <span className="font-normal text-white/55">, {current.age}</span>}
            </p>
            <p className="line-clamp-2 text-xs text-white/60">
              {creators.length > 1
                ? `y ${creators.length - 1} más venden sus fotos y videos en UZEED`
                : "vende sus fotos y videos en UZEED"}
            </p>
            {/* Puntos de la rotación */}
            {creators.length > 1 && (
              <div className="mt-1.5 flex gap-1">
                {creators.slice(0, 8).map((c, i) => (
                  <span
                    key={c.id}
                    className={`h-1 rounded-full transition-all ${i === index ? "w-3 bg-fuchsia-300" : "w-1 bg-white/25"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </Link>

        <div className="flex gap-2 px-3 pb-3">
          <Link
            href="/contenido"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2 text-center text-xs font-bold text-white transition hover:brightness-110"
          >
            {minPrice ? `Ver contenido · desde $${minPrice.toLocaleString("es-CL")}` : "Ver contenido"}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
