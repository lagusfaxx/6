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
          <p className="mt-0.5 text-xs text-white/40">Fotos visibles en tu perfil publico.</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/[0.06] transition shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Subir fotos
          <input
            type="file"
            accept="image/*"
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
            <img
              src={resolveMediaUrl(g.url) ?? undefined}
              alt="Galeria"
              className="h-full w-full object-cover"
            />
            <button
              onClick={() => onRemoveGalleryItem(g.id)}
              className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            >
              Eliminar
            </button>
          </motion.div>
        ))}
      </div>

      {!state.gallery.length && (
        <p className="mt-4 text-center text-xs text-white/30">Aun no tienes fotos en tu galeria.</p>
      )}
    </EditorCard>
  );
}
