"use client";

import type { CSSProperties } from "react";

type BandSize = "sm" | "md" | "lg";

/**
 * Franja "PERFIL VERIFICADO" que cruza la foto por abajo.
 *
 * Reemplaza a la vieja marca de agua en diagonal: esa iba tenue a propósito y
 * el cliente ni la registraba. Aquí la verificación tiene que ser lo segundo
 * que se ve después de la cara, así que va como una banda sólida de lado a
 * lado, en azul — el color con el que la gente asocia identidad comprobada.
 *
 * La banda va horizontal, de borde a borde. Se probó inclinada y en pantallas
 * grandes no servía: el desvío vertical de las puntas crece con el ancho (en
 * un monitor la banda mide más de 1000px y las puntas se subían decenas de
 * píxeles), así que terminaba encima del nombre. El aire de "cinta cruzada" lo
 * ponen ahora unas franjas diagonales dentro de la propia banda, que no
 * dependen del ancho.
 *
 * Dos modos:
 *  - `inline` (recomendado en tarjetas): la banda va como último elemento del
 *    bloque de información inferior, pegada al borde de abajo de la foto. Iba
 *    arriba del nombre y, cuando ese bloque crecía más que la foto (la ficha
 *    del modal, por ejemplo), la banda se salía por arriba y quedaba cortada
 *    contra el borde superior. Como último hijo de un bloque anclado abajo,
 *    siempre queda dentro.
 *  - absoluto (por defecto): se ancla al borde inferior de la foto. Solo para
 *    fotos sin texto encima.
 *
 * En ambos casos el contenedor de la foto tiene que recortar el contenido
 * (`overflow-hidden`) para que la banda no se salga de la tarjeta.
 */
const PRESETS: Record<
  BandSize,
  { font: number; padY: number; gap: number; tracking: number; tick: number }
> = {
  /* `gap` es el aire entre el texto del bloque y la banda. */
  sm: { font: 8.5, padY: 3, gap: 8, tracking: 0.09, tick: 9 },
  md: { font: 11, padY: 5, gap: 10, tracking: 0.11, tick: 12 },
  lg: { font: 13, padY: 7, gap: 12, tracking: 0.13, tick: 14 },
};

/* Semitransparente y con desenfoque detrás: se sigue leyendo de una, pero deja
   ver la foto por debajo en vez de taparla con una franja maciza. */
const BAND_CLASS =
  "relative flex items-center justify-center gap-1.5 overflow-hidden border-y " +
  "border-white/20 bg-gradient-to-r from-sky-600/65 via-blue-500/60 to-sky-600/65 " +
  "text-white backdrop-blur-[2px] shadow-[0_4px_14px_rgba(2,132,199,0.28)]";

/* Franjas diagonales muy suaves: dan el aire de cinta de seguridad sin tocar
   la legibilidad del texto. */
const STRIPES: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(115deg, rgba(255,255,255,0.13) 0 10px, rgba(255,255,255,0) 10px 22px)",
};

type Props = {
  /** Escala de la banda. "sm" en tarjetas, "md" en galerías, "lg" en el lightbox. */
  size?: BandSize;
  /** Texto de la banda. */
  text?: string;
  /** Colócala en el flujo (dentro del bloque inferior) en vez de anclarla a la foto. */
  inline?: boolean;
  className?: string;
};

export default function VerifiedBand({
  size = "md",
  text = "PERFIL VERIFICADO",
  inline = false,
  className = "",
}: Props) {
  const preset = PRESETS[size];

  const content = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={STRIPES}
      />
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
        className="relative shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span
        className="relative whitespace-nowrap font-extrabold uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
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
          /* Sangra el padding del bloque de información para llegar a los dos
             bordes de la foto sin depender de cuánto padding tenga. */
          width: "calc(100% + 2 * var(--verified-band-bleed, 0px))",
          marginLeft: "calc(-1 * var(--verified-band-bleed, 0px))",
          marginTop: preset.gap,
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
          /* Pegada al borde de abajo de la foto. */
          bottom: 0,
          width: "100%",
          transform: "translateX(-50%)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
