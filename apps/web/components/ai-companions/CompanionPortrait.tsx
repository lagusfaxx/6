"use client";

import { resolveMediaUrl } from "../../lib/api";
import { initials, type Gender } from "../../lib/aiCompanions";

/** Foto del personaje o, si aún no tiene, un degradado con sus iniciales. */
export default function CompanionPortrait({
  name,
  gender,
  src,
  className = "",
  rounded = "rounded-2xl",
}: {
  name: string;
  gender: Gender;
  src: string | null;
  className?: string;
  rounded?: string;
}) {
  const url = resolveMediaUrl(src);
  const gradient =
    gender === "FEMALE"
      ? "from-rose-500/70 via-fuchsia-600/60 to-violet-800/70"
      : "from-sky-500/70 via-indigo-600/60 to-slate-900/80";
  return (
    <div className={`relative overflow-hidden ${rounded} bg-gradient-to-br ${gradient} ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="select-none text-4xl font-black tracking-tight text-white/80">{initials(name)}</span>
        </div>
      )}
    </div>
  );
}
