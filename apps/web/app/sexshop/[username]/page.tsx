import { Suspense } from "react";
import SexShopProfileClient from "./SexShopProfileClient";

export default function SexShopProfilePage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando sex shop...</div>}>
      <SexShopProfileClient />
    </Suspense>
  );
}
