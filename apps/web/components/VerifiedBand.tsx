"use client";

import type { CSSProperties } from "react";

type BandSize = "sm" | "md" | "lg";

/**
 * Franja "PERFIL VERIFICADO" que cruza la foto por abajo.
 *
 * Reemplaza a la vieja marca de agua en diagonal: esa iba tenue a propósito y
 * el cliente ni la registraba. Aquí la verificación tiene que ser lo segundo
 * que se ve después de la cara, así que va como una banda sólida de lado a
 * lado, en azul — el color con el que la gente asocia identidad comprobada —
 * y ligeramente inclinada para que se lea como sello y no como subtítulo.
 *
 * La banda se dibuja más ancha que la foto (130%) porque al rotarla las puntas
 * se meterían hacia dentro y dejarían las esquinas al aire.
 *
 * Dos modos:
 *  - `inline` (recomendado en tarjetas): la banda va dentro del bloque de
 *    información inferior, justo encima del nombre, así nunca lo tapa.
 *  - absoluto (por defecto): se ancla al borde inferior de la foto. Solo para
 *    fotos sin texto encima.
 *
 * En ambos casos el contenedor de la foto tiene que recortar el contenido
 * (`overflow-hidden`) para que la banda no se salga de la tarjeta.
 */
const PRESETS: Record<
  BandSize,
  { font: number; padY: number; bottom: number; tracking: number; tick: number }
> = {
  sm: { font: 8.5, padY: 3, bottom: 10, tracking: 0.09, tick: 9 },
  md: { font: 11, padY: 5, bottom: 14, tracking: 0.11, tick: 12 },
  lg: { font: 13, padY: 7, bottom: 18, tracking: 0.13, tick: 14 },
};

const BAND_CLASS =
  "flex items-center justify-center gap-1.5 border-y border-white/25 " +
  "bg-gradient-to-r from-sky-600 via-blue-500 to-sky-600 text-white " +
  "shadow-[0_6px_18px_rgba(2,132,199,0.45)]";

type Props = {
  /** Escala de la banda. "sm" en tarjetas, "md" en galerías, "lg" en el lightbox. */
  size?: BandSize;
  /** Texto de la banda. */
  text?: string;
  /** Inclinación en grados. */
  angle?: number;
  /** Colócala en el flujo (dentro del bloque inferior) en vez de anclarla a la foto. */
  inline?: boolean;
  className?: string;
};

export default function VerifiedBand({
  size = "md",
  text = "PERFIL VERIFICADO",
  angle = -3,
  inline = false,
  className = "",
}: Props) {
  const preset = PRESETS[size];

  const content = (
    <>
      {/* Check dibujado a mano: un icono importado no escala igual de fino en
          la banda pequeña de las tarjetas. */}
      <svg
        viewBox="0 0 24 24"
        width={preset.tick}
        height={preset.tick}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span
        className="whitespace-nowrap font-extrabold uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        style={{
          fontSize: preset.font,
          letterSpacing: `${preset.tracking}em`,
          lineHeight: 1.15,
        }}
      >
        {text}
      </span>
    </>
  );

  const padding: CSSProperties = {
    paddingTop: preset.padY,
    paddingBottom: preset.padY,
  };

  if (inline) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none relative z-[3] select-none ${BAND_CLASS} ${className}`}
        style={{
          ...padding,
          width: "130%",
          marginLeft: "-15%",
          marginBottom: preset.bottom,
          transform: `rotate(${angle}deg)`,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[3] select-none overflow-hidden ${className}`}
    >
      <div
        className={`absolute left-1/2 ${BAND_CLASS}`}
        style={{
          ...padding,
          bottom: preset.bottom,
          width: "130%",
          transform: `translateX(-50%) rotate(${angle}deg)`,
        }}
      >
        {content}
      </div>
    </div>
  );
}
