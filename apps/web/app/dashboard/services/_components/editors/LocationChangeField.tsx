"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "../../../../../lib/api";
import MapboxAddressAutocomplete from "../../../../../components/MapboxAddressAutocomplete";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type LocationChangeRequest = {
  id: string;
  requestedAddress: string;
  requestedCity: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type LocationChangeState = {
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  locked: boolean;
  request: LocationChangeRequest | null;
};

type Selection = {
  address: string;
  city: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Ubicación bloqueada de una profesional. La comuna es lo que sale en la ficha
 * y en los listados por zona, así que una vez fijada el cambio se pide y lo
 * revisa el equipo, igual que el número y el nombre.
 */
export function useLocationChange() {
  const [state, setState] = useState<LocationChangeState | null>(null);

  async function load() {
    try {
      setState(await apiFetch<LocationChangeState>("/profile/location-change"));
    } catch {
      // Sin respuesta se deja el editor abierto: el backend igual bloquea.
      setState(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { state, reload: load };
}

export default function LocationChangeField({
  state,
  reload,
}: {
  state: LocationChangeState;
  reload: () => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pending = state.request?.status === "PENDING" ? state.request : null;
  const rejected = state.request?.status === "REJECTED" ? state.request : null;

  async function submit() {
    if (sending || !selection) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch("/profile/location-change", {
        method: "POST",
        body: JSON.stringify({
          address: selection.address,
          city: selection.city,
          latitude: selection.latitude,
          longitude: selection.longitude,
          reason: reason.trim() || null,
        }),
      });
      setModalOpen(false);
      setQuery("");
      setSelection(null);
      setReason("");
      setNotice("Solicitud enviada. El equipo la revisará pronto.");
      reload();
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    if (!pending || sending) return;
    setSending(true);
    try {
      await apiFetch(`/profile/location-change/${pending.id}/cancel`, { method: "POST" });
      setNotice("Solicitud retirada.");
      reload();
    } catch {
      setError("No se pudo retirar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        Dirección y comuna
        <Lock className="h-3 w-3" />
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <span className="min-w-0 flex-1 text-sm text-white/80">
          <span className="font-semibold">{state.city || "Sin comuna"}</span>
          {state.address ? <span className="text-white/50"> · {state.address}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => {
            setModalOpen(true);
            setError(null);
          }}
          disabled={Boolean(pending)}
          className="shrink-0 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20 disabled:opacity-40"
        >
          Solicitar cambio
        </button>
      </div>

      {pending ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            En revisión: <strong>{pending.requestedCity || pending.requestedAddress}</strong>
          </span>
          <button
            type="button"
            onClick={cancel}
            disabled={sending}
            className="ml-auto text-amber-300/80 underline underline-offset-2 hover:text-amber-200 disabled:opacity-40"
          >
            Retirar
          </button>
        </div>
      ) : rejected ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-200">
          Tu última solicitud ({rejected.requestedCity || rejected.requestedAddress}) fue rechazada
          {rejected.adminNote ? `: ${rejected.adminNote}` : "."}
        </p>
      ) : (
        <span className="text-[11px] text-white/30">
          Es la zona donde te encuentran los clientes, por eso el cambio lo revisa el equipo.
        </span>
      )}

      {notice && <span className="text-[11px] text-emerald-300">{notice}</span>}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e0b16] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Solicitar cambio de ubicación</h3>
                <p className="mt-1 text-[11px] text-white/40">Actual: {state.city || state.address || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
                className="rounded-full bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <MapboxAddressAutocomplete
                label="Nueva dirección"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setSelection(null);
                }}
                onSelect={(s) => {
                  setQuery(s.placeName);
                  setSelection({
                    address: s.placeName,
                    city: s.city || null,
                    latitude: s.latitude,
                    longitude: s.longitude,
                  });
                }}
                placeholder="Busca y selecciona tu nueva dirección"
                required
              />
              <div className="grid gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                  Motivo
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Cuéntanos por qué necesitas cambiarla (ej: me mudé de comuna)"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-fuchsia-500/40"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={sending || !selection}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Enviar solicitud
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
