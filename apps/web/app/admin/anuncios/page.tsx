"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { apiFetch } from "../../../lib/api";

/*
 * Anuncios de ExoClick: interruptor general y el zoneid de cada espacio.
 * Para agregar un espacio basta crear la zona en ExoClick y pegar acá su
 * número (el data-zoneid del código). Un espacio vacío no se muestra.
 */

type Slot = "homeFeed" | "homeCamsDesktop" | "homeCamsMobile" | "listing";
type Config = { enabled: boolean; zones: Record<Slot, string | null> };

const SLOTS: { key: Slot; label: string; format: string; where: string }[] = [
  { key: "homeFeed", label: "Inicio — feed", format: "Rectangle 300x250", where: "Inicio: bajo Nuevas y entre los perfiles del feed (tras el 8 y cada 24, máx. 4)" },
  { key: "homeCamsDesktop", label: "Inicio — cams (computador/tablet)", format: "Leaderboard 728x90", where: "Bajo la sección Cams en Vivo" },
  { key: "homeCamsMobile", label: "Inicio — cams (teléfono)", format: "Rectangle 300x250", where: "Bajo la sección Cams en Vivo" },
  { key: "listing", label: "Listados", format: "Rectangle 300x250", where: "/escorts, /hombres, comunas y etiquetas (tras el perfil 20 y cada 30, máx. 3)" },
];

export default function AdminAnunciosPage() {
  const [enabled, setEnabled] = useState(false);
  const [zones, setZones] = useState<Record<Slot, string>>({ homeFeed: "", homeCamsDesktop: "", homeCamsMobile: "", listing: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiFetch<Config>("/admin/ads/config")
      .then((cfg) => {
        setEnabled(cfg.enabled);
        setZones({
          homeFeed: cfg.zones.homeFeed ?? "",
          homeCamsDesktop: cfg.zones.homeCamsDesktop ?? "",
          homeCamsMobile: cfg.zones.homeCamsMobile ?? "",
          listing: cfg.zones.listing ?? "",
        });
      })
      .catch(() => setMsg({ ok: false, text: "No se pudo cargar la configuración." }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch("/admin/ads/config", { method: "PUT", body: JSON.stringify({ enabled, zones }) });
      setMsg({ ok: true, text: "Guardado. Los cambios se ven en la web en 1 o 2 minutos." });
    } catch (err: any) {
      setMsg({ ok: false, text: err?.body?.message || err?.message || "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-white">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-fuchsia-300" />
        <div>
          <h1 className="text-xl font-bold">Anuncios (ExoClick)</h1>
          <p className="text-xs text-white/45">Las profesionales con sesión iniciada nunca ven anuncios.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Cargando…</p>
      ) : (
        <>
          <label className="mb-6 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Mostrar anuncios</span>
              <span className="text-xs text-white/45">Apagado, no se carga nada de ExoClick en la web.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-fuchsia-600" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          <div className="space-y-4">
            {SLOTS.map((s) => (
              <div key={s.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-1 text-sm font-semibold">{s.label}</div>
                <div className="mb-2 text-[11px] text-white/45">
                  Formato en ExoClick: <b className="text-white/70">{s.format}</b> · {s.where}
                </div>
                <input
                  inputMode="numeric"
                  placeholder="zoneid (ej. 6095358) — vacío = no se muestra"
                  value={zones[s.key]}
                  onChange={(e) => setZones((z) => ({ ...z, [s.key]: e.target.value.replace(/\D/g, "") }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-fuchsia-500/50"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-6 rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-bold hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
