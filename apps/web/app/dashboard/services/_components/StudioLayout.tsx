"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import LivePreview from "./LivePreview";
import EditorPanel from "./EditorPanel";
import MobileViewToggle from "./MobileViewToggle";
import UnsavedChangesBar from "./UnsavedChangesBar";
import ToastNotification from "./ToastNotification";
import SkeletonPreview from "./SkeletonPreview";
import { Sparkles } from "lucide-react";

type Props = {
  user: any;
  profileType: string;
  loading: boolean;
  onSaveProfile: () => Promise<void>;
  onResetToSaved: () => void;
};

export default function StudioLayout({ user, profileType, loading, onSaveProfile, onResetToSaved }: Props) {
  const { state, isDirty } = useDashboardForm();
  const [mobileMode, setMobileMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="studio-bg min-h-screen relative -mx-4 -mt-2 sm:-mx-4">
      {/* Violet radial glow behind preview */}
      <div className="studio-glow fixed inset-0 z-0" />

      {/* Header bar */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0a0b1d]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/90">Creator Studio</h1>
              <p className="text-[10px] text-white/40">Edita tu perfil con vista previa en tiempo real</p>
            </div>
          </div>
          {isDirty && (
            <span className="rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 text-[10px] font-medium text-amber-300">
              Cambios sin guardar
            </span>
          )}
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="lg:hidden">
        <MobileViewToggle mode={mobileMode} onToggle={setMobileMode} />
      </div>

      {/* Desktop split-screen */}
      <div className="hidden lg:flex min-h-screen relative z-10">
        {/* LEFT: Live Preview - 60% */}
        <div className="w-[60%] sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto p-6 pr-3">
          {loading ? (
            <SkeletonPreview />
          ) : (
            <LivePreview user={user} profileType={profileType} />
          )}
        </div>

        {/* RIGHT: Editor Panel - 40% */}
        <div className="w-[40%] overflow-y-auto p-6 pl-3 min-h-screen">
          <EditorPanel profileType={profileType} user={user} />
        </div>
      </div>

      {/* Mobile single-mode */}
      <div className="lg:hidden relative z-10 px-4 pb-32">
        {mobileMode === "preview" ? (
          loading ? (
            <SkeletonPreview />
          ) : (
            <div className="pt-4">
              <LivePreview user={user} profileType={profileType} />
            </div>
          )
        ) : (
          <div className="pt-4">
            <EditorPanel profileType={profileType} user={user} />
          </div>
        )}
      </div>

      {/* Floating save bar */}
      <AnimatePresence>
        {isDirty && (
          <UnsavedChangesBar
            onSave={onSaveProfile}
            onDiscard={onResetToSaved}
            busy={state.busy}
          />
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {state.toast && (
          <ToastNotification tone={state.toast.tone} message={state.toast.message} />
        )}
      </AnimatePresence>
    </div>
  );
}
