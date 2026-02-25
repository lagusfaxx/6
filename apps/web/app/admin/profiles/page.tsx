"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield,
  Crown,
  Loader2,
  AlertTriangle,
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
  membershipExpiresAt: string | null;
  completedServices: number;
  profileViews: number;
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
    try {
      await apiFetch(`/admin/profiles/${p.id}/toggle`, { method: "PUT" });
      setSuccess(`${p.displayName || p.username} ${p.isActive ? "desactivado" : "activado"}.`);
      await loadProfiles();
    } catch {
      setError("No se pudo cambiar el estado del perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteProfile(id: string) {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/admin/profiles/${id}`, { method: "DELETE" });
      setSuccess("Perfil eliminado permanentemente.");
      setDeleteConfirm(null);
      await loadProfiles();
    } catch {
      setError("No se pudo eliminar el perfil.");
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
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40 flex-wrap">
                    <span>@{p.username}</span>
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

              {/* Delete confirmation */}
              {deleteConfirm === p.id && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm text-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>¿Eliminar permanentemente a <strong>{p.displayName || p.username}</strong>? Esta acción no se puede deshacer.</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={busy === p.id}
                      onClick={() => deleteProfile(p.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Sí, eliminar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                    >
                      Cancelar
                    </button>
                  </div>
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
    </div>
  );
}
