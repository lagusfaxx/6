"use client";

import { motion } from "framer-motion";

type Props = {
  onSave: () => Promise<void>;
  onDiscard: () => void;
  busy: boolean;
};

export default function UnsavedChangesBar({ onSave, onDiscard, busy }: Props) {
  return (
    <>
      {/* Desktop: bottom-right floating */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="hidden lg:flex unsaved-bar fixed bottom-6 right-6 z-50"
      >
        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="text-sm text-white/60 whitespace-nowrap">Cambios sin guardar</span>
        <button
          onClick={onDiscard}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
        >
          Descartar
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-1.5 text-sm font-semibold shadow-[0_8px_20px_rgba(168,85,247,0.20)] transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar cambios"}
        </button>
      </motion.div>

      {/* Mobile: full-width bottom bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="lg:hidden unsaved-bar fixed bottom-0 inset-x-0 z-50 rounded-none border-x-0 border-b-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="text-sm text-white/60 flex-1">Sin guardar</span>
        <button
          onClick={onDiscard}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
        >
          Descartar
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-1.5 text-sm font-semibold shadow-[0_8px_20px_rgba(168,85,247,0.20)] transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "..." : "Guardar"}
        </button>
      </motion.div>
    </>
  );
}
