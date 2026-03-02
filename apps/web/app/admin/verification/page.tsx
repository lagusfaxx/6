"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Search,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MapPin,
  Mail,
} from "lucide-react";

type PendingProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  profileType: string;
  isActive: boolean;
  phone: string | null;
  city: string | null;
  address: string | null;
  bio: string | null;
  createdAt: string;
};

const PAGE_SIZE = 30;

export default function AdminVerificationPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchQuery) params.set("q", searchQuery);

      const res = await apiFetch<{ profiles: PendingProfile[]; total: number }>(`/admin/verification/pending?${params}`);
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar los perfiles pendientes.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    if (!loading && isAdmin) loadProfiles();
  }, [loading, isAdmin, loadProfiles]);

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

  async function approveProfile(p: PendingProfile) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/verification/${p.id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ verifiedByPhone: phoneInputs[p.id] || p.phone || "" }),
      });
      setSuccess(`${p.displayName || p.username} ha sido verificado y activado.`);
      await loadProfiles();
    } catch {
      setError("No se pudo aprobar el perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function rejectProfile(p: PendingProfile) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/verification/${p.id}/reject`, { method: "PUT" });
      setSuccess(`${p.displayName || p.username} ha sido rechazado.`);
      await loadProfiles();
    } catch {
      setError("No se pudo rechazar el perfil.");
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesion.</div>;
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
            <h1 className="text-xl font-bold">Solicitudes de Verificacion</h1>
            <p className="text-xs text-white/40">{total} perfil{total !== 1 ? "es" : ""} pendiente{total !== 1 ? "s" : ""} de verificacion</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Phone className="h-3.5 w-3.5" />
          Verificacion telefonica manual
        </div>
      </div>

      {/* Search */}
      <div className="mt-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
            placeholder="Buscar por nombre, usuario, email o telefono..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
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
      <div className="mt-4 space-y-3">
        {loadingProfiles ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400/50 mb-3" />
            <div className="text-sm text-white/50">No hay perfiles pendientes de verificacion.</div>
          </div>
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-amber-500/10 bg-white/[0.02] overflow-hidden transition">
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={48} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{p.displayName || p.username}</span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> Pendiente
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{p.profileType}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40 flex-wrap">
                      <span>@{p.username}</span>
                      {p.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {p.phone}</span>}
                      {p.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {p.city}</span>}
                      <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {p.email}</span>
                      <span>{new Date(p.createdAt).toLocaleDateString("es-CL")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 transition"
                      title="Ver detalles"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={busy === p.id}
                      onClick={() => approveProfile(p)}
                      className="flex h-8 items-center gap-1 rounded-lg px-3 border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition disabled:opacity-50"
                      title="Aprobar"
                    >
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Aprobar</span>
                    </button>
                    <button
                      disabled={busy === p.id}
                      onClick={() => rejectProfile(p)}
                      className="flex h-8 items-center gap-1 rounded-lg px-3 border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                      title="Rechazar"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Rechazar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === p.id && (
                <div className="border-t border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
                  {p.bio && (
                    <div>
                      <div className="text-[11px] uppercase text-white/40 mb-1">Descripcion</div>
                      <p className="text-sm text-white/70 line-clamp-3">{p.bio}</p>
                    </div>
                  )}
                  {p.address && (
                    <div>
                      <div className="text-[11px] uppercase text-white/40 mb-1">Direccion</div>
                      <p className="text-sm text-white/70">{p.address}</p>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] uppercase text-white/40 mb-1">Telefono de verificacion</div>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
                        placeholder={p.phone || "Ingresar telefono..."}
                        value={phoneInputs[p.id] || ""}
                        onChange={(e) => setPhoneInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <a
                        href={`tel:${phoneInputs[p.id] || p.phone || ""}`}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/15 px-3 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/25 transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Link href={`/profesional/${p.id}`} className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition">
                      <Eye className="h-3.5 w-3.5" />
                      Ver perfil completo
                    </Link>
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
          <div className="text-xs text-white/40">Pagina {page + 1} de {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30">
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30">
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
