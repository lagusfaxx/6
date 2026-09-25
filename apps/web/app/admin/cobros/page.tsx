"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, Loader2, Power } from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";
import { isFullAdmin } from "../../../lib/adminAccess";
import PromoAdmin from "./PromoAdmin";

type Settings = {
  enabled: boolean;
  enabledAt: string | null;
  priceClp: number;
  graceDays: number;
  trialDays: number;
  graceEndsAt: string | null;
  enforced: boolean;
  flowPlanId: string | null;
};

type Impact = { total: number; paying: number; inTrial: number; withoutPlan: number; pac: number };

type Resp = {
  settings: Settings;
  impact: Impact;
  flowConfigured?: boolean;
  flowPlan?: { ok: boolean; planId?: string; message?: string } | null;
};

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );

export default function AdminCobrosPage() {
  const { me, loading: meLoading } = useMe();
  const user = me?.user ?? null;
  const allowed = isFullAdmin(user);

  const [data, setData] = useState<Resp | null>(null);
  const [flowConfigured, setFlowConfigured] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ graceDays: "", trialDays: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<null | "on" | "off">(null);

  const apply = (r: Resp) => {
    setData(r);
    if (r.flowConfigured !== undefined) setFlowConfigured(r.flowConfigured);
    setForm({
      graceDays: String(r.settings.graceDays),
      trialDays: String(r.settings.trialDays),
    });
  };

  const reload = () =>
    apiFetch<Resp>("/admin/billing/settings")
      .then(apply)
      .catch((e) => setLoadError(friendlyErrorMessage(e)));

  useEffect(() => {
    if (!allowed) return;
    reload();
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: Record<string, unknown>, okText: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const r = await apiFetch<Resp>("/admin/billing/settings", { method: "PUT", body: JSON.stringify(patch) });
      apply(r);
      const flowMsg = r.flowPlan && !r.flowPlan.ok ? ` ${r.flowPlan.message}` : "";
      setNotice({ ok: !r.flowPlan || r.flowPlan.ok, text: okText + flowMsg });
      setConfirming(null);
    } catch (e) {
      setNotice({ ok: false, text: friendlyErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const saveTarifa = () => {
    if (!data) return;
    const patch: Record<string, number> = {};
    const grace = Number(form.graceDays);
    const trial = Number(form.trialDays);
    if (grace !== data.settings.graceDays) patch.graceDays = grace;
    if (trial !== data.settings.trialDays) patch.trialDays = trial;
    if (!Object.keys(patch).length) {
      setNotice({ ok: true, text: "No hay cambios que guardar." });
      return;
    }
    save(patch, "Cambios guardados.");
  };

  if (meLoading) return <div className="p-6 text-white/60">Cargando…</div>;
  if (!allowed) {
    return (
      <div className="p-6 text-white">
        <p className="mb-3">Solo el administrador puede configurar los cobros.</p>
        <Link className="underline" href="/admin">
          Volver al panel
        </Link>
      </div>
    );
  }

  const s = data?.settings;
  const impact = data?.impact;
  const dirty =
    s &&
    (Number(form.graceDays) !== s.graceDays ||
      Number(form.trialDays) !== s.trialDays);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-white">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/80">
        <ArrowLeft className="h-3.5 w-3.5" /> Panel
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Cobro de membresías</h1>
      <p className="mt-1 text-sm text-white/50">
        Enciende el cobro cuando quieras empezar a cobrar. Mientras esté apagado, publicar es gratis y todos los
        perfiles se ven.
      </p>

      {loadError && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{loadError}</div>
      )}

      {!data && !loadError && (
        <div className="mt-6 space-y-3">
          <div className="h-36 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      )}

      {s && impact && (
        <>
          {/* Interruptor */}
          <section
            className={`mt-6 rounded-2xl border p-5 ${
              s.enabled ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Estado</p>
                <p className="mt-1 text-lg font-semibold">
                  {!s.enabled ? "Cobro apagado" : s.enforced ? "Cobro activo" : "Cobro activo · en periodo de gracia"}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {!s.enabled
                    ? "Nadie paga y todos los perfiles aprobados se muestran, aunque su prueba haya vencido."
                    : s.enforced
                      ? `Los perfiles sin membresía ni prueba vigente están ocultos hasta que paguen ${clp(s.priceClp)} al mes.`
                      : `Todos los perfiles se siguen viendo hasta el ${fecha(s.graceEndsAt!)}. Después, los que no paguen se ocultan.`}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={s.enabled}
                aria-label="Cobro de membresías"
                disabled={saving}
                onClick={() => setConfirming(s.enabled ? "off" : "on")}
                className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                  s.enabled ? "bg-emerald-500" : "bg-white/15"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    s.enabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            {confirming === "on" && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm">
                <p className="font-semibold text-amber-200">¿Encender el cobro?</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
                  <li>
                    Tarifa: <b>{clp(s.priceClp)}</b> al mes.
                  </li>
                  <li>
                    <b>{impact.withoutPlan}</b> perfiles sin plan tendrán <b>{s.graceDays} días</b> de gracia para pagar;
                    después se ocultan del sitio (directorio, búsqueda, inicio, mapa y ficha) hasta que paguen.
                  </li>
                  <li>
                    <b>{impact.inTrial}</b> siguen con su prueba gratis y <b>{impact.paying}</b> ya tienen membresía.
                  </li>
                  <li>No se borra nada: si lo apagas, todos vuelven a verse al instante.</li>
                </ul>
                {!flowConfigured && (
                  <p className="mt-3 flex items-center gap-1.5 text-red-300">
                    <AlertTriangle className="h-4 w-4" /> Flow no está configurado en el servidor: solo funcionará el pago
                    por transferencia.
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save({ enabled: true }, "Cobro encendido.")}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    Encender cobro
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {confirming === "off" && (
              <div className="mt-4 rounded-xl border border-white/15 bg-white/[0.04] p-4 text-sm">
                <p className="font-semibold">¿Apagar el cobro?</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
                  <li>Todos los perfiles aprobados vuelven a mostrarse y nadie podrá pagar.</li>
                  <li>Las membresías ya pagadas se mantienen hasta su fecha.</li>
                  {impact.pac > 0 && (
                    <li className="text-amber-200">
                      {impact.pac} perfiles tienen pago automático (PAC) en Flow: esos cobros <b>no se cancelan</b> solos.
                      Cancélalos desde Flow si corresponde.
                    </li>
                  )}
                  <li>Al volver a encenderlo se da de nuevo el periodo de gracia.</li>
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save({ enabled: false }, "Cobro apagado. Publicar vuelve a ser gratis.")}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    Apagar cobro
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Números */}
          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Perfiles aprobados" value={impact.total} />
            <Stat label="Con membresía" value={impact.paying} tone="emerald" />
            <Stat label="En prueba gratis" value={impact.inTrial} tone="violet" />
            <Stat label="Sin plan" value={impact.withoutPlan} tone="amber" />
          </section>

          {/* Tarifa */}
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CircleDollarSign className="h-4 w-4 text-emerald-300" /> Plazos
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Tarifa de membresía actual: <b>{clp(s.priceClp)}</b> (precio del plan Silver, se edita abajo).
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Días de gracia"
                hint="Al encender el cobro, para los que no tienen plan."
                value={form.graceDays}
                onChange={(v) => setForm((f) => ({ ...f, graceDays: v }))}
              />
              <Field
                label="Días de prueba"
                hint="Gratis para perfiles nuevos, desde que se registran."
                value={form.trialDays}
                onChange={(v) => setForm((f) => ({ ...f, trialDays: v }))}
              />
            </div>
            <p className="mt-3 text-xs text-white/40">
              Cambiar precios afecta a los pagos nuevos. Quien ya tiene pago automático en Flow sigue con el precio con el
              que se suscribió.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveTarifa}
                disabled={saving || !dirty}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </section>

          <PromoAdmin billingEnabled={s.enabled} onSaved={reload} />

          {notice && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                notice.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              {notice.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              {notice.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "violet" | "amber" }) {
  const color =
    tone === "emerald" ? "text-emerald-300" : tone === "violet" ? "text-violet-300" : tone === "amber" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  prefix,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/70">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-emerald-500/50">
        {prefix && <span className="mr-1 text-sm text-white/40">{prefix}</span>}
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full bg-transparent py-2 text-sm text-white outline-none"
        />
      </div>
      <span className="mt-1 block text-[11px] text-white/35">{hint}</span>
    </label>
  );
}
