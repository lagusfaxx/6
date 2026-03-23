import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../../components/DirectoryPage";

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const label = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
  const title = `Escorts ${label} en Chile - Perfiles Verificados`;
  const description = `Encuentra escorts ${label.toLowerCase()} en Santiago, Las Condes, Providencia y todo Chile. Perfiles verificados con fotos reales y disponibilidad hoy en UZEED.`;
  return {
    title,
    description,
    keywords: [`escorts ${label.toLowerCase()}`, `escorts ${label.toLowerCase()} chile`, `putas ${label.toLowerCase()} santiago`, `${label.toLowerCase()} escorts`],
    alternates: { canonical: `/escorts/${tag}` },
    openGraph: {
      title: `${title} | UZEED`,
      description,
      url: `https://uzeed.cl/escorts/${tag}`,
      type: "website",
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

  return (
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
  );
}
