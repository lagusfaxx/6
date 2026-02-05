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

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Cuenta</h1>
        <p className="mt-2 text-sm text-white/70">Gestiona tu perfil y preferencias.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-white/60">Cargando...</div>
      ) : user ? (
        <div className="card p-6">
          <div className="text-sm text-white/60">Usuario</div>
          <div className="mt-2 text-lg font-semibold">
            {user.displayName || user.username}
          </div>
          <div className="text-xs text-white/50">{user.profileType}</div>
          <div className="mt-4">
            <button onClick={handleLogout} className="btn-secondary">
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          <div className="text-sm text-white/60">Estás navegando como invitado</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">
              Iniciar sesión
            </Link>
            <Link href="/register" className="btn-secondary">
              Crear cuenta
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
