"use client";

type Props = {
  mode: "edit" | "preview";
  onToggle: (mode: "edit" | "preview") => void;
};

export default function MobileViewToggle({ mode, onToggle }: Props) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-1 p-2 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <button
        onClick={() => onToggle("edit")}
        className={`rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
          mode === "edit"
            ? "bg-white/15 text-white shadow-sm"
            : "text-white/40 hover:text-white/60"
        }`}
      >
        Editar
      </button>
      <button
        onClick={() => onToggle("preview")}
        className={`rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
          mode === "preview"
            ? "bg-white/15 text-white shadow-sm"
            : "text-white/40 hover:text-white/60"
        }`}
      >
        Vista previa
      </button>
    </div>
  );
}
