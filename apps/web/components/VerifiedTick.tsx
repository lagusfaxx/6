import type { AriaAttributes } from "react";

/**
 * Check de "perfil verificado": el mismo sello celeste de las tarjetas del
 * inicio. Toda insignia de verificación usa este icono y este color para que
 * se lea igual en el inicio, el directorio y la ficha.
 */
export const VERIFIED_COLOR = "#38bdf8";

export default function VerifiedTick({
  className = "h-3.5 w-3.5",
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: AriaAttributes["aria-hidden"];
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      {...(ariaHidden === true || ariaHidden === "true" ? { "aria-hidden": true } : { role: "img", "aria-label": "Verificada" })}
    >
      <path
        fill={VERIFIED_COLOR}
        d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z"
      />
      <path
        d="m8 12.2 2.7 2.7L16.2 9.4"
        fill="none"
        stroke="#04121c"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
