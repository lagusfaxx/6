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
    <div className="mx-auto w-full max-w-5xl grid gap-6">
      <div className="card p-6">
        <h1 className="text-3xl font-semibold">Cuenta</h1>
        <p className="mt-2 text-sm text-white/70">Resumen de tu perfil y accesos principales.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-white/60">Cargando...</div>
      ) : user ? (
        <div className="grid gap-6">
          <div className="card p-6">
            <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <Avatar src={user.avatarUrl} alt={user.displayName || user.username} size={96} className="border-white/20" />
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-2xl font-semibold leading-tight">{user.displayName || user.username}</div>
                  <Badge>{profileLabel}</Badge>
                </div>
                <div className="text-sm text-white/60">@{user.username}</div>
                <p className="text-sm text-white/70">
                  {canManageProfile ? "Vista previa de tu perfil público y accesos principales." : "Resumen de tu cuenta y accesos principales."}
                </p>
                {canManageProfile ? (
                  <Link href={publicProfileUrl} className="btn-primary w-fit">
                    Ver mi perfil público
                  </Link>
                ) : (
                  <Link href="/servicios" className="btn-primary w-fit">
                    Explorar servicios
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold">Accesos principales</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {canManageProfile ? (
                <>
                  <Link href="/dashboard/services?tab=perfil" className="btn-ghost w-full">Editar perfil</Link>
                  <Link href="/dashboard/services?tab=servicios" className="btn-ghost w-full">
                    Gestionar servicio
                  </Link>
                  {profileType === "SHOP" ? (
                    <Link href="/dashboard/services?tab=productos" className="btn-ghost w-full">Productos</Link>
                  ) : null}
                  <Link href="/dashboard/services?tab=galeria" className="btn-ghost w-full">
                    Galería
                  </Link>
                  <Link href="/dashboard/services?tab=ubicacion" className="btn-ghost w-full">
                    Ubicación
                  </Link>
                  <Link href="/chats" className="btn-ghost w-full">Chats</Link>
                </>
              ) : (
                <>
                  <Link href="/favoritos" className="btn-ghost w-full">Favoritos</Link>
                  <Link href="/servicios" className="btn-ghost w-full">Solicitudes</Link>
                  <Link href="/chats" className="btn-ghost w-full">Chats</Link>
                </>
              )}
              <button onClick={handleLogout} className="btn-ghost w-full">Cerrar sesión</button>
            </div>
          </div>
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
