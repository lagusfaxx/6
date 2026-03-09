"use client";

type Props = {
  mode: "edit" | "preview";
  onToggle: (mode: "edit" | "preview") => void;
};

export default function MobileViewToggle({ mode, onToggle }: Props) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-1 p-2 border-b border-white/[0.06] bg-[#070816]/90 backdrop-blur-xl">
      <button
        onClick={() => onToggle("edit")}
        className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all duration-200 ${
          mode === "edit"
            ? "bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white shadow-[0_2px_12px_rgba(168,85,247,0.2)]"
            : "text-white/40 hover:text-white/60"
        }`}
      >
        Editar
      </button>
      <button
        onClick={() => onToggle("preview")}
        className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all duration-200 ${
          mode === "preview"
            ? "bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white shadow-[0_2px_12px_rgba(168,85,247,0.2)]"
            : "text-white/40 hover:text-white/60"
        }`}
      >
        Vista previa
      </button>
    </div>
  );
}
