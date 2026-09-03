"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import Avatar from "../../../components/Avatar";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type PhoneChange = {
  id: string;
  currentPhone: string | null;
  requestedPhone: string;
  reason: string | null;
  status: Status;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    city: string | null;
    phone: string | null;
    isVerified: boolean;
    isActive: boolean;
    createdAt: string;
  };
  reviewer: { id: string; username: string; displayName: string | null } | null;
};

const TABS: { value: Status; label: string }[] = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "CANCELLED", label: "Retiradas" },
];

export default function AdminPhoneChangesPage() {
  const { me, loading } = useMe();
  const isAdmin = (me?.user?.role ?? "").toUpperCase() === "ADMIN";

  const [status, setStatus] = useState<Status>("PENDING");
  const [requests, setRequests] = useState<PhoneChange[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await apiFetch<{ requests: PhoneChange[]; pendingCount: number }>(
        `/admin/phone-changes?status=${status}`,
      );
      setRequests(res?.requests ?? []);
      setPendingCount(res?.pendingCount ?? 0);
    } catch {
      setError("No se pudieron cargar las solicitudes.");
      setRequests([]);
    } finally {
      setLoadingList(false);
    }
  }, [status]);

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin, load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  async function review(request: PhoneChange, action: "approve" | "reject") {
    setBusyId(request.id);
    setError(null);
    try {
      await apiFetch(`/admin/phone-changes/${request.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: notes[request.id]?.trim() || null }),
      });
      setSuccess(
        action === "approve"
          ? `Número de ${request.user.displayName || request.user.username} actualizado a ${request.requestedPhone}.`
          : `Solicitud de ${request.user.displayName || request.user.username} rechazada.`,
      );
      setNotes((prev) => ({ ...prev, [request.id]: "" }));
      load();
    } catch (e: any) {
      setError(e?.message || "No se pudo procesar la solicitud.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-white">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Phone className="h-5 w-5 text-fuchsia-400" />
            Cambios de número
          </h1>
          <p className="text-xs text-white/40">
            El número queda bloqueado para las profesionales: aquí se aprueban los cambios.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              status === t.value
                ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}

      {loadingList ? (
        <div className="mt-12 flex justify-center text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
          No hay solicitudes en este estado.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={r.user.avatarUrl}
                  alt={r.user.displayName || r.user.username}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/profesional/${r.user.id}`}
                      target="_blank"
                      className="text-sm font-semibold hover:underline"
                    >
                      {r.user.displayName || r.user.username}
                    </Link>
                    {r.user.isVerified && (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        <ShieldCheck className="h-2.5 w-2.5" /> Verificada
                      </span>
                    )}
                    {!r.user.isActive && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
                        Desactivada
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40">
                    @{r.user.username}
                    {r.user.city ? ` · ${r.user.city}` : ""} · registrada{" "}
                    {new Date(r.user.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <span className="text-[11px] text-white/30">
                  {new Date(r.createdAt).toLocaleDateString("es-CL")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm">
                <span className="text-white/45 line-through">{r.currentPhone || "sin número"}</span>
                <ArrowRight className="h-3.5 w-3.5 text-white/30" />
                <span className="font-semibold text-fuchsia-300">{r.requestedPhone}</span>
                {/* El número actual puede haber cambiado desde que se pidió. */}
                {r.status === "PENDING" && r.currentPhone !== r.user.phone && (
                  <span className="text-[11px] text-amber-300">
                    (ahora tiene {r.user.phone || "sin número"})
                  </span>
                )}
              </div>

              {r.reason && (
                <p className="mt-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                  “{r.reason}”
                </p>
              )}

              {r.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Nota para la profesional (opcional, obligatoria si rechazas)"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none transition placeholder:text-white/25 focus:border-fuchsia-500/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(r, "reject")}
                      disabled={busyId === r.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-red-300 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => review(r, "approve")}
                      disabled={busyId === r.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprobar y cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-white/35">
                  {r.status === "APPROVED"
                    ? "Aprobada"
                    : r.status === "REJECTED"
                      ? "Rechazada"
                      : "Retirada por la profesional"}
                  {r.reviewedAt ? ` el ${new Date(r.reviewedAt).toLocaleDateString("es-CL")}` : ""}
                  {r.reviewer ? ` por ${r.reviewer.displayName || r.reviewer.username}` : ""}
                  {r.adminNote ? ` · “${r.adminNote}”` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
