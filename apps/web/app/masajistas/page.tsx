import { Suspense } from "react";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata = { title: "Masajistas en Chile | Uzeed" };

export default function MasajistasPage() {
  return (
    <Suspense>
      <DirectoryPage
        entityType="professional"
        categorySlug="masajes"
        title="Masajistas"
      />
    </Suspense>
  );
}
