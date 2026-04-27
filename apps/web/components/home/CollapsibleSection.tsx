"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";

export type CollapsibleProfile = {
  id: string;
  displayName: string;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
};

type Tone = "fuchsia" | "violet" | "emerald" | "sky";

const TONE_CLASSES: Record<Tone, { bar: string; pill: string; ring: string }> = {
  fuchsia: {
    bar: "border-fuchsia-500/30 bg-fuchsia-500/[0.12]",
    pill: "text-fuchsia-300",
    ring: "ring-fuchsia-500/40",
  },
  violet: {
    bar: "border-violet-500/30 bg-violet-500/[0.10]",
    pill: "text-violet-300",
    ring: "ring-violet-500/40",
  },
  emerald: {
    bar: "border-emerald-500/30 bg-emerald-500/[0.10]",
    pill: "text-emerald-300",
    ring: "ring-emerald-500/40",
  },
  sky: {
    bar: "border-sky-500/30 bg-sky-500/[0.10]",
    pill: "text-sky-300",
    ring: "ring-sky-500/40",
  },
};

type Props = {
  title: string;
  count?: number;
  icon: ReactNode;
  tone?: Tone;
  defaultOpen?: boolean;
  profiles: CollapsibleProfile[];
  ctaHref: string;
  ctaLabel?: string;
};

function avatarSrc(p: CollapsibleProfile) {
  return (
    resolveMediaUrl(p.avatarUrl) ??
    resolveMediaUrl(p.coverUrl) ??
    "/brand/isotipo-new.png"
  );
}

export default function CollapsibleSection({
  title,
  count,
  icon,
  tone = "fuchsia",
  defaultOpen = false,
  profiles,
  ctaHref,
  ctaLabel = "Ver todas",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const t = TONE_CLASSES[tone];

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:brightness-110 ${t.bar}`}
      >
        <span className={`shrink-0 ${t.pill}`}>{icon}</span>
        <span className="flex-1 truncate text-base font-bold text-white">
          {title}
        </span>
        {typeof count === "number" && (
          <span
            className={`tabular-nums text-base font-bold ${t.pill}`}
            aria-hidden="true"
          >
            {count}
          </span>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-white/70 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0">
          {open && (
            <div className="px-1 pb-1 pt-4">
              {profiles.length > 0 ? (
                <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                  {profiles.map((p) => (
                    <Link
                      key={p.id}
                      href={`/profesional/${p.id}`}
                      className="group flex w-[88px] shrink-0 flex-col items-center text-center"
                    >
                      <div
                        className={`h-[80px] w-[80px] overflow-hidden rounded-full ring-2 ${t.ring} ring-offset-2 ring-offset-[#050510] transition group-hover:scale-105`}
                      >
                        <img
                          src={avatarSrc(p)}
                          alt={p.displayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/brand/isotipo-new.png";
                          }}
                        />
                      </div>
                      <div className="mt-2 w-full truncate text-[11px] font-bold uppercase tracking-wide text-white">
                        {p.displayName}
                      </div>
                      {p.city && (
                        <div
                          className={`w-full truncate text-[10px] font-medium ${t.pill}`}
                        >
                          {p.city}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-white/40">
                  Sin perfiles para mostrar ahora mismo.
                </p>
              )}

              <div className="mt-3 flex justify-center">
                <Link
                  href={ctaHref}
                  className="rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-2 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
