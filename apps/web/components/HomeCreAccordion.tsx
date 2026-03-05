const creItems = [
  {
    title: "Cómo funciona",
    lines: [
      "Explora perfiles y servicios cerca de ti.",
      "Envía una solicitud.",
      "La profesional decide si acepta o rechaza.",
      "Si acepta, se habilita el contacto para coordinar.",
    ],
  },
  {
    title: "Contacto protegido",
    lines: [
      "El WhatsApp no se muestra al inicio.",
      "Se libera solo cuando la solicitud es aceptada.",
      "Esto reduce spam y protege a las profesionales.",
    ],
  },
  {
    title: "Verificaciones",
    lines: [
      "UZEED puede mostrar etiquetas asignadas por administración (por ejemplo: Verificada, Premium, Exámenes).",
      "Estas etiquetas solo las asigna un administrador.",
    ],
  },
  {
    title: "Privacidad y confidencialidad",
    lines: [
      "Tus datos se mantienen privados.",
      "La ubicación se muestra de forma aproximada (sin direcciones exactas).",
      "La coordinación final ocurre de manera directa entre las partes.",
    ],
  },
] as const;

export default function HomeCreAccordion() {
  return (
    <section className="mx-auto mt-10 w-full max-w-5xl">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.4)] backdrop-blur-xl sm:p-6 md:p-8">
        <div className="mb-5 border-b border-white/10 pb-4 sm:mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300/90">CRE</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">CRE</h2>
          <p className="mt-2 text-sm text-white/65 sm:text-base">
            Cómo funciona UZEED, qué tan seguro es y por qué es confidencial.
          </p>
        </div>

        <div className="space-y-3">
          {creItems.map((item) => (
            <details
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors open:border-fuchsia-400/40 open:bg-fuchsia-500/[0.06]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-white sm:text-base">
                {item.title}
                <span className="text-lg leading-none text-white/60 transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>

              <ul className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm leading-relaxed text-white/70">
                {item.lines.map((line) => (
                  <li key={line} className="pl-3 before:mr-2 before:text-white/40 before:content-['•']">
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
