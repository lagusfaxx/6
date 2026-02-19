"use client";

import { type ChangeEvent } from "react";
import { resolveMediaUrl } from "../../../../../lib/api";
import Avatar from "../../../../../components/Avatar";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";

type Props = {
  user: any;
  onUpload: (type: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) => void;
};

export default function CoverAvatarEditor({ user, onUpload }: Props) {
  const { state } = useDashboardForm();
  const coverUrl = resolveMediaUrl(state.coverPreview || user?.coverUrl) ?? null;
  const avatarUrl = state.avatarPreview || user?.avatarUrl;

  return (
    <EditorCard title="Imagen de perfil y portada" subtitle="Tus fotos principales." delay={0.05}>
      <div className="grid gap-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div
              className="rounded-full p-[2px]"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(217,70,239,0.5))",
                boxShadow: "0 0 16px rgba(139,92,246,0.2)",
              }}
            >
              <div className="rounded-full bg-studio-bg p-[2px]">
                <Avatar src={avatarUrl} alt={user?.displayName || user?.username} size={64} />
              </div>
            </div>
            <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <svg className="h-5 w-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload("avatar", e)}
              />
            </label>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/[0.06] transition">
              {state.avatarUploading ? "Subiendo..." : "Cambiar foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload("avatar", e)}
              />
            </label>
            <p className="mt-1 text-[11px] text-white/30">JPG o PNG recomendado</p>
          </div>
        </div>

        {/* Cover */}
        <div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] group">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Portada"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs text-white/20">Sin portada</span>
              </div>
            )}
            {/* Floating edit button */}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2 text-xs text-white/80">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {state.coverUploading ? "Subiendo..." : "Cambiar portada"}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload("cover", e)}
              />
            </label>
          </div>
        </div>
      </div>
    </EditorCard>
  );
}
