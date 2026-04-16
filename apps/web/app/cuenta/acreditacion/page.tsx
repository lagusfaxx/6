"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type DocStatus = "PENDING" | "APPROVED" | "REJECTED";

type ProfessionalDocument = {
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
};

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB — matches API
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
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
      <Clock className="h-3 w-3" /> En revisión
    </span>
  );
}

export default function AcreditacionPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [docs, setDocs] = useState<ProfessionalDocument[] | null>(null);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ documents: ProfessionalDocument[] }>(
        "/profile/documents",
      );
      setDocs(res.documents || []);
    } catch (err: any) {
      if (err?.status === 401) {
        router.push("/login?redirect=/cuenta/acreditacion");
        return;
      }
      setError(err?.message || "No pudimos cargar tus documentos.");
    } finally {
      setFetching(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const profileType = (user?.profileType || "").toUpperCase();
  const isEligible = profileType === "PROFESSIONAL" || profileType === "CREATOR";

  const hasApproved = (docs || []).some((d) => d.status === "APPROVED");
  const hasPending = (docs || []).some((d) => d.status === "PENDING");

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setError(null);
    setSuccess(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no permitido. Sube un PDF o una foto (JPG, PNG, WEBP, HEIC).");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`El archivo supera el máximo de ${formatBytes(MAX_SIZE)}.`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (note.trim()) fd.append("note", note.trim());
      await apiFetch<{ document: ProfessionalDocument }>("/profile/documents", {
        method: "POST",
        body: fd,
      });
      setNote("");
      setSuccess("Documento enviado. Un administrador lo revisará pronto.");
      await load();
    } catch (err: any) {
      const code = err?.body?.error || err?.message;
      if (code === "TOO_MANY_DOCUMENTS") {
        setError(err?.body?.message || "Has alcanzado el límite de documentos.");
      } else if (code === "INVALID_FILE_TYPE") {
        setError("Formato no permitido. Sube un PDF o imagen.");
      } else if (code === "LIMIT_FILE_SIZE") {
        setError(`El archivo supera el máximo de ${formatBytes(MAX_SIZE)}.`);
      } else {
        setError("No pudimos subir el documento. Intenta nuevamente.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/profile/documents/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("No pudimos eliminar el documento.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 text-center">
        <h1 className="text-xl font-semibold">Inicia sesión</h1>
        <p className="mt-2 text-sm text-white/50">
          Necesitas una cuenta profesional para acreditar tus exámenes.
        </p>
        <Link href="/login?redirect=/cuenta/acreditacion" className="btn-primary mt-6 inline-block px-6">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 text-center">
        <h1 className="text-xl font-semibold">Solo para profesionales</h1>
        <p className="mt-2 text-sm text-white/50">
          Este apartado está disponible para perfiles profesionales. Completa tu
          publicación para activar tu perfil.
        </p>
        <Link href="/publicate" className="btn-primary mt-6 inline-block px-6">
          Publicar perfil
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 pb-16">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/cuenta")}
          className="rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/5"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-fuchsia-400" />
            Acreditar profesional con exámenes
          </h1>
          <p className="text-xs text-white/40">
            Sube tus documentos médicos o certificados para obtener el distintivo
            <span className="mx-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-200">
              Profesional con exámenes
            </span>
            en tu perfil.
          </p>
        </div>
      </div>

      {/* Status hero */}
      <div
        className={`mb-6 rounded-2xl border p-4 ${
          hasApproved
            ? "border-emerald-500/25 bg-emerald-500/[0.06]"
            : hasPending
              ? "border-amber-500/25 bg-amber-500/[0.06]"
              : "border-white/[0.08] bg-white/[0.03]"
        }`}
      >
        <div className="flex items-start gap-3">
          {hasApproved ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : hasPending ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          ) : (
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-white/50" />
          )}
          <div className="text-sm leading-relaxed text-white/70">
            {hasApproved ? (
              <>
                Tienes al menos un documento aprobado. Si aún no ves el distintivo
                en tu perfil, un administrador lo activará pronto.
              </>
            ) : hasPending ? (
              <>
                Tu documentación está en revisión. Te notificaremos cuando sea
                aprobada.
              </>
            ) : (
              <>
                Sube un PDF o foto legible de tus exámenes o certificado
                profesional. El archivo se guarda de forma privada y solo lo
                revisa un administrador.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold">Subir documento</h2>
        <p className="mt-1 text-xs text-white/45">
          PDF, JPG, PNG o WEBP — máximo {formatBytes(MAX_SIZE)}.
        </p>

        <label className="mt-3 block text-[11px] font-medium text-white/55">
          Nota para el revisor (opcional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Ej: Examen de salud sexual vigente hasta 06/2026."
          className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-fuchsia-500/40 focus:bg-white/[0.06]"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Seleccionar archivo
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {success}
          </div>
        )}
      </div>

      {/* List */}
      <div className="mt-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Tus documentos
        </h2>

        {fetching ? (
          <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ) : !docs || docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
            Aún no has subido documentos.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {docs.map((d) => {
              const resolvedUrl = resolveMediaUrl(d.fileUrl) || d.fileUrl;
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-white/50" />
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-white/90 underline-offset-2 hover:underline"
                      >
                        {d.originalName}
                      </a>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                      <StatusBadge status={d.status} />
                      <span>{formatBytes(d.sizeBytes)}</span>
                      <span>· Subido {formatDate(d.createdAt)}</span>
                    </div>
                    {d.note && (
                      <p className="mt-2 text-xs text-white/55">Nota: {d.note}</p>
                    )}
                    {d.status === "REJECTED" && d.rejectReason && (
                      <p className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
                        Motivo: {d.rejectReason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:ml-3">
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/60 transition hover:bg-white/5"
                    >
                      Ver
                    </a>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[11px] text-red-300 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Borrar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
