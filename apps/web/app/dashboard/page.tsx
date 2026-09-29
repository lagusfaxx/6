"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useMe from "../../hooks/useMe";
import { businessPanelHref } from "../../lib/businessPanel";

/* "Dashboard" lleva al panel de cada tipo de cuenta: locales y tiendas tienen
   el suyo; el resto entra a su cuenta. */
export default function DashboardPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    router.replace(businessPanelHref(me?.user) || "/cuenta");
  }, [loading, me, router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
    </div>
  );
}
