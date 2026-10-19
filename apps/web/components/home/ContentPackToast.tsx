"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { useDiscreet } from "../DiscreetProvider";

/*
 * Aviso del inicio que lleva a /contenido sin pasar por el menú. Parece una
 * notificación, pero no finge un mensaje: dice lo que es (un pack nuevo de
 * una creadora real, con su precio real) y lleva a comprarlo. Un "te
 * escribió" falso terminaría en un chat que nadie inició.
 *
 * Sale una vez por visita, después de unos segundos, nunca encima del aviso
 * de edad ni en modo discreto. Si la cierran, no vuelve por 24 horas.
 */

type Pack = {
  id: string;
  title: string;
  priceClp: number;
  createdAt: string;
  creator: { username: string; displayName: string; avatarUrl: string | null; age: number | null };
};

const AGE_KEY = "uzeed:ageVerified";
const SESSION_KEY = "uzeed:packToastShown";
const SNOOZE_KEY = "uzeed:packToastSnoozedUntil";
const APPEAR_MS = 12_000;
const VISIBLE_MS = 14_000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

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
  const [pack, setPack] = useState<Pack | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (discreet || !canShow(false)) return;
    const controller = new AbortController();
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      apiFetch<{ packs: Pack[] }>("/directory/creators/latest-packs", { signal: controller.signal })
        .then((r) => {
          const list = (r?.packs ?? []).filter((p) => p.creator.avatarUrl);
          if (!list.length || !canShow()) return;
          setPack(list[Math.floor(Math.random() * list.length)]);
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

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* nada que recordar */
    }
  }

  if (!pack) return null;
  const { creator } = pack;
  const href = `/marketplace/producto/${pack.id}`;

  return (
    <div
      role="status"
      aria-live="polite"
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

        <Link href={href} onClick={() => setOpen(false)} className="flex gap-3 p-3 pr-9">
          <img
            src={resolveMediaUrl(creator.avatarUrl) ?? undefined}
            alt={creator.displayName}
            className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-300/80">
              Nuevo pack · {timeAgo(pack.createdAt)}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {creator.displayName}
              {creator.age != null && <span className="font-normal text-white/55">, {creator.age}</span>}
            </p>
            <p className="truncate text-xs text-white/60">“{pack.title}”</p>
          </div>
        </Link>

        <div className="flex gap-2 px-3 pb-3">
          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="flex-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2 text-center text-xs font-bold text-white transition hover:brightness-110"
          >
            Ver pack · ${pack.priceClp.toLocaleString("es-CL")}
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
