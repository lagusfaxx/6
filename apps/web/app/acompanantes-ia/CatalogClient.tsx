"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Crown, Lock, MessageCircle, Sparkles } from "lucide-react";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";
import {
  ACCESS_BADGE,
  ACCESS_LABEL,
  TIER_LABEL,
  type AiAccount,
  type Companion,
  type Gender,
} from "../../lib/aiCompanions";
import CompanionPortrait from "../../components/ai-companions/CompanionPortrait";

type ChatSummary = {
  id: string;
  companion: { slug: string; name: string; avatarUrl: string | null; gender: Gender };
  lastMessage: { role: string; content: string; createdAt: string } | null;
};

export default function CatalogClient() {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const [companions, setCompanions] = useState<Companion[] | null>(null);
  const [gender, setGender] = useState<"ALL" | Gender>("ALL");
  const [account, setAccount] = useState<AiAccount | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);

  useEffect(() => {
    apiFetch<{ companions: Companion[] }>("/ai-companions/catalog")
      .then((r) => setCompanions(r.companions))
      .catch(() => setCompanions([]));
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    apiFetch<AiAccount>("/ai-companions/me").then(setAccount).catch(() => {});
    apiFetch<{ chats: ChatSummary[] }>("/ai-companions/chats")
      .then((r) => setChats(r.chats.filter((c) => c.lastMessage)))
      .catch(() => {});
  }, [isAuthed]);

  const visible = useMemo(
    () => (companions || []).filter((c) => gender === "ALL" || c.gender === gender),
    [companions, gender],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
      <header className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 via-violet-700/20 to-[#0d0e1a] p-6 sm:p-8">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200">
          <Bot className="h-3.5 w-3.5" /> Inteligencia artificial · +18
        </div>
        <h1 className="text-2xl font-black text-white sm:text-4xl">Acompañantes virtuales</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65 sm:text-base">
          Elige un personaje, conversa en privado y pídele fotos. Cada uno tiene su personalidad, su forma de hablar y
          recuerda lo que le cuentas. Todos son personajes ficticios y adultos.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/acompanantes-ia/planes"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-black"
          >
            <Crown className="h-3.5 w-3.5" /> Planes
          </Link>
          {account && (
            <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70">
              Tu plan: <b className="text-white">{TIER_LABEL[account.tier]}</b> · {account.usage.messagesLeft} mensajes hoy
            </span>
          )}
        </div>
      </header>

      {chats.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/50">Tus conversaciones</h2>
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4">
            {chats.map((c) => (
              <Link
                key={c.id}
                href={`/acompanantes-ia/chat/${c.companion.slug}`}
                className="flex w-64 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0e1a] p-3 hover:border-fuchsia-400/40"
              >
                <CompanionPortrait
                  name={c.companion.name}
                  gender={c.companion.gender}
                  src={c.companion.avatarUrl}
                  className="h-12 w-12 shrink-0"
                  rounded="rounded-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{c.companion.name}</p>
                  <p className="truncate text-xs text-white/50">
                    {c.lastMessage?.role === "USER" ? "Tú: " : ""}
                    {c.lastMessage?.content}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex gap-2">
        {(
          [
            ["ALL", "Todos"],
            ["FEMALE", "Mujeres"],
            ["MALE", "Hombres"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setGender(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              gender === key ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {companions === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/50">Pronto habrá personajes disponibles.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((c) => (
            <Link
              key={c.id}
              href={`/acompanantes-ia/${c.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0e1a]"
            >
              <CompanionPortrait
                name={c.name}
                gender={c.gender}
                src={c.avatarUrl}
                className="aspect-[3/4] w-full transition duration-300 group-hover:scale-[1.03]"
                rounded="rounded-none"
              />
              <span
                className={`absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ACCESS_BADGE[c.access]}`}
              >
                {c.access !== "FREE" && <Lock className="h-2.5 w-2.5" />}
                {ACCESS_LABEL[c.access]}
              </span>
              <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur">
                <Sparkles className="h-2.5 w-2.5" /> IA
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pb-3 pt-14">
                <h3 className="text-[15px] font-bold text-white">
                  {c.name} <span className="font-medium text-white/70">{c.age}</span>
                </h3>
                {c.tagline && <p className="mt-0.5 line-clamp-2 text-[11px] text-white/65">{c.tagline}</p>}
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-black">
                  <MessageCircle className="h-3 w-3" /> Conversar
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-[11px] text-white/35">
        Personajes generados por inteligencia artificial. Cualquier parecido con personas reales es coincidencia. Solo
        mayores de 18 años.
      </p>
    </div>
  );
}
