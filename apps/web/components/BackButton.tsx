"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  /**
   * `inline` lo pone dentro del flujo, para las secciones que tienen su propia
   * barra fija: ahí el botón es una pieza más de la fila del título.
   *
   * Flotando encima del contenido (el modo por defecto) se apoyaba justo sobre
   * la primera línea de la página y en Explorar tapaba la "E" del título.
   */
  inline?: boolean;
  className?: string;
};

export default function BackButton({ inline = false, className = "" }: Props) {
  const router = useRouter();

  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 " +
    "bg-black/50 text-white/70 backdrop-blur-xl transition hover:bg-white/10 hover:text-white";
  const position = inline
    ? ""
    : "fixed left-3 top-[80px] z-40 md:left-[252px] md:top-[96px]";

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`${base} ${position} ${className}`.trim()}
      aria-label="Volver"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
