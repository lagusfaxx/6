"use client";

import Link from "next/link";
import useMe from "../../hooks/useMe";

export default function AdminIndex() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-white">
      <h1 className="text-2xl font-semibold">Panel Admin</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/pricing" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
          <div className="text-lg font-semibold">Precios</div>
          <div className="text-sm text-white/70">Planes y reglas.</div>
        </Link>
        <Link href="/admin/banners" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
          <div className="text-lg font-semibold">Banners Home</div>
          <div className="text-sm text-white/70">Publicidad lateral gestionable.</div>
        </Link>
      </div>
    </div>
  );
}
