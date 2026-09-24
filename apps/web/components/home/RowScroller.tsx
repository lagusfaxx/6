"use client";

/**
 * Fila horizontal de tarjetas con flechas a los costados.
 *
 * En el celular la fila se desliza con el dedo; en el PC no hay gesto
 * equivalente, así que las flechas son la forma de avanzar. Van sobre los
 * bordes de la fila, grandes y siempre visibles, y se apagan al llegar a un
 * extremo.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Clases del contenedor que scrollea (gap, padding). */
  className?: string;
};

const ARROW =
  "absolute top-[30%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:bg-black/90 disabled:pointer-events-none disabled:opacity-0 sm:grid";

export default function RowScroller({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [update, children]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} className={`scrollbar-none flex overflow-x-auto ${className}`}>
        {children}
      </div>
      <button
        type="button"
        aria-label="Anteriores"
        onClick={() => scroll(-1)}
        disabled={!canPrev}
        className={`${ARROW} -left-5`}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Siguientes"
        onClick={() => scroll(1)}
        disabled={!canNext}
        className={`${ARROW} -right-5`}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
