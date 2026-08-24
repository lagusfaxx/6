import { Suspense } from "react";
import StoreClient from "./StoreClient";

export default function StorePage({ params }: { params: { username: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando tienda...</div>}>
      <StoreClient username={params.username} />
    </Suspense>
  );
}
