"use client";

import Link from "next/link";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { Badge } from "../../components/ui/badge";

export default function AccountPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const profileType = (user?.profileType || "").toUpperCase();
  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);
  const profileLabel =
    profileType === "PROFESSIONAL"
      ? "Experiencia"
      : profileType === "ESTABLISHMENT"
        ? "Lugar"
        : profileType === "SHOP"
          ? "Tienda"
          : "Cliente";

  return (
    <div className="mx-auto w-full max-w-5xl grid gap-6">
      <div className="card p-6">
        <h1 className="text-3xl font-semibold">Cuenta</h1>
        <p className="mt-2 text-sm text-white/70">Gestiona tu sesión, accesos y paneles desde aquí.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-white/60">Cargando...</div>
      ) : user ? (
        <div className="grid gap-6">
          <div className="card p-6">
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
              <Avatar src={user.avatarUrl} alt={user.displayName || user.username} size={72} className="border-white/20" />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold leading-tight">{user.displayName || user.username}</div>
                  <Badge>{profileLabel}</Badge>
                </div>
                <div className="mt-1 text-sm text-white/60">@{user.username}</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
                {canManageProfile ? (
                  <Link href="/dashboard/services" className="btn-primary w-full sm:w-auto">Gestionar perfil</Link>
                ) : (
                  <Link href="/servicios" className="btn-primary w-full sm:w-auto">Explorar servicios</Link>
                )}
                {profileType === "PROFESSIONAL" ? (
                  <Link href="/dashboard/services" className="btn-secondary w-full sm:w-auto">Gestionar servicios</Link>
                ) : null}
                {profileType === "SHOP" ? (
                  <Link href="/dashboard/services" className="btn-secondary w-full sm:w-auto">Gestionar productos</Link>
                ) : null}
                {profileType === "ESTABLISHMENT" ? (
                  <Link href="/dashboard/services" className="btn-secondary w-full sm:w-auto">Gestionar habitaciones/ofertas</Link>
                ) : null}
                <Link href="/chats" className="btn-secondary w-full sm:w-auto">Chats</Link>
                <button onClick={handleLogout} className="btn-secondary w-full sm:w-auto">Cerrar sesión</button>
              </div>
            </div>
          </div>

          {canManageProfile ? (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Panel profesional y comercio</h2>
              <p className="mt-2 text-sm text-white/70">
                Administra tu perfil público, servicios o productos, galería y ubicación con feedback inmediato.
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
