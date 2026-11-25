"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock, MessageCircle, Sparkles } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import { ACCESS_BADGE, ACCESS_LABEL, type Companion } from "../../../lib/aiCompanions";
import CompanionPortrait from "../../../components/ai-companions/CompanionPortrait";

export default function CompanionProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ companion: Companion }>(`/ai-companions/catalog/${encodeURIComponent(slug)}`)
      .then((r) => setCompanion(r.companion))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="px-4 py-24 text-center text-white/60">
        Este personaje no existe o ya no está disponible.{" "}
        <Link href="/acompanantes-ia" className="text-fuchsia-300 underline">
          Ver catálogo
        </Link>
      </div>
    );
  }
  if (!companion) return <div className="mx-auto mt-6 h-96 max-w-4xl animate-pulse rounded-3xl bg-white/5" />;

  const c = companion;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-4">
      <Link href="/acompanantes-ia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Catálogo
      </Link>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="relative">
          <CompanionPortrait name={c.name} gender={c.gender} src={c.avatarUrl} className="aspect-[3/4] w-full" rounded="rounded-3xl" />
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${ACCESS_BADGE[c.access]}`}>
            {ACCESS_LABEL[c.access]}
          </span>
        </div>

        <div>
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            <Sparkles className="h-3 w-3" /> Personaje de IA · ficticio
          </div>
          <h1 className="text-3xl font-black text-white">
            {c.name} <span className="font-semibold text-white/60">{c.age}</span>
          </h1>
          {c.tagline && <p className="mt-1 text-white/70">{c.tagline}</p>}

          {c.bio && <p className="mt-4 text-sm leading-relaxed text-white/75">{c.bio}</p>}

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Personalidades</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {c.personalities.map((p) => (
                  <span key={p.key} title={p.description} className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs text-fuchsia-200">
                    {p.label}
                  </span>
                ))}
              </dd>
            </div>
            {c.communicationStyle && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Cómo habla</dt>
                <dd className="mt-1 text-white/75">{c.communicationStyle}</dd>
              </div>
            )}
            {c.roleplayNotes && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Roleplay</dt>
                <dd className="mt-1 text-white/75">{c.roleplayNotes}</dd>
              </div>
            )}
            {c.interests.length > 0 && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">Le gusta</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {c.interests.map((i) => (
                    <span key={i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70">
                      {i}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/acompanantes-ia/chat/${c.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 py-3 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Conversar con {c.name}
            </Link>
            {c.access !== "FREE" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/55">
                <Lock className="h-3.5 w-3.5" />
                {c.access === "EXCLUSIVE"
                  ? `Exclusivo: ${c.unlockTokens} tokens por ${c.unlockDays} días, o incluido en VIP`
                  : `Requiere plan ${ACCESS_LABEL[c.access]}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {c.galleryUrls.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/50">Galería</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {c.galleryUrls.map((u) => (
              <button key={u} onClick={() => setZoom(u)} className="aspect-[3/4] overflow-hidden rounded-xl bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveMediaUrl(u) || ""} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      {zoom && (
        <button onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(zoom) || ""} alt={c.name} className="max-h-full max-w-full rounded-2xl" />
        </button>
      )}
    </div>
  );
}
