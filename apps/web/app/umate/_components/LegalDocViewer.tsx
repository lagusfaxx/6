"use client";

import { useEffect, useRef, useState } from "react";

type Section = { title: string; paragraphs: string[] };

export default function LegalDocViewer({
  sections,
  version,
  compact = false,
}: {
  sections: Section[];
  version: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`space-y-5 text-sm leading-relaxed text-white/55 ${
        compact ? "text-[13px]" : ""
      }`}
    >
      <p className="text-[11px] uppercase tracking-widest text-white/30">
        Versión {version}
      </p>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 text-white font-bold">{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="mb-2">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Scrollable viewer with a scroll-to-read gate.
 * Fires onReadComplete when the user has scrolled within 40px of the bottom.
 */
export function ScrollableLegalDoc({
  sections,
  version,
  onReadComplete,
}: {
  sections: Section[];
  version: string;
  onReadComplete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readComplete, setReadComplete] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      const reachedBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      if (reachedBottom && !readComplete) {
        setReadComplete(true);
        onReadComplete();
      }
    };

    // If the content already fits without scrolling, unlock immediately.
    if (el.scrollHeight <= el.clientHeight + 40) {
      setReadComplete(true);
      onReadComplete();
      return;
    }

    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [onReadComplete, readComplete, sections]);

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="max-h-[55vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.06] bg-black/30 p-4 sm:p-5"
      >
        <LegalDocViewer sections={sections} version={version} compact />
      </div>
      {!readComplete && (
        <p className="text-center text-[11px] text-white/35">
          ↓ Desliza hasta el final para poder aceptar
        </p>
      )}
    </div>
  );
}
