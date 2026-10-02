"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Landmark, Loader2, MessageCircle, X } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

type Transfer = {
  id: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  subscriber: { id: string; username: string; email: string | null; displayName: string | null; phone?: string | null };
};

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Transferencias de membresía pendientes: el comprobante llega por WhatsApp
 *  y aquí se aprueba (30 días de membresía) o se rechaza. */
export default function TransfersAdmin() {
  const [items, setItems] = useState<Transfer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch<Transfer[]>("/admin/billing/transfers")
      .then(setItems)
      .catch((e) => setError(friendlyErrorMessage(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (t: Transfer, action: "approve" | "reject") => {
    let reason: string | null = null;
    if (action === "reject") {
      reason = window.prompt(`Motivo del rechazo para @${t.subscriber.username}:`);
      if (reason === null) return;
    }
    setBusy(t.id);
    setError("");
    try {
      await apiFetch(`/admin/billing/transfers/${t.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Landmark className="h-4 w-4 text-sky-300" /> Transferencias pendientes
      </h2>
      <p className="mt-1 text-xs text-white/45">
        El comprobante llega al WhatsApp configurado arriba. Al aprobar se suman 30 días de membresía.
      </p>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {!items ? (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/[0.04]" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">No hay transferencias por revisar.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/10">
          {items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {t.subscriber.displayName || t.subscriber.username}{" "}
                  <span className="font-normal text-white/45">@{t.subscriber.username}</span>
                </p>
                <p className="flex items-center gap-1 text-[11px] text-white/40">
                  {t.notes?.includes("WhatsApp") && <MessageCircle className="h-3 w-3 text-emerald-300" />}
                  {clp(t.amount)} · {fecha(t.createdAt)}
                  {t.subscriber.email ? ` · ${t.subscriber.email}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => act(t, "approve")}
                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
              >
                {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Aprobar
              </button>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => act(t, "reject")}
                className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" /> Rechazar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
