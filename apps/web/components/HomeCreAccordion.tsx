const summaryCards = [
  {
    title: "Contacto protegido",
    text: "El WhatsApp se habilita solo si la solicitud es aceptada.",
  },
  {
    title: "Perfiles revisados",
    text: "Etiquetas como Verificada/Premium solo las asigna administración.",
  },
  {
    title: "Privacidad real",
    text: "Ubicación aproximada. Sin direcciones exactas.",
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
      <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.045] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.42)] backdrop-blur-xl sm:p-5 md:p-6">
        <div className="mb-4 border-b border-white/12 pb-3 sm:mb-5 sm:pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/95">
            CRE · Confidencial · Revisado · Exclusivo
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Guía rápida
          </h2>
          <p className="mt-1.5 text-sm text-white/75 sm:text-[15px]">
            Cómo funciona UZEED, por qué es confidencial y cómo protegemos el contacto.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <div className="grid gap-2.5">
            {summaryCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3"
              >
                <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{card.text}</p>
              </article>
            ))}
          </div>

          <div className="space-y-2.5">
            {accordionItems.map((item) => (
              <details
                key={item.title}
                className="group rounded-2xl border border-white/12 bg-black/20 px-4 py-3 transition-colors open:border-fuchsia-400/45 open:bg-fuchsia-500/[0.06]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-white sm:text-[15px]">
                  {item.title}
                  <svg
                    className="h-4 w-4 shrink-0 text-white/65 transition-transform duration-200 group-open:rotate-180"
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

                <ul className="mt-2.5 space-y-1.5 border-t border-white/12 pt-2.5 text-sm leading-relaxed text-white/78">
                  {item.lines.map((line) => (
                    <li key={line} className="pl-3 before:mr-2 before:text-white/60 before:content-['•']">
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
