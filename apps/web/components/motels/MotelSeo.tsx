import Link from "next/link";
import { COMUNAS, type Comuna } from "../../lib/comunas";

/** JSON-LD en un <script>. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function breadcrumbLd(items: Array<{ name: string; path?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `https://uzeed.cl${it.path}` } : {}),
    })),
  };
}

export function Breadcrumbs({ items }: { items: Array<{ name: string; path?: string }> }) {
  return (
    <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1.5 text-[13px] text-white/45">
      {items.map((it, i) => (
        <span key={it.name} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/25">/</span>}
          {it.path ? (
            <Link href={it.path} className="transition hover:text-white">{it.name}</Link>
          ) : (
            <span className="text-white/70">{it.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * "Moteles por comuna": enlaces internos a todas las landings. Es lo que lleva
 * a Google (y a la gente) de /moteles a /moteles/providencia, /moteles/maipu...
 */
export function ComunaLinks({ counts, current }: { counts: Map<string, number>; current?: string }) {
  const groups = new Map<string, Comuna[]>();
  for (const c of COMUNAS) {
    if (c.isMetro || c.slug === current) continue;
    const key = c.region === "Región Metropolitana" ? "Santiago y Región Metropolitana" : "Otras ciudades";
    groups.set(key, [...(groups.get(key) || []), c]);
  }
  return (
    <section className="mx-auto mt-14 max-w-7xl border-t border-white/[0.06] pt-10">
      <h2 className="text-lg font-semibold text-white/90">Moteles por comuna</h2>
      {Array.from(groups.entries()).map(([group, list]) => (
        <div key={group} className="mt-5">
          <h3 className="text-sm font-medium text-white/50">{group}</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((c) => {
              const n = counts.get(c.slug) || 0;
              return (
                <li key={c.slug}>
                  <Link href={`/moteles/${c.slug}`} className="text-[13px] text-white/60 transition hover:text-fuchsia-200">
                    Moteles en {c.name}
                    {n > 0 && <span className="text-white/35"> ({n})</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <section className="mx-auto mt-12 max-w-3xl">
      <h2 className="text-lg font-semibold text-white/90">Preguntas frecuentes</h2>
      <div className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {items.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none text-[15px] font-medium text-white/85 marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span className="text-white/35 transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{f.a}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
    </section>
  );
}

/** Preguntas de la landing, con el nombre de la comuna o ciudad. */
export function motelFaq(place: string, stats: { count: number; minPrice: number | null }) {
  const price = stats.minPrice ? `$${stats.minPrice.toLocaleString("es-CL")}` : null;
  return [
    {
      q: `¿Cuánto cuesta un motel en ${place}?`,
      a: price
        ? `En UZEED los moteles de ${place} parten desde ${price} por 3 horas. Cada ficha muestra las tarifas por 3 horas, 6 horas y noche, y las promociones vigentes.`
        : `Cada ficha de UZEED muestra las tarifas por 3 horas, 6 horas y noche de cada motel en ${place}, con las promociones vigentes.`,
    },
    {
      q: `¿Cómo reservo un motel en ${place}?`,
      a: `Elige el motel, la habitación, la duración y la hora de llegada, y envía la solicitud. El motel la acepta por el chat de UZEED y te entrega un código de reserva. No pagas nada por adelantado en UZEED.`,
    },
    {
      q: `¿Hay moteles con jacuzzi en ${place}?`,
      a: `Sí. Usa el filtro "Jacuzzi" del directorio para ver sólo los moteles de ${place} con habitaciones con jacuzzi. También puedes filtrar por estacionamiento privado, habitaciones temáticas o atención 24 horas.`,
    },
    {
      q: "¿Los moteles son discretos?",
      a: "Las fichas indican si el motel tiene estacionamiento privado e ingreso discreto. En UZEED tu solicitud de reserva y el chat con el motel son privados.",
    },
  ];
}
