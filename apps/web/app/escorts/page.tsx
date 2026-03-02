import { Suspense } from "react";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata = { title: "Escorts en Chile | Uzeed" };

export default function EscortsPage() {
  return (
    <Suspense>
      <DirectoryPage
        entityType="professional"
        categorySlug="escort"
        title="Escorts"
      />
    </Suspense>
  );
}
