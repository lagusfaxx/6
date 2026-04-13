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
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
} from "lucide-react";

type ExamProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileType: string;
  profileTags: string[];
  examsDocumentUrl: string | null;
  examsStatus: string | null;
  examsSubmittedAt: string | null;
  examsReviewedAt: string | null;
  examsRejectionReason: string | null;
};

const PAGE_SIZE = 30;
const TABS = [
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobados" },
  { key: "rejected", label: "Rechazados" },
  { key: "all", label: "Todos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminExamsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [profiles, setProfiles] = useState<ExamProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<TabKey>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchQuery) params.set("q", searchQuery);
      const res = await apiFetch<{ profiles: ExamProfile[]; total: number }>(
        `/admin/exams/pending?${params}`
      );
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar los documentos.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, tab, searchQuery]);

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

  async function approve(p: ExamProfile) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/exams/${p.id}/approve`, { method: "PUT" });
      setSuccess(`${p.displayName || p.username}: documento aprobado.`);
      await load();
    } catch {
      setError("No se pudo aprobar el documento.");
    } finally {
      setBusy(null);
    }
  }

  async function reject(p: ExamProfile) {
    const reason = (rejectReasons[p.id] || "").trim();
    if (!reason) {
      setError("Debes indicar un motivo para rechazar.");
      return;
    }
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/exams/${p.id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
      setSuccess(`${p.displayName || p.username}: documento rechazado.`);
      setRejectReasons((prev) => ({ ...prev, [p.id]: "" }));
      await load();
    } catch {
      setError("No se pudo rechazar el documento.");
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="p-6 text-white/70">Cargando…</div>;
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
            <h1 className="text-xl font-bold">Exámenes de salud</h1>
            <p className="text-xs text-white/40">
              {total} documento{total !== 1 ? "s" : ""} en esta vista
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          Revisión manual
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(0); }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
                : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
            placeholder="Buscar por nombre, usuario o email…"
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

      {/* List */}
      <div className="mt-4 space-y-3">
        {loadingProfiles ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50 text-sm">
            Cargando…
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50 text-sm">
            No hay documentos en esta vista.
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {p.displayName || p.username}
                    </span>
                    <span className="text-[11px] text-white/40">@{p.username}</span>
                    <StatusBadge status={p.examsStatus} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/40">{p.email}</div>
                  {p.examsSubmittedAt && (
                    <div className="mt-0.5 text-[11px] text-white/40">
                      Enviado: {new Date(p.examsSubmittedAt).toLocaleString("es-CL")}
                    </div>
                  )}
                  {p.examsReviewedAt && p.examsStatus !== "pending" && (
                    <div className="text-[11px] text-white/40">
                      Revisado: {new Date(p.examsReviewedAt).toLocaleString("es-CL")}
                    </div>
                  )}
                  {p.examsStatus === "rejected" && p.examsRejectionReason && (
                    <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-200/90">
                      <strong>Motivo:</strong> {p.examsRejectionReason}
                    </div>
                  )}
                </div>
                {p.examsDocumentUrl && (
                  <a
                    href={p.examsDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 hover:bg-white/[0.08] transition"
                  >
                    <FileText className="h-3.5 w-3.5" /> Abrir documento
                  </a>
                )}
              </div>

              {/* Review actions (only for pending) */}
              {p.examsStatus === "pending" && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={rejectReasons[p.id] || ""}
                    onChange={(e) =>
                      setRejectReasons((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="Motivo de rechazo (obligatorio para rechazar)"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-rose-500/30 placeholder:text-white/30"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => approve(p)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar y otorgar distintivo
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => reject(p)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25 transition disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
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
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/60">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>Página {page + 1} / {totalPages}</span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
        <Clock className="h-3 w-3" /> Pendiente
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Aprobado
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-200">
        <XCircle className="h-3 w-3" /> Rechazado
      </span>
    );
  }
  return null;
}
