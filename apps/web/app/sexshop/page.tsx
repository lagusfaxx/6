import { Suspense } from "react";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata = { title: "Sex Shop en Chile | Uzeed" };

export default function SexShopPage() {
  return (
    <Suspense>
      <DirectoryPage
        key="sexshop"
        entityType="shop"
        categorySlug="sexshop"
        title="Sex Shop"
      />
    </Suspense>
  );
}
