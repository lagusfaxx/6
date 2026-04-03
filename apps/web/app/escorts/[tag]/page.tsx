import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../../components/DirectoryPage";

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const label = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
  const title = `Escorts ${label} en Chile - Verificadas Hoy`;
  const description = `Escorts y putas ${label.toLowerCase()} verificadas en Santiago, Viña del Mar y todo Chile. Fotos reales, contacto directo y disponibilidad hoy en UZEED.`;
  return {
    title,
    description,
    alternates: { canonical: `/escorts/${tag}` },
    openGraph: {
      title: `${title} | UZEED`,
      description,
      url: `https://uzeed.cl/escorts/${tag}`,
      type: "website",
      images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: `UZEED Escorts ${label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | UZEED`,
      description,
      images: ["https://uzeed.cl/brand/isotipo-new.png"],
    },
  };
}

export default async function EscortsTagPage({ params }: Props) {
  const { tag } = await params;

  /* Special auto-computed filters are handled in DirectoryPage / backend:
     - maduras → tag=maduras passed as ?maduras=true to API (age>=40, never manual)
     - All other tags are profileTags or serviceTags
  */
  const isMaduras = tag === "maduras";
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);

  const readableTag = tag.replace(/-/g, " ");

  return (
    <>
      <Suspense>
        {isMaduras ? (
          <DirectoryPage
            key={`escort-maduras`}
            entityType="professional"
            categorySlug="escort"
            title={`Escorts ${label}`}
            // maduras is a search param, not a manual tag
          />
        ) : (
          <DirectoryPage
            key={`escort-${tag}`}
            entityType="professional"
            categorySlug="escort"
            title={`Escorts ${label}`}
            tag={tag}
          />
        )}
      </Suspense>
      {/* Breadcrumb structured data for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
            { "@type": "ListItem", position: 2, name: "Escorts", item: "https://uzeed.cl/escorts" },
            { "@type": "ListItem", position: 3, name: `Escorts ${label}` },
          ],
        }) }}
      />
      {/* Server-rendered SEO text for long-tail indexing */}
      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        <h1 className="text-xl font-bold text-white/80 mb-3">
          Escorts y Acompañantes {label} en Chile
        </h1>
        <p className="mb-4">
          Directorio de escorts y acompañantes {readableTag} verificadas en Chile. Encuentra
          perfiles con fotos reales en Santiago, Las Condes, Providencia, Viña del Mar
          y más de 20 ciudades. Contacto directo por WhatsApp y disponibilidad hoy.
        </p>
        <p>
          Usa los filtros de ubicación, servicios y disponibilidad inmediata para encontrar
          exactamente lo que buscas. Todos los perfiles son verificados con fotos reales.
        </p>
      </section>
    </>
  );
}
