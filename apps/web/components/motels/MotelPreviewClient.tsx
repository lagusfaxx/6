"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import MotelDetailView from "./MotelDetailView";
import { apiFetch } from "../../lib/api";
import type { MotelDetail } from "../../lib/motels";

/**
 * Cuando el servidor no encuentra la ficha (oculta, en revisión o inexistente)
 * se vuelve a pedir con la sesión del navegador: si quien mira es el dueño,
 * ve su vista previa; si no, "no encontrado".
 */
export default function MotelPreviewClient({ slug }: { slug: string }) {
  const [state, setState] = useState<{ loading: boolean; motel: MotelDetail | null }>({ loading: true, motel: null });

  useEffect(() => {
    apiFetch<{ motel: MotelDetail }>(`/motels/page/${encodeURIComponent(slug)}`)
      .then((r) => setState({ loading: false, motel: r?.motel || null }))
      .catch(() => setState({ loading: false, motel: null }));
  }, [slug]);

  if (state.loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 pt-6">
        <div className="h-8 w-64 rounded-lg bg-white/[0.05]" />
        <div className="aspect-[16/7] rounded-3xl bg-white/[0.04]" />
      </div>
    );
  }

  if (!state.motel) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <Building2 className="mx-auto h-10 w-10 text-white/25" />
          <h1 className="mt-3 text-xl font-semibold">Este motel no está disponible</h1>
          <p className="mt-1 text-sm text-white/50">Puede que ya no esté publicado. Mira los demás moteles del directorio.</p>
          <Link href="/moteles" className="btn-primary mt-5 px-5 py-2.5 text-sm">Ver moteles</Link>
        </div>
      </div>
    );
  }

  return <MotelDetailView motel={state.motel} />;
}
