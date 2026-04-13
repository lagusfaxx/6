"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Upload, FileText, Clock, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { apiFetch, getApiBase } from "../../../../../lib/api";

type ExamsState = {
  examsDocumentUrl: string | null;
  examsStatus: string | null; // "pending" | "approved" | "rejected" | null
  examsSubmittedAt: string | null;
  examsReviewedAt: string | null;
  examsRejectionReason: string | null;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export default function ExamsUploader() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<ExamsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ exams: ExamsState }>("/profile/exams");
      setData(res?.exams ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSuccess(null);

    if (file.size > MAX_FILE_SIZE) {
      setError("El archivo supera el límite de 15 MB.");
      return;
    }
    const mime = (file.type || "").toLowerCase();
    if (!mime.startsWith("image/") && mime !== "application/pdf") {
      setError("Sólo se aceptan imágenes o archivos PDF.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const base = getApiBase();
      const res = await fetch(`${base}/profile/exams`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "UPLOAD_FAILED");
      }
      const body = (await res.json()) as { exams: ExamsState };
      setData(body.exams);
      setSuccess("Documento enviado. Lo revisaremos pronto.");
    } catch (err: any) {
      const code = err?.message || "";
      if (code === "INVALID_FILE_TYPE") setError("Formato no permitido.");
      else if (code === "FILE_TOO_LARGE" || code === "LIMIT_FILE_SIZE")
        setError("El archivo supera el límite de 15 MB.");
      else setError("No se pudo subir el documento.");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!confirm("¿Eliminar el documento enviado? Deberás subir uno nuevo para recuperar el distintivo.")) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ exams: ExamsState }>("/profile/exams", {
        method: "DELETE",
      });
      setData(res.exams);
      setSuccess("Documento eliminado.");
    } catch {
      setError("No se pudo eliminar el documento.");
    } finally {
      setBusy(false);
    }
  };

  const status = data?.examsStatus ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-300/30">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white/90">Profesional con exámenes</h4>
          <p className="text-[11px] text-white/40">
            Sube tu certificado de salud vigente. Un moderador lo revisará y, si está en regla, se te asignará el distintivo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Status badge */}
          <div className="flex flex-wrap items-center gap-2">
            {status === "pending" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                <Clock className="h-3 w-3" /> En revisión
              </span>
            )}
            {status === "approved" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Aprobado
              </span>
            )}
            {status === "rejected" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-200">
                <XCircle className="h-3 w-3" /> Rechazado
              </span>
            )}
            {!status && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/50">
                Sin documento
              </span>
            )}

            {data?.examsDocumentUrl && (
              <a
                href={data.examsDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.08] transition"
              >
                <FileText className="h-3 w-3" /> Ver documento
              </a>
            )}
          </div>

          {status === "rejected" && data?.examsRejectionReason && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200/90">
              <strong className="text-rose-200">Motivo:</strong> {data.examsRejectionReason}
            </div>
          )}

          {/* Upload actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPickFile}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {data?.examsDocumentUrl ? "Reemplazar documento" : "Subir documento"}
            </button>
            {data?.examsDocumentUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.08] transition disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onFileChange}
              className="hidden"
            />
          </div>

          <p className="text-[10px] text-white/35">
            Formatos permitidos: imagen o PDF. Máximo 15 MB. Al subir un nuevo documento reemplazas el anterior.
          </p>

          {error && (
            <p className="text-[11px] text-rose-300">{error}</p>
          )}
          {success && !error && (
            <p className="text-[11px] text-emerald-300">{success}</p>
          )}
        </>
      )}
    </div>
  );
}
