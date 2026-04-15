"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type DocStatus = "PENDING" | "APPROVED" | "REJECTED";

type AdminDoc = {
  id: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  status: DocStatus;
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
    profileType: string;
    profileTags: string[] | null;
  };
};

const FILTERS: Array<{ value: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; label: string }> = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobados" },
  { value: "REJECTED", label: "Rechazados" },
  { value: "ALL", label: "Todos" },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Aprobado
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
        <XCircle className="h-3 w-3" /> Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  );
}

export default function AdminAcreditacionesPage() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ documents: AdminDoc[] }>(
        `/admin/professional-documents?status=${filter}`,
      );
      setDocs(res.documents || []);
    } catch (err: any) {
      setError(err?.message || "No pudimos cargar los documentos.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/professional-documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Acción fallida.");
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/professional-documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "REJECT", rejectReason }),
      });
      setRejectFor(null);
      setRejectReason("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Acción fallida.");
    } finally {
      setActionId(null);
    }
  }

  const hasExamTag = (p: AdminDoc["user"]) =>
    (p.profileTags || []).some((t) => {
      const n = String(t || "").trim().toLowerCase();
      return n === "profesional con examenes" || n === "profesional con exámenes";
    });

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/admin"
            className="rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/5"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <ShieldCheck className="h-5 w-5 text-fuchsia-400" />
              Acreditaciones profesionales
            </h1>
            <p className="text-xs text-white/40">
              Revisa documentos subidos por creadoras. Al aprobar, activa el
              distintivo "Profesional con exámenes" desde
              <Link href="/admin/profiles" className="ml-1 text-fuchsia-300 underline">
                Perfiles
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                filter === f.value
                  ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300"
                  : "border-white/10 text-white/50 hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-white/30">Cargando…</div>
        ) : docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-14 text-center text-sm text-white/45">
            No hay documentos en este estado.
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => {
              const resolvedUrl = resolveMediaUrl(d.fileUrl) || d.fileUrl;
              const avatar = resolveMediaUrl(d.user.avatarUrl) || "";
              return (
                <div
                  key={d.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/40">
                          {d.user.displayName?.[0] || d.user.username[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {d.user.displayName || d.user.username}
                          </span>
                          <span className="text-[11px] text-white/35">@{d.user.username}</span>
                          {hasExamTag(d.user) && (
                            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-200">
                              tag activo
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-white/35">{d.user.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-white/50" />
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1 truncate text-sm text-white/90 underline-offset-2 hover:underline"
                    >
                      <span className="truncate">{d.originalName}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-white/40" />
                    </a>
                    <span className="text-[11px] text-white/40">· {formatBytes(d.sizeBytes)}</span>
                    <span className="text-[11px] text-white/40">· Subido {formatDate(d.createdAt)}</span>
                  </div>

                  {d.note && (
                    <p className="mt-2 text-xs text-white/60">
                      <span className="text-white/35">Nota: </span>
                      {d.note}
                    </p>
                  )}

                  {d.status === "REJECTED" && d.rejectReason && (
                    <p className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
                      Motivo rechazo: {d.rejectReason}
                    </p>
                  )}

                  {d.status === "PENDING" && (
                    <>
                      {rejectFor === d.id ? (
                        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
                          <label className="block text-[11px] font-medium text-white/60">
                            Motivo (visible para la creadora)
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
                            rows={2}
                            placeholder="Ej: El documento no es legible."
                            className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none focus:border-red-500/40"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              disabled={actionId === d.id}
                              onClick={() => reject(d.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/30 disabled:opacity-50"
                            >
                              {actionId === d.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Confirmar rechazo
                            </button>
                            <button
                              onClick={() => {
                                setRejectFor(null);
                                setRejectReason("");
                              }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            disabled={actionId === d.id}
                            onClick={() => approve(d.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {actionId === d.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Aprobar
                          </button>
                          <button
                            disabled={actionId === d.id}
                            onClick={() => {
                              setRejectFor(d.id);
                              setRejectReason("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/[0.05] px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Rechazar
                          </button>
                          <Link
                            href={`/admin/profiles?q=${encodeURIComponent(d.user.username)}`}
                            className="ml-auto text-[11px] text-fuchsia-300 underline-offset-2 hover:underline"
                          >
                            Ir a perfil →
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
