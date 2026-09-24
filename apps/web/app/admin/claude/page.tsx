"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Loader2, ShieldOff } from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { isFullAdmin } from "../../../lib/adminAccess";

type Access = {
  id: string;
  usuario: { email: string; displayName: string | null; role: string } | null;
  aplicacion: string;
  destino: string[];
  permisos: string[];
  autorizadoEl: string | null;
  venceEl: string;
  ultimoUso: string | null;
  ultimaIp: string | null;
};

type LogRow = {
  id: string;
  tool: string;
  scope: string;
  usuario: string | null;
  ip: string | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
};

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Accesos de Claude (MCP) al panel. Cada acceso nace de una autorización con
 * 2FA y dura hasta 30 días; desde aquí se corta uno o todos. Abajo, la
 * bitácora: cada llamada de Claude y cada evento de autorización.
 */
export default function AdminClaudePage() {
  const { me, loading } = useMe();
  const canManage = isFullAdmin(me?.user);
  const [accesses, setAccesses] = useState<Access[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const [a, b] = await Promise.all([
        apiFetch<{ accesos: Access[] }>("/admin/mcp/accesos"),
        apiFetch<{ registros: LogRow[] }>("/admin/mcp/bitacora?limit=100"),
      ]);
      setAccesses(a?.accesos ?? []);
      setLog(b?.registros ?? []);
    } catch {
      setError("No se pudieron cargar los accesos.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && canManage) load();
  }, [loading, canManage, load]);

  async function revoke(id: string) {
    setError(null);
    setNotice(null);
    setBusy(id);
    try {
      await apiFetch(`/admin/mcp/accesos/${id}/revocar`, { method: "POST" });
      setNotice("Acceso revocado. Claude tendrá que volver a pedir autorización.");
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo revocar.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeAll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("all");
    try {
      const res = await apiFetch<{ revocados: number }>("/admin/mcp/revocar-todo", {
        method: "POST",
        headers: { "x-2fa-code": mfaCode },
      });
      setMfaCode("");
      setNotice(`Se revocaron todos los accesos (${res?.revocados ?? 0} tokens).`);
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo revocar. Revisa el código 2FA.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Cargando...</div>;
  }
  if (!canManage) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al panel
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <Bot className="h-6 w-6 text-fuchsia-300" />
          <div>
            <h1 className="text-xl font-semibold">Claude (MCP)</h1>
            <p className="text-sm text-white/50">
              Quién tiene Claude conectado al panel. Cada acceso se autoriza con 2FA y vence a los 30 días.
            </p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Accesos activos</h2>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : accesses.length === 0 ? (
            <p className="text-sm text-white/50">No hay accesos activos.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {accesses.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{a.aplicacion} <span className="text-white/40">· {a.destino.join(", ")}</span></div>
                    <div className="text-white/55">
                      {a.usuario?.email ?? "cuenta eliminada"} · {a.permisos.includes("mcp:write") ? "lectura y acciones" : "sólo lectura"}
                    </div>
                    <div className="text-xs text-white/40">
                      Autorizado {fmt(a.autorizadoEl)} · último uso {fmt(a.ultimoUso)} {a.ultimaIp ? `desde ${a.ultimaIp}` : ""} · vence {fmt(a.venceEl)}
                    </div>
                  </div>
                  <button
                    onClick={() => revoke(a.id)}
                    disabled={busy === a.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                    Revocar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={revokeAll} className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-center">
            <span className="text-xs text-white/50 sm:flex-1">¿Sospechas algo? Corta todos los accesos de una vez (pide tu código 2FA).</span>
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="Código 2FA"
              className="w-32 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center text-sm tracking-widest"
            />
            <button
              type="submit"
              disabled={mfaCode.length !== 6 || busy === "all"}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              Revocar todo
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Bitácora (últimos 100)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-white/40">
                <tr><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3">Evento</th><th className="py-1 pr-3">Cuenta</th><th className="py-1 pr-3">IP</th><th className="py-1">Estado</th></tr>
              </thead>
              <tbody className="text-white/70">
                {log.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap py-1.5 pr-3">{fmt(r.createdAt)}</td>
                    <td className="py-1.5 pr-3 font-mono">{r.tool}</td>
                    <td className="py-1.5 pr-3">{r.usuario ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.ip ?? "—"}</td>
                    <td className={`py-1.5 ${r.ok ? "text-emerald-300" : "text-red-300"}`}>{r.ok ? "ok" : "falló"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
