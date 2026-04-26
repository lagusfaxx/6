"use client";

import { type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { resolveMediaUrl } from "../../../../../lib/api";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";

type Props = {
  onUploadGallery: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveGalleryItem: (id: string) => Promise<void>;
};

export default function GalleryEditor({ onUploadGallery, onRemoveGalleryItem }: Props) {
  const { state } = useDashboardForm();

  return (
    <EditorCard delay={0}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Galeria</h3>
          <p className="mt-0.5 text-xs text-white/40">Fotos y videos visibles en tu perfil publico.</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/[0.06] transition shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Subir fotos/videos
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            className="hidden"
            multiple
            onChange={onUploadGallery}
          />
        </label>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        {state.gallery.map((g) => (
          <motion.div
            key={g.id}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
            className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06]"
          >
            {String(g.type).toUpperCase() === "VIDEO" ? (
              <video src={resolveMediaUrl(g.url) ?? undefined} className="h-full w-full object-cover" muted loop playsInline controls />
            ) : (
              <img src={resolveMediaUrl(g.url) ?? undefined} alt="Galeria" className="h-full w-full object-cover" />
            )}
            {g.isLocked ? (
              <div
                title="Foto del registro: no se puede eliminar"
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2 .895 2 2v3a2 2 0 11-4 0v-3c0-1.105.895-2 2-2zm6-2V7a6 6 0 10-12 0v2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM8 9V7a4 4 0 118 0v2H8z" />
                </svg>
                Registro
              </div>
            ) : (
              <button
                onClick={() => onRemoveGalleryItem(g.id)}
                className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              >
                Eliminar
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {!state.gallery.length && (
        <p className="mt-4 text-center text-xs text-white/30">Aun no tienes fotos o videos en tu galeria.</p>
      )}
    </EditorCard>
  );
}
