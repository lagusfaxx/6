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
  const role = (user?.role || "").toUpperCase();
  const isMotelProfile = profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);
  const profileLabel =
    profileType === "PROFESSIONAL"
      ? "Experiencia"
      : profileType === "ESTABLISHMENT"
        ? "Lugar"
        : profileType === "SHOP"
          ? "Tienda"
          : "Cliente";

  const publicProfileUrl = user
    ? profileType === "PROFESSIONAL"
      ? `/profesional/${user.id}`
      : profileType === "ESTABLISHMENT"
        ? `/establecimiento/${user.id}`
        : profileType === "SHOP"
          ? `/sexshop/${user.username}`
          : "/"
    : "/";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {loading ? (
        <div className="card p-6 text-white/60">Cargando...</div>
      ) : user ? (
        <>
          {/* Profile card */}
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar src={user.avatarUrl} alt={user.displayName || user.username} size={88} className="border-2 border-white/20" />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-xl font-semibold leading-tight">{user.displayName || user.username}</h1>
                <Badge>{profileLabel}</Badge>
              </div>
              <p className="mt-1 text-sm text-white/50">@{user.username}</p>
              <p className="mt-2 text-sm text-white/60">
                {canManageProfile ? "Vista previa de tu perfil público y accesos." : "Resumen de tu cuenta y accesos."}
              </p>
              <div className="mt-4">
                {canManageProfile ? (
                  <Link href={publicProfileUrl} className="btn-primary">
                    Ver mi perfil público
                  </Link>
                ) : (
                  <Link href="/servicios" className="btn-primary">
                    Explorar servicios
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Accesos principales</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {canManageProfile ? (
                <>
                  {isMotelProfile ? (
                    <>
                      <Link href="/dashboard/motel" className="btn-ghost w-full">Dashboard Motel</Link>
                      <Link href="/dashboard/motel?tab=bookings" className="btn-ghost w-full">Reservas</Link>
                      <Link href="/dashboard/motel?tab=rooms" className="btn-ghost w-full">Habitaciones</Link>
                      <Link href="/dashboard/motel?tab=promos" className="btn-ghost w-full">Promociones</Link>
                      <Link href="/dashboard/motel?tab=location" className="btn-ghost w-full">Ubicación</Link>
                    </>
                  ) : (
                    <>
                      <Link href="/dashboard/services?tab=perfil" className="btn-ghost w-full">Editar perfil</Link>
                      <Link href="/dashboard/services?tab=servicios" className="btn-ghost w-full">
                        Gestionar servicio
                      </Link>
                    </>
                  )}
                  {profileType === "SHOP" && !isMotelProfile && (
                    <Link href="/dashboard/services?tab=productos" className="btn-ghost w-full">Productos</Link>
                  )}
                  {!isMotelProfile && (
                    <>
                      <Link href="/dashboard/services?tab=galeria" className="btn-ghost w-full">Galería</Link>
                      <Link href="/dashboard/services?tab=ubicacion" className="btn-ghost w-full">Ubicación</Link>
                    </>
                  )}
                  <Link href="/chats" className="btn-ghost w-full">Chats</Link>
                </>
              ) : (
                <>
                  <Link href="/favoritos" className="btn-ghost w-full">Favoritos</Link>
                  <Link href="/servicios" className="btn-ghost w-full">Solicitudes</Link>
                  <Link href="/chats" className="btn-ghost w-full">Chats</Link>
                </>
              )}
            </div>
            <button onClick={handleLogout} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/60 hover:bg-white/10 transition">
              Cerrar sesión
            </button>
          </div>
        </>
      ) : (
        <div className="card p-6 text-center">
          <h1 className="text-xl font-semibold">Accede para guardar favoritos y chatear</h1>
          <p className="mt-2 text-sm text-white/60">
            Si solo quieres consumir servicios, crea cuenta Cliente. Si quieres publicar, usa registro profesional/comercio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary">Iniciar sesión</Link>
            <Link href="/register" className="btn-secondary">Crear cuenta</Link>
          </div>
        </div>
      )}
    </div>
  );
}
