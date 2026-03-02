import { Suspense } from "react";
import DirectoryPage from "../../../components/DirectoryPage";

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props) {
  const { tag } = await params;
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);
  return { title: `Escorts ${label} en Chile | Uzeed` };
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
          entityType="professional"
          categorySlug="escort"
          title={`Escorts ${label}`}
          // maduras is a search param, not a manual tag
        />
      ) : (
        <DirectoryPage
          entityType="professional"
          categorySlug="escort"
          title={`Escorts ${label}`}
          tag={tag}
        />
      )}
    </Suspense>
  );
}
