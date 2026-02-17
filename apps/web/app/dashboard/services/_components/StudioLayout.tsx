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

      {/* Mobile toggle */}
      <div className="lg:hidden">
        <MobileViewToggle mode={mobileMode} onToggle={setMobileMode} />
      </div>

      {/* Desktop split-screen */}
      <div className="hidden lg:flex min-h-screen relative z-10">
        {/* LEFT: Live Preview - 60% */}
        <div className="w-[60%] sticky top-0 h-screen overflow-y-auto p-6 pr-3">
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
