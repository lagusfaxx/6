"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Search, Zap } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import FlashBadge from "../../../components/FlashBadge";

/*
 * Destacar (boost de regalo). Lista las profesionales publicadas con sus
 * visitas y contactos de los últimos 90 días y cómo les va en las últimas 2
 * semanas, para elegir a quién regalarle la Destacada: las que venían bien y
 * ahora están cayendo, o las que nunca despegaron.
 */

type Candidate = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  lastSeen: string | null;
  visits: number;
  visitors: number;
  contacts: number;
  visitsRecent: number;
  contactsRecent: number;
  weeklyRecent: number;
  weeklyEarlier: number | null;
  trendPct: number | null;
  boostEndsAt: string | null;
};

const GENDERS = [
  { value: "FEMALE", label: "Mujeres" },
  { value: "MALE", label: "Hombres" },
  { value: "OTHER", label: "Trans" },
] as const;

const VIEWS = [
  { key: "falling", label: "Cayendo", hint: "Venían bien y en las últimas 2 semanas bajaron sus visitas" },
  { key: "low", label: "Pocas visitas", hint: "Las que menos visitas tuvieron en 90 días" },
  { key: "visits", label: "Más visitas", hint: "Las más vistas en 90 días" },
  { key: "contacts", label: "Más contactos", hint: "WhatsApp + chat en 90 días" },
  { key: "active", label: "Destacadas ahora", hint: "Con Destacada vigente" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const DURATIONS = [
  { hours: 24, label: "24 h" },
  { hours: 72, label: "3 días" },
  { hours: 168, label: "7 días" },
];

function sortFor(view: ViewKey, list: Candidate[]): Candidate[] {
  const l = [...list];
  switch (view) {
    case "falling":
      return l.filter((c) => c.trendPct != null && c.trendPct <= -25).sort((a, b) => (a.trendPct ?? 0) - (b.trendPct ?? 0));
    case "low":
      return l.sort((a, b) => a.visits - b.visits || a.contacts - b.contacts);
    case "visits":
      return l.sort((a, b) => b.visits - a.visits);
    case "contacts":
      return l.sort((a, b) => b.contacts - a.contacts || b.visits - a.visits);
    case "active":
      return l.filter((c) => c.boostEndsAt).sort((a, b) => Date.parse(a.boostEndsAt!) - Date.parse(b.boostEndsAt!));
  }
}

function Trend({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[11px] text-white/30">sin historial</span>;
  const down = pct < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
        pct <= -25 ? "bg-rose-500/15 text-rose-300" : down ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"
      }`}
    >
      {down ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
      {pct > 0 ? `+${pct}` : pct}%
    </span>
  );
}

export default function AdminDestacarPage() {
  const [gender, setGender] = useState<string>("FEMALE");
  const [view, setView] = useState<ViewKey>("falling");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ profiles: Candidate[] }>(`/admin/spotlight/candidates?gender=${gender}`);
      setRows(r.profiles || []);
    } catch {
      setRows([]);
      setNotice({ ok: false, text: "No se pudo cargar la lista." });
    } finally {
      setLoading(false);
    }
  }, [gender]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? rows.filter((c) => c.displayName.toLowerCase().includes(term) || c.username.toLowerCase().includes(term))
      : rows;
    return sortFor(view, base);
  }, [rows, view, q]);

  async function grant(c: Candidate, hours: number) {
    setBusy(c.id);
    setNotice(null);
    try {
      const r = await apiFetch<{ summary: string }>("/admin/promo/grant", {
        method: "POST",
        body: JSON.stringify({ username: c.username, code: "SPOTLIGHT", hours }),
      });
      setNotice({ ok: true, text: `⚡ ${r.summary}` });
      await load();
    } catch (err: any) {
      setNotice({ ok: false, text: err?.body?.message || "No se pudo destacar." });
    } finally {
      setBusy(null);
    }
  }

  async function stop(c: Candidate) {
    if (!window.confirm(`¿Quitar el destacado de ${c.displayName}?`)) return;
    setBusy(c.id);
    try {
      await apiFetch("/admin/promo/stop", { method: "POST", body: JSON.stringify({ username: c.username, code: "SPOTLIGHT" }) });
      setNotice({ ok: true, text: `Destacado quitado a ${c.displayName}.` });
      await load();
    } catch {
      setNotice({ ok: false, text: "No se pudo quitar el destacado." });
    } finally {
      setBusy(null);
    }
  }

  const activeCount = rows.filter((c) => c.boostEndsAt).length;
  const current = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Link href="/admin" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">
          ← Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Zap className="h-5 w-5 fill-amber-300 text-amber-300" /> Destacar
        </h1>
      </div>
      <p className="text-sm text-white/55">
        Regala la Destacada: sello con contador y primer lugar en búsquedas y en el inicio. Visitas y contactos de los
        últimos 90 días; la tendencia compara las últimas 2 semanas con las anteriores. {activeCount > 0 && `${activeCount} destacadas ahora.`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGender(g.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                gender === g.value ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre"
            className="w-48 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-500/40"
          />
        </label>
      </div>

      <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              view === v.key
                ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/40">{current.hint}</p>

      {notice && (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            notice.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-rose-500/25 bg-rose-500/10 text-rose-200"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/45">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/45">
            {view === "falling" ? "Nadie viene cayendo fuerte en las últimas 2 semanas." : "Sin perfiles en esta vista."}
          </p>
        ) : (
          list.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl border p-3 ${c.boostEndsAt ? "border-amber-400/35 bg-amber-400/[0.05]" : "border-white/10 bg-white/[0.02]"}`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={resolveMediaUrl(c.avatarUrl) || "/brand/isotipo-new.png"}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/profesional/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-semibold text-white hover:text-fuchsia-200"
                    >
                      {c.displayName}
                    </a>
                    <span className="text-[11px] text-white/40">@{c.username}{c.city ? ` · ${c.city}` : ""}</span>
                    {c.boostEndsAt && <FlashBadge endsAt={c.boostEndsAt} />}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/60">
                    <span>
                      <strong className="tabular-nums text-white">{c.visits.toLocaleString("es-CL")}</strong> visitas
                    </span>
                    <span>
                      <strong className="tabular-nums text-white">{c.contacts.toLocaleString("es-CL")}</strong> contactos
                    </span>
                    <span className="flex items-center gap-1.5">
                      últimas 2 sem: <strong className="tabular-nums text-white">{c.weeklyRecent}</strong>/sem
                      {c.weeklyEarlier != null && <span className="text-white/35">(antes {c.weeklyEarlier}/sem)</span>}
                      <Trend pct={c.trendPct} />
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:pl-[68px]">
                {DURATIONS.map((d) => (
                  <button
                    key={d.hours}
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => grant(c, d.hours)}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
                  >
                    {c.boostEndsAt ? `+${d.label}` : `⚡ ${d.label}`}
                  </button>
                ))}
                {c.boostEndsAt && (
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => stop(c)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 hover:bg-white/10 disabled:opacity-50"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
