"use client";

import { useRef, useState, useEffect } from "react";
import { X, Upload, Film, Image as ImageIcon, Check, Plus } from "lucide-react";
import { useStoryUpload } from "./StoryUploadContext";
import { getApiBase } from "../lib/api";

type Step = "pick" | "preview" | "uploading" | "done";

export default function StoryUploadModal() {
  const { isOpen, close } = useStoryUpload();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("pick");
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("pick");
        setPreview(null);
        setError(null);
        if (fileRef.current) fileRef.current.value = "";
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview({ url: URL.createObjectURL(file), type: file.type });
    setStep("preview");
    setError(null);
  };

  const handleUpload = async () => {
    if (!fileRef.current?.files?.[0]) return;
    setStep("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", fileRef.current.files[0]);
      const res = await fetch(`${getApiBase()}/stories/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      setStep("done");
    } catch {
      setError("No se pudo subir. Intenta de nuevo.");
      setStep("preview");
    }
  };

  const handleAnother = () => {
    setStep("pick");
    setPreview(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="relative w-full max-w-sm mx-4 rounded-3xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-fuchsia-500/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-white/90">
            {step === "done" ? "¡Listo!" : "Nueva story"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Step: Pick file */}
        {step === "pick" && (
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] py-14 transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.03] group"
            >
              <div className="flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-5 py-2.5 group-hover:bg-fuchsia-500/20 transition">
                <ImageIcon className="h-5 w-5 text-fuchsia-400" />
                <span className="text-sm font-medium text-fuchsia-300">+</span>
                <Film className="h-5 w-5 text-fuchsia-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/70">Toca para elegir</p>
                <p className="text-[11px] text-white/30 mt-1">Foto o video · Máx 100 MB</p>
              </div>
            </button>
            {error && <p className="mt-3 text-xs text-red-400 text-center">{error}</p>}
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="px-5 pb-5 space-y-3">
            <div className="relative mx-auto aspect-[9/16] max-h-[380px] overflow-hidden rounded-2xl bg-black">
              {preview.type.startsWith("video/") ? (
                <video
                  src={preview.url}
                  className="h-full w-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={preview.url}
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
                <p className="text-[11px] text-white/40 text-center">Así se verá tu story</p>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-xs font-medium text-white/60 hover:bg-white/[0.08] transition"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-xs font-semibold text-white hover:brightness-110 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                Publicar
              </button>
            </div>
          </div>
        )}

        {/* Step: Uploading */}
        {step === "uploading" && (
          <div className="flex flex-col items-center gap-4 px-5 py-14">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
            <p className="text-sm text-white/50">Subiendo tu story…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/80">Story publicada</p>
              <p className="text-[11px] text-white/35 mt-1">Visible por 7 días en el carrusel</p>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={handleAnother}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-xs font-medium text-white/60 hover:bg-white/[0.08] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Subir otra
              </button>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-xs font-semibold text-white hover:brightness-110 transition"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
