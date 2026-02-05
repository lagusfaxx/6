"use client";

import Link from "next/link";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";

export default function AccountPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes((user?.profileType || "").toUpperCase());

  return (
    <div className="mx-auto w-full max-w-5xl grid gap-6">
      <div className="card p-6">
        <h1 className="text-3xl font-semibold">Cuenta</h1>
        <p className="mt-2 text-sm text-white/70">Gestiona tu sesión, perfil y accesos rápidos.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-white/60">Cargando...</div>
      ) : user ? (
        <div className="grid gap-4">
          <div className="card p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="text-sm text-white/60">Usuario</div>
                <div className="mt-1 text-2xl font-semibold leading-tight">{user.displayName || user.username}</div>
                <div className="text-sm text-white/50 mt-1">Perfil: {user.profileType}</div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {canManageProfile ? (
                  <Link href="/dashboard/services" className="btn-primary">Gestionar perfil y servicios</Link>
                ) : (
                  <Link href="/servicios" className="btn-primary">Explorar servicios</Link>
                )}
                <Link href="/chats" className="btn-secondary">Chats</Link>
                <button onClick={handleLogout} className="btn-secondary">Cerrar sesión</button>
              </div>
            </div>
          </div>

          {canManageProfile ? (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Panel profesional/comercio</h2>
              <p className="mt-2 text-sm text-white/70">
                Desde aquí gestionas foto de perfil/portada, edad, género, descripción y tus servicios/productos.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card p-6">
          <div className="text-sm text-white/60">No has iniciado sesión</div>
          <h2 className="mt-1 text-xl font-semibold">Accede para guardar favoritos y chatear</h2>
          <p className="mt-2 text-sm text-white/70">
            Si solo quieres consumir servicios, crea cuenta Cliente. Si quieres publicar, usa registro profesional/comercio.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">Iniciar sesión</Link>
            <Link href="/register" className="btn-secondary">Crear cuenta</Link>
          </div>
        </div>
      )}
    </div>
  );
}
