const highlights = [
  {
    text: "Contacto protegido tras aceptación",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-fuchsia-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 4a2 2 0 1 1 4 0v2H8V6Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    text: "Perfiles revisados por administración",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-fuchsia-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1l2.39 4.84L18 6.71l-4 3.9.94 5.5L10 13.47 5.06 16.1 6 10.6l-4-3.9 5.61-.86L10 1Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    text: "Ubicación aproximada, sin dirección exacta",
    icon: (
      <svg className="h-4 w-4 shrink-0 text-fuchsia-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2a5.5 5.5 0 0 0-5.5 5.5C4.5 12.25 10 18 10 18s5.5-5.75 5.5-10.5A5.5 5.5 0 0 0 10 2Zm0 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" fill="currentColor" />
      </svg>
    ),
  },
] as const;

const accordionItems = [
  {
    title: "Cómo funciona",
    lines: [
      "Explora perfiles y servicios cerca de ti.",
      "Envía una solicitud con lo básico (horario/tipo).",
      "La profesional acepta o rechaza.",
      "Si acepta, se habilita el contacto para coordinar.",
      "UZEED coordina el contacto; no intermedia pagos.",
    ],
  },
  {
    title: "Contacto protegido",
    lines: [
      "El número no se muestra públicamente.",
      "El contacto se habilita solo tras aceptación.",
      "Esto reduce spam y protege a las profesionales.",
      "Límites de solicitudes y opciones de bloquear/reportar.",
    ],
  },
  {
    title: "Verificaciones",
    lines: [
      "Verificada: perfil revisado por administración.",
      "Premium: perfiles seleccionados para la sección Premium.",
      "Exámenes: etiqueta asignada por administración según documentación.",
      "Solo administración puede asignar estas etiquetas.",
    ],
  },
  {
    title: "Privacidad y confidencialidad",
    lines: [
      "Ubicación aproximada (no dirección exacta).",
      "Datos protegidos y control de visibilidad.",
      "Coordinación final directa entre las partes tras aceptación.",
    ],
  },
] as const;

export default function HomeCreAccordion() {
  return (
    <section className="mx-auto mt-8 w-full max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-md sm:p-5 md:p-6">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Guía rápida
          </h2>
          <p className="mt-1.5 text-sm text-white/65 sm:text-[15px]">
            Cómo funciona UZEED y cómo protegemos el contacto.
          </p>
        </div>

        {/* Highlights — pills */}
        <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {highlights.map((h) => (
            <div
              key={h.text}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/[0.08]"
            >
              {h.icon}
              <span className="text-sm text-white/80">{h.text}</span>
            </div>
          ))}
        </div>

        {/* FAQ accordion */}
        <div className="divide-y divide-white/10">
          {accordionItems.map((item) => (
            <details key={item.title} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-left text-sm font-semibold text-white sm:text-[15px]">
                {item.title}
                <svg
                  className="h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>

              <ul className="pb-3.5 pl-1 space-y-1.5 text-sm leading-relaxed text-white/70">
                {item.lines.map((line) => (
                  <li key={line} className="pl-3 before:mr-2 before:text-fuchsia-400/60 before:content-['•']">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
