"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy /umate/plans page.
 *
 * U-Mate no longer uses global SILVER/GOLD/DIAMOND plans — every creator now
 * sets her own monthly subscription price (OnlyFans-style). This page
 * redirects any old links to the creators directory where users can pick a
 * specific profile and subscribe directly.
 */
export default function UmatePlansLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/umate/creators");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
      <p className="text-xs text-white/40">Redirigiendo a las creadoras...</p>
    </div>
  );
}
