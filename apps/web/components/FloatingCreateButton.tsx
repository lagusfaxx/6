"use client";

type FloatingCreateButtonProps = {
  onClick: () => void;
};

export default function FloatingCreateButton({ onClick }: FloatingCreateButtonProps) {
  return (
    <button
      className="fixed right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-500 text-3xl text-white shadow-lg transition hover:bg-fuchsia-400"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
      onClick={onClick}
      aria-label="Crear publicación"
      type="button"
    >
      +
    </button>
  );
}
