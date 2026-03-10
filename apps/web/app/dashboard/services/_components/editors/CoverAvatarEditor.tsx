"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { resolveMediaUrl } from "../../../../../lib/api";
import Avatar from "../../../../../components/Avatar";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";

type Props = {
  user: any;
  onUpload: (
    type: "avatar" | "cover",
    event: ChangeEvent<HTMLInputElement>,
    coverPosition?: { x: number; y: number },
  ) => void;
};

export default function CoverAvatarEditor({ user, onUpload }: Props) {
  const { state, setField } = useDashboardForm();
  const coverUrl = resolveMediaUrl(state.coverPreview || user?.coverUrl) ?? null;
  const avatarUrl = state.avatarPreview || user?.avatarUrl;

  const [coverDraft, setCoverDraft] = useState<{
    file: File;
    localUrl: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const currentCoverPosition = useMemo(
    () => ({ x: state.coverPositionX ?? 50, y: state.coverPositionY ?? 50 }),
    [state.coverPositionX, state.coverPositionY],
  );

  function openCoverAdjustModal(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setCoverDraft({ file, localUrl, x: currentCoverPosition.x, y: currentCoverPosition.y });
    event.target.value = "";
  }

  function closeModal() {
    if (coverDraft?.localUrl) URL.revokeObjectURL(coverDraft.localUrl);
    setCoverDraft(null);
    setDragging(false);
    dragRef.current = null;
  }

  function startDrag(clientX: number, clientY: number) {
    if (!coverDraft) return;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      baseX: coverDraft.x,
      baseY: coverDraft.y,
    };
    setDragging(true);
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!coverDraft || !dragRef.current) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    const nextX = Math.max(0, Math.min(100, dragRef.current.baseX - dx * 0.08));
    const nextY = Math.max(0, Math.min(100, dragRef.current.baseY - dy * 0.2));
    setCoverDraft((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
  }

  function confirmCoverAdjust() {
    if (!coverDraft) return;
    const syntheticEvent = {
      target: { files: [coverDraft.file] },
    } as unknown as ChangeEvent<HTMLInputElement>;
    const nextPosition = { x: coverDraft.x, y: coverDraft.y };
    setField("coverPositionX", nextPosition.x);
    setField("coverPositionY", nextPosition.y);
    onUpload("cover", syntheticEvent, nextPosition);
    closeModal();
  }

  return (
    <EditorCard title="Imagen de perfil y portada" subtitle="Tus fotos principales." delay={0.05}>
      <div className="grid gap-5">
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
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload("avatar", e)} />
            </label>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/[0.06] transition">
              {state.avatarUploading ? "Subiendo..." : "Cambiar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload("avatar", e)} />
            </label>
            <p className="mt-1 text-[11px] text-white/30">JPG o PNG recomendado</p>
          </div>
        </div>

        <div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] group">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Portada"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ objectPosition: `${currentCoverPosition.x}% ${currentCoverPosition.y}%` }}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs text-white/20">Sin portada</span>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2 text-xs text-white/80">
                {state.coverUploading ? "Subiendo..." : "Cambiar portada"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={openCoverAdjustModal} />
            </label>
          </div>
        </div>
      </div>

      {coverDraft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onMouseUp={() => setDragging(false)} onMouseMove={(e) => dragging && moveDrag(e.clientX, e.clientY)}>
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#0d1024] p-4 md:p-5">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-white">Ajustar portada</h3>
              <p className="text-xs text-white/50">Mueve la imagen para elegir el encuadre visible del header.</p>
            </div>
            <div
              className="relative mx-auto aspect-[16/5] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
              onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={() => setDragging(false)}
            >
              <img
                src={coverDraft.localUrl}
                alt="Ajustar portada"
                className="h-full w-full select-none object-cover"
                draggable={false}
                style={{ objectPosition: `${coverDraft.x}% ${coverDraft.y}%` }}
              />
              <div className="pointer-events-none absolute inset-0 border border-white/20" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5">
                Cancelar
              </button>
              <button type="button" onClick={confirmCoverAdjust} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-medium text-white hover:bg-fuchsia-500">
                Guardar encuadre
              </button>
            </div>
          </div>
        </div>
      )}
    </EditorCard>
  );
}
