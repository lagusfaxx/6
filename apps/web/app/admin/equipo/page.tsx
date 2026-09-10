"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Loader2,
  ShieldCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { isFullAdmin } from "../../../lib/adminAccess";

type Member = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: "ADMIN" | "MODERATOR";
  isActive: boolean;
  lastSeen: string | null;
  createdAt: string;
};

const MIN_PASSWORD_LENGTH = 10;

/**
 * Alta y baja de cuentas de equipo: entran al panel completo y trabajan —
 * aprueban verificaciones y solicitudes, mueven depósitos y retiros, moderan y
 * editan tarifas — salvo borrar perfiles, cambiar nombres y teléfonos, dar de
 * alta profesionales rápidos, tocar estas cuentas y exportar la base.
 *
 * Los administradores se listan pero no se tocan desde aquí: quitarle el rol a
 * uno por error dejaría el panel sin dueño.
 */
export default function AdminTeamPage() {
  const { me, loading } = useMe();
  const canManage = isFullAdmin(me?.user);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiFetch<{ members: Member[] }>("/admin/team");
      setMembers(res?.members ?? []);
    } catch {
      setError("No se pudo cargar el equipo.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && canManage) load();
  }, [loading, canManage, load]);

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCreating(true);
    try {
      await apiFetch("/admin/team", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password }),
      });
      setNotice(`Cuenta creada para ${email}. Pásale el correo y la contraseña.`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la cuenta.");
    } finally {
      setCreating(false);
    }
  }

  async function setRole(member: Member, role: "MODERATOR" | "USER") {
    setError(null);
    setNotice(null);
    setBusyId(member.id);
    try {
      await apiFetch(`/admin/team/${member.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      setNotice(
        role === "USER"
          ? `${member.displayName || member.email} ya no tiene acceso al panel.`
          : `${member.displayName || member.email} ahora es cuenta de equipo.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo cambiar el rol.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Cargando...
      </div>
    );
  }
  if (!canManage) {
    return <div className="p-6 text-white/70">Acceso restringido.</div>;
  }

  const staff = members.filter((m) => m.role === "MODERATOR");
  const admins = members.filter((m) => m.role === "ADMIN");

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al panel
        </Link>

        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Equipo</h1>
          <p className="mt-1 text-sm text-white/40">
            Cuentas con acceso al panel. Las de equipo resuelven el día a día:
            aprueban verificaciones y solicitudes, revisan depósitos y retiros,
            moderan y editan tarifas. No pueden borrar perfiles, cambiar nombres
            ni teléfonos, crear profesionales rápidos, tocar estas cuentas ni
            exportar la base.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        )}

        {/* ── Alta ── */}
        <section className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-cyan-300" />
            Crear cuenta de equipo
          </h2>
          <form onSubmit={createMember} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/40">
                  Nombre
                </span>
                <input
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                  placeholder="Nombre de la persona"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition placeholder:text-white/25 focus:border-cyan-500/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/40">
                  Correo
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="persona@correo.com"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition placeholder:text-white/25 focus:border-cyan-500/40"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/40">
                Contraseña
              </span>
              <div className="flex gap-2">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition placeholder:text-white/25 focus:border-cyan-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-[38px] w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10"
                  title={showPassword ? "Ocultar" : "Mostrar"}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <span className="mt-1 block text-[11px] text-white/35">
                La cuenta queda lista de inmediato. Pásale el correo y la
                contraseña por un canal privado; ella puede cambiarla después.
              </span>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Crear cuenta
            </button>
          </form>
        </section>

        {/* ── Cuentas de equipo ── */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">
            Cuentas de equipo{" "}
            <span className="text-white/35">({staff.length})</span>
          </h2>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : staff.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/35">
              Todavía no hay cuentas de equipo.
            </p>
          ) : (
            <ul className="space-y-2">
              {staff.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {m.displayName || m.username}
                    </p>
                    <p className="truncate text-xs text-white/40">{m.email}</p>
                  </div>
                  <button
                    disabled={busyId === m.id}
                    onClick={() => setRole(m, "USER")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busyId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" />
                    )}
                    Quitar acceso
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Administradores ── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-fuchsia-300" />
            Administradores{" "}
            <span className="text-white/35">({admins.length})</span>
          </h2>
          <ul className="space-y-2">
            {admins.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <p className="truncate text-sm font-semibold">
                  {m.displayName || m.username}
                </p>
                <p className="truncate text-xs text-white/40">{m.email}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/30">
            Los administradores no se editan desde aquí: es la cuenta que
            sostiene el panel y un clic de más te dejaría afuera.
          </p>
        </section>
      </div>
    </div>
  );
}
