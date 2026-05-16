"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import MfaConfirmDialog from "../../../components/MfaConfirmDialog";
import {
  ArrowLeft,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield,
  Loader2,
  DollarSign,
  Check,
  Pencil,
} from "lucide-react";

type Profile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  profileType: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeen: string | null;
  city: string | null;
  tier: string | null;
  role: string;
  isVerified: boolean;
  profileTags: string[];
  membershipExpiresAt: string | null;
  completedServices: number;
  profileViews: number;
  baseRate: number | null;
  createdAt: string;
  updatedAt: string;
};

const PROFILE_TYPES = [
  { value: "", label: "Todos" },
  { value: "PROFESSIONAL", label: "Profesional" },
  { value: "ESTABLISHMENT", label: "Establecimiento" },
  { value: "SHOP", label: "Tienda" },
  { value: "CLIENT", label: "Cliente" },
  { value: "VIEWER", label: "Visitante" },
];

const PAGE_SIZE = 30;


const hasLabel = (profile: Profile, label: string) => (profile.profileTags ?? []).includes(label);

export default function AdminProfilesPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rateEditing, setRateEditing] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");

  const loadProfiles = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchQuery) params.set("q", searchQuery);
      if (profileTypeFilter) params.set("profileType", profileTypeFilter);
      if (activeFilter) params.set("isActive", activeFilter);

      const res = await apiFetch<{ profiles: Profile[]; total: number }>(`/admin/profiles?${params}`);
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar los perfiles.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, searchQuery, profileTypeFilter, activeFilter]);

  useEffect(() => {
    if (!loading && isAdmin) loadProfiles();
  }, [loading, isAdmin, loadProfiles]);

  // Auto-clear messages
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

  async function toggleProfile(p: Profile) {
    setBusy(p.id);
    setError(null);
    // Optimistic update: toggle locally first for instant feedback
    const prevProfiles = [...profiles];
    setProfiles((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, isActive: !pr.isActive } : pr));
    try {
      await apiFetch(`/admin/profiles/${p.id}/toggle`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      setSuccess(`${p.displayName || p.username} ${p.isActive ? "desactivado" : "activado"}.`);
      await loadProfiles();
    } catch {
      // Revert optimistic update on failure
      setProfiles(prevProfiles);
      setError("No se pudo cambiar el estado del perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteProfile(id: string, mfaCode: string) {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/admin/profiles/${id}`, {
        method: "DELETE",
        headers: { "x-2fa-code": mfaCode },
      });
      setSuccess("Perfil eliminado permanentemente.");
      setDeleteConfirm(null);
      await loadProfiles();
    } finally {
      setBusy(null);
    }
  }

  async function updateAdminLabel(profile: Profile, label: "premium" | "verificada" | "profesional con examenes", value: boolean) {
    setBusy(profile.id);
    setError(null);
    try {
      await apiFetch(`/admin/profiles/${profile.id}/labels`, {
        method: "PUT",
        body: JSON.stringify({
          premium: label === "premium" ? value : hasLabel(profile, "premium"),
          verified: label === "verificada" ? value : hasLabel(profile, "verificada"),
          exams: label === "profesional con examenes" ? value : hasLabel(profile, "profesional con examenes"),
        }),
      });
      setSuccess(`Etiqueta ${label} ${value ? "agregada" : "removida"} en ${profile.displayName || profile.username}.`);
      await loadProfiles();
    } catch {
      setError("No se pudo actualizar la etiqueta del perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function updateTier(profile: Profile, tier: "PREMIUM" | "GOLD" | "SILVER" | null) {
    if (profile.tier === tier) return;
    setBusy(profile.id);
    setError(null);
    const prevProfiles = [...profiles];
    setProfiles((prev) => prev.map((pr) => pr.id === profile.id ? { ...pr, tier } : pr));
    try {
      await apiFetch(`/admin/profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ tier }),
      });
      setSuccess(
        tier
          ? `Tier ${tier} asignado a ${profile.displayName || profile.username}.`
          : `Tier removido de ${profile.displayName || profile.username}.`,
      );
      await loadProfiles();
    } catch {
      setProfiles(prevProfiles);
      setError("No se pudo actualizar el tier del perfil.");
    } finally {
      setBusy(null);
    }
  }

  function startEditingRate(profile: Profile) {
    setRateEditing(profile.id);
    setRateInput(profile.baseRate != null ? String(profile.baseRate) : "");
    setError(null);
  }

  function cancelEditingRate() {
    setRateEditing(null);
    setRateInput("");
  }

  async function saveBaseRate(profile: Profile) {
    const trimmed = rateInput.trim();
    let nextRate: number | null;
    if (trimmed === "") {
      nextRate = null;
    } else {
      const digits = trimmed.replace(/[^\d]/g, "");
      const parsed = Number(digits);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000000) {
        setError("La tarifa debe ser un número entre 0 y 10.000.000 CLP.");
        return;
      }
      nextRate = Math.round(parsed);
    }

    if (nextRate === (profile.baseRate ?? null)) {
      cancelEditingRate();
      return;
    }

    setBusy(profile.id);
    setError(null);
    const prevProfiles = [...profiles];
    setProfiles((prev) =>
      prev.map((pr) => (pr.id === profile.id ? { ...pr, baseRate: nextRate } : pr)),
    );
    try {
      await apiFetch(`/admin/profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ baseRate: nextRate }),
      });
      setSuccess(
        nextRate != null
          ? `Tarifa de ${profile.displayName || profile.username} actualizada a $${nextRate.toLocaleString("es-CL")}.`
          : `Tarifa de ${profile.displayName || profile.username} eliminada.`,
      );
      cancelEditingRate();
      await loadProfiles();
    } catch {
      setProfiles(prevProfiles);
      setError("No se pudo actualizar la tarifa del perfil.");
    } finally {
      setBusy(null);
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
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Gestión de Perfiles</h1>
            <p className="text-xs text-white/40">{total} perfil{total !== 1 ? "es" : ""} encontrado{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
            placeholder="Buscar por nombre, usuario o email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(0); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex gap-2">
          <select
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition"
            value={profileTypeFilter}
            onChange={(e) => { setProfileTypeFilter(e.target.value); setPage(0); }}
          >
            {PROFILE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition"
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value as any); setPage(0); }}
          >
            <option value="">Estado: Todos</option>
            <option value="true">Activos</option>
            <option value="false">Desactivados</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Profiles list */}
      <div className="mt-4 space-y-2">
        {loadingProfiles ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <div className="text-sm text-white/50">No se encontraron perfiles.</div>
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border bg-white/[0.02] p-3 sm:p-4 transition ${
                p.isActive ? "border-white/[0.08]" : "border-red-500/10 bg-red-500/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={44} />
                  {p.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0e0e12] bg-emerald-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{p.displayName || p.username}</span>
                    {!p.isActive && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">Desactivado</span>
                    )}
                    {p.role === "ADMIN" && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 flex items-center gap-0.5">
                        <Shield className="h-2.5 w-2.5" /> Admin
                      </span>
                    )}
                    {p.tier && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        p.tier === "PREMIUM" ? "bg-cyan-500/20 text-cyan-300" :
                        p.tier === "GOLD" ? "bg-amber-500/20 text-amber-300" :
                        "bg-white/10 text-white/50"
                      }`}>
                        {p.tier}
                      </span>
                    )}
                    {hasLabel(p, "premium") && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">Premium</span>
                    )}
                    {hasLabel(p, "verificada") && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">Verificada</span>
                    )}
                    {hasLabel(p, "profesional con examenes") && (
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-200">Profesional con exámenes</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40 flex-wrap">
                    <span>@{p.username}</span>
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="truncate text-white/60 hover:text-fuchsia-300 transition"
                        title={p.email}
                      >
                        {p.email}
                      </a>
                    )}
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{p.profileType}</span>
                    {p.city && <span>{p.city}</span>}
                    <span>{p.profileViews} vistas</span>
                    <span>{new Date(p.createdAt).toLocaleDateString("es-CL")}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/profesional/${p.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition"
                    title="Ver perfil"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    disabled={busy === p.id}
                    onClick={() => toggleProfile(p)}
                    className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium transition disabled:opacity-50 ${
                      p.isActive
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                    title={p.isActive ? "Desactivar" : "Activar"}
                  >
                    {busy === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : p.isActive ? (
                      <ToggleRight className="h-3.5 w-3.5" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{p.isActive ? "Activo" : "Inactivo"}</span>
                  </button>
                  <button
                    disabled={busy === p.id}
                    onClick={() => setDeleteConfirm(p.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                <button
                  disabled={busy === p.id}
                  onClick={() => updateAdminLabel(p, "premium", !hasLabel(p, "premium"))}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    hasLabel(p, "premium")
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Premium
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateAdminLabel(p, "verificada", !hasLabel(p, "verificada"))}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    hasLabel(p, "verificada")
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Verificada
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateAdminLabel(p, "profesional con examenes", !hasLabel(p, "profesional con examenes"))}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    hasLabel(p, "profesional con examenes")
                      ? "border-blue-400/40 bg-blue-500/15 text-blue-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Profesional con exámenes
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Tier:</span>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateTier(p, null)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    p.tier === null
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Sin tier
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateTier(p, "SILVER")}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    p.tier === "SILVER"
                      ? "border-slate-300/40 bg-slate-200/15 text-slate-100"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Silver
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateTier(p, "GOLD")}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    p.tier === "GOLD"
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Gold
                </button>
                <button
                  disabled={busy === p.id}
                  onClick={() => updateTier(p, "PREMIUM")}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    p.tier === "PREMIUM"
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Premium
                </button>
              </div>

              {(p.profileType === "PROFESSIONAL" || p.profileType === "ESTABLISHMENT" || p.profileType === "SHOP") && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-white/40 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Tarifa:
                  </span>
                  {rateEditing === p.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveBaseRate(p);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-white/40">$</span>
                        <input
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9.]*"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          placeholder="40000"
                          className="w-32 rounded-lg border border-white/10 bg-black/30 pl-5 pr-2 py-1.5 text-[11px] outline-none focus:border-fuchsia-500/30 transition"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy === p.id}
                        className="flex h-7 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/25 transition disabled:opacity-50"
                        title="Guardar"
                      >
                        {busy === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingRate}
                        disabled={busy === p.id}
                        className="flex h-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-white/60 hover:bg-white/10 transition disabled:opacity-50"
                        title="Cancelar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="text-[10px] text-white/40">
                        {rateInput.trim() === ""
                          ? "Vacío = sin tarifa"
                          : `$${Number(rateInput.replace(/[^\d]/g, "") || "0").toLocaleString("es-CL")} CLP`}
                      </span>
                    </form>
                  ) : (
                    <>
                      <span
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                          p.baseRate == null
                            ? "border-white/10 bg-white/5 text-white/40"
                            : p.baseRate < 1000
                              ? "border-red-500/30 bg-red-500/10 text-red-200"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {p.baseRate == null
                          ? "Sin tarifa"
                          : `$${p.baseRate.toLocaleString("es-CL")} CLP`}
                      </span>
                      {p.baseRate != null && p.baseRate > 0 && p.baseRate < 1000 && (
                        <span className="text-[10px] text-red-300">
                          Valor sospechoso (¿faltan ceros?)
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => startEditingRate(p)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-white/70 hover:bg-white/10 transition disabled:opacity-50"
                        title="Editar tarifa"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          ))
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

      <MfaConfirmDialog
        open={deleteConfirm !== null}
        title="Eliminar perfil"
        description="Esta acción es permanente. Ingresa tu código de Google Authenticator para confirmar la eliminación."
        confirmLabel="Eliminar definitivamente"
        destructive
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={async (code) => {
          if (deleteConfirm) {
            await deleteProfile(deleteConfirm, code);
          }
        }}
      />
    </div>
  );
}
