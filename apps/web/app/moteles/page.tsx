import { Suspense } from "react";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata = { title: "Moteles y Hoteles en Chile | Uzeed" };

export default function MotelPage() {
  return (
    <Suspense>
      <DirectoryPage
        key="motel"
        entityType="establishment"
        categorySlug="motel"
        title="Moteles y Hoteles"
      />
    </Suspense>
  );
}
