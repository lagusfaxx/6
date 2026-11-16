import Link from "next/link";
import { jsonLdString } from "../lib/jsonLd";
import type { GeoFaq, GeoLink, GeoSeo } from "../lib/geoSeo";

/**
 * Bloque SEO renderizado en el servidor de las landings geográficas
 * (/escorts/{comuna} y /escorts/region-{region}): texto propio, datos de la
 * comuna, preguntas frecuentes y enlaces a comunas vecinas, a la provincia y
 * a la región. Los enlaces son lo que lleva a Google de una comuna a otra:
 * cada una de las 346 queda enlazada desde su región y desde sus vecinas.
 */

const chip =
  "inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition";

export function GeoLinkList({ links, label }: { links: GeoLink[]; label: string }) {
  if (!links.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className={chip}>
            {l.label}
            {typeof l.km === "number" && <span className="text-white/35"> · {l.km < 10 ? l.km.toFixed(1).replace(".", ",") : Math.round(l.km)} km</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function GeoFaqBlock({ faq, withJsonLd = true }: { faq: GeoFaq[]; withJsonLd?: boolean }) {
  if (!faq.length) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <div className="mt-8">
      {withJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />}
      <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas frecuentes</h3>
      {faq.map((f) => (
        <details key={f.question} className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300 transition-colors">
            {f.question}
          </summary>
          <p className="mt-1 pl-4 text-white/50">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function GeoBreadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-white/40">
      {items.map((it, i) => (
        <span key={it.name} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/20">/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-white/80 transition">{it.name}</Link>
          ) : (
            <span className="text-white/60">{it.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * `withFaq` en false cuando la página ya trae su FAQ de copy propio (una sola
 * FAQPage por URL).
 */
export default function GeoSeoSection({
  seo,
  breadcrumbs,
  withFaq = true,
}: {
  seo: GeoSeo;
  breadcrumbs?: { name: string; href?: string }[];
  withFaq?: boolean;
}) {
  return (
    <section className="max-w-4xl mx-auto px-4 pb-10 pt-6 text-white/60 text-sm leading-relaxed">
      {breadcrumbs && <GeoBreadcrumbs items={breadcrumbs} />}
      <h2 className="text-xl font-bold text-white/80 mb-3">{seo.heading}</h2>
      {seo.paragraphs.map((p, i) => (
        <p key={i} className="mb-4">{p}</p>
      ))}

      {seo.facts.length > 0 && (
        <dl className="my-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {seo.facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <dt className="text-xs text-white/40">{f.label}</dt>
              <dd className="text-white/70">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {seo.nearby.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-white/70 mb-3">Escorts en comunas cercanas</h3>
          <GeoLinkList links={seo.nearby} label="Comunas cercanas" />
        </div>
      )}

      {seo.province && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-white/70 mb-3">Otras comunas de la provincia de {seo.province.name}</h3>
          <GeoLinkList links={seo.province.links} label={`Provincia de ${seo.province.name}`} />
        </div>
      )}

      {withFaq && <GeoFaqBlock faq={seo.faq} />}

      {seo.related.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-white/70 mb-3">También te puede interesar</h3>
          <GeoLinkList links={seo.related} label="Enlaces relacionados" />
        </div>
      )}
    </section>
  );
}
