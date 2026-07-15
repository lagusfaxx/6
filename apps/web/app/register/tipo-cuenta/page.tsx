import { Suspense } from "react";
import type { Metadata } from "next";
import GoogleTypeChooserClient from "./GoogleTypeChooserClient";

export const dynamic = "force-dynamic";

// Post-OAuth continuation page — not a public landing page, keep it out of the index.
export const metadata: Metadata = {
  title: "Elige tu tipo de cuenta | UZEED",
  robots: { index: false, follow: false },
};

export default function GoogleTypeChooserPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60" role="status">
          Cargando…
        </div>
      }
    >
      <GoogleTypeChooserClient />
    </Suspense>
  );
}
