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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/verification" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 hover:bg-amber-500/10 transition">
          <div className="text-lg font-semibold text-amber-200">Verificacion de Perfiles</div>
          <div className="text-sm text-amber-200/70">Aprobar o rechazar perfiles pendientes de verificacion telefonica.</div>
        </Link>
        <Link href="/admin/profiles" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
          <div className="text-lg font-semibold">Perfiles</div>
          <div className="text-sm text-white/70">Activar, desactivar y eliminar perfiles.</div>
        </Link>
        <Link href="/admin/banners" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
          <div className="text-lg font-semibold">Banners Publicitarios</div>
          <div className="text-sm text-white/70">Fotos y videos promocionales.</div>
        </Link>
        <Link href="/admin/pricing" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
          <div className="text-lg font-semibold">Precios</div>
          <div className="text-sm text-white/70">Planes y reglas.</div>
        </Link>
      </div>
    </div>
  );
}
