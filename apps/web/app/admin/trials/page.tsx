"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Search,
  X,
  Clock4,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  CalendarPlus,
  Eye,
} from "lucide-react";

type TrialProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileType: string;
  isActive: boolean;
  city: string | null;
  tier: string | null;
  shopTrialEndsAt: string | null;
  membershipExpiresAt: string | null;
  createdAt: string;
  trialStatus: "active" | "expired" | "paid";
  daysRemaining: number;
  daysSinceExpired: number;
};

const PAGE_SIZE = 30;

const STATUS_TABS: Array<{ value: "active" | "expired" | "all"; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "expired", label: "Vencidas (sin pago)" },
  { value: "all", label: "Todas" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminTrialsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [profiles, setProfiles] = useState<TrialProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"active" | "expired" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [extendOpen, setExtendOpen] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);

  const load = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      params.set("status", statusFilter);
      if (searchQuery) params.set("q", searchQuery);

      const res = await apiFetch<{ profiles: TrialProfile[]; total: number }>(
        `/admin/trials?${params}`,
      );
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar las pruebas gratuitas.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin, load]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput);
  }

  async function extendTrial(id: string, days: number) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/admin/trials/${id}/extend`, {
        method: "PUT",
        body: JSON.stringify({ days, activate: true }),
      });
      setSuccess(`Prueba gratuita extendida ${days} días y perfil activado.`);
      setExtendOpen(null);
      await load();
    } catch {
      setError("No se pudo extender la prueba gratuita.");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Clock4 className="h-5 w-5 text-amber-300" /> Pruebas Gratuitas
            </h1>
            <p className="text-xs text-white/40">
              {total} perfil{total !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => load()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 transition"
          title="Recargar"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setPage(0);
              setStatusFilter(t.value);
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              statusFilter === t.value
                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-amber-500/30 transition placeholder:text-white/30"
          placeholder="Buscar por nombre, usuario o email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
              setPage(0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Notifications */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {loadingProfiles ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Clock4 className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <div className="text-sm text-white/50">
              No hay perfiles que coincidan con este filtro.
            </div>
          </div>
        ) : (
          profiles.map((p) => {
            const isActive = p.trialStatus === "active";
            const isExpired = p.trialStatus === "expired";
            const isPaid = p.trialStatus === "paid";
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 sm:p-4 transition ${
                  isExpired
                    ? "border-red-500/15 bg-red-500/[0.04]"
                    : isPaid
                    ? "border-emerald-500/15 bg-emerald-500/[0.03]"
                    : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {p.displayName || p.username}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                        {p.profileType}
                      </span>
                      {isActive && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                          Prueba activa · {p.daysRemaining} día{p.daysRemaining !== 1 ? "s" : ""}
                        </span>
                      )}
                      {isExpired && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                          Vencida {p.daysSinceExpired > 0 ? `hace ${p.daysSinceExpired} día${p.daysSinceExpired !== 1 ? "s" : ""}` : ""}
                        </span>
                      )}
                      {isPaid && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                          Membresía pagada
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="rounded bg-zinc-500/20 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                          Desactivado
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      <span>@{p.username}</span>
                      {p.email && (
                        <a
                          href={`mailto:${p.email}`}
                          className="truncate text-white/60 hover:text-amber-300 transition"
                          title={p.email}
                        >
                          {p.email}
                        </a>
                      )}
                      {p.city && <span>{p.city}</span>}
                      <span>Termina: {fmtDate(p.shopTrialEndsAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/profesional/${p.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white/70"
                      title="Ver perfil"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => {
                        setExtendOpen(extendOpen === p.id ? null : p.id);
                        setExtendDays(30);
                      }}
                      disabled={busyId === p.id}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                      title={isExpired ? "Reactivar" : "Extender prueba"}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{isExpired ? "Reactivar" : "Extender"}</span>
                    </button>
                  </div>
                </div>

                {extendOpen === p.id && (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-white/70">Extender por</span>
                      {[7, 15, 30, 60, 90].map((d) => (
                        <button
                          key={d}
                          onClick={() => setExtendDays(d)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                            extendDays === d
                              ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={extendDays}
                        onChange={(e) => setExtendDays(Math.max(1, Math.min(365, Number(e.target.value) || 0)))}
                        className="w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs outline-none focus:border-amber-500/30"
                      />
                      <button
                        onClick={() => extendTrial(p.id, extendDays)}
                        disabled={busyId === p.id || extendDays < 1}
                        className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                      >
                        {busyId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CalendarPlus className="h-3.5 w-3.5" />
                        )}
                        Confirmar
                      </button>
                      <button
                        onClick={() => setExtendOpen(null)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-white/40">
                      El perfil se reactivará automáticamente y la prueba se extenderá desde la
                      fecha actual de vencimiento (o desde hoy si ya expiró).
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-white/40">
            Página {page + 1} de {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
