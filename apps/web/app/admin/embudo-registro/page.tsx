"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { canOpenAdmin } from "../../../lib/adminAccess";
import { AlertTriangle, ArrowLeft, Filter, LogOut, RefreshCw, UserPlus, Users } from "lucide-react";

type FlowKey = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
type Period = "24h" | "7d" | "30d" | "90d";

type FlowReport = {
  flow: FlowKey;
  sessions: number;
  done: number;
  googleDone: number;
  inProgress: number;
  abandoned: number;
  stages: { key: string; label: string; count: number }[];
  fields: { field: string; touched: number; abandonedHere: number }[];
  dropPoints: { point: string; count: number }[];
  errors: { step: string; field: string | null; message: string; count: number }[];
};

type FunnelResponse = {
  period: Period;
  since: string;
  generatedAt: string;
  idleMinutes: number;
  visits: number;
  truncated: boolean;
  accountsCreated: Record<string, number>;
  flows: FlowReport[];
};

const FLOW_TABS: { key: FlowKey; label: string }[] = [
  { key: "CLIENT", label: "Clientes" },
  { key: "PROFESSIONAL", label: "Profesionales" },
  { key: "ESTABLISHMENT", label: "Moteles / hoteles" },
  { key: "SHOP", label: "Tiendas" },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: "24h", label: "24 h" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
];

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre público",
  email: "Email",
  telefono: "Teléfono",
  password: "Contraseña",
  categoria: "Categoría (¿cómo te defines?)",
  genero: "Género",
  nacimiento: "Fecha de nacimiento",
  fotos: "Fotos",
  respuestas_rapidas: "Respuestas rápidas",
  mensaje_auto: "Mensaje automático",
  direccion: "Dirección",
  descripcion: "Descripción",
  referido: "Código de referido",
  terminos: "Términos y condiciones",
  preferencia: "Preferencia de género",
  tipo_perfil: "Tipo de perfil",
  codigo: "Código de verificación",
  envio_codigo: "Envío del código",
};

/* Orden y paso de cada campo en el formulario de profesionales. */
const PRO_FIELD_STEP: Record<string, number> = {
  nombre: 1,
  email: 1,
  telefono: 1,
  password: 1,
  categoria: 2,
  genero: 2,
  nacimiento: 2,
  fotos: 3,
  respuestas_rapidas: 4,
  mensaje_auto: 4,
  direccion: 5,
  descripcion: 5,
  referido: 5,
  terminos: 5,
};

/* Orden en que aparecen los campos en el formulario de clientes/negocios. */
const FORM_FIELD_ORDER = [
  "nombre",
  "email",
  "telefono",
  "genero",
  "tipo_perfil",
  "preferencia",
  "nacimiento",
  "categoria",
  "descripcion",
  "direccion",
  "password",
  "terminos",
];

const STEP_LABELS: Record<string, string> = {
  "1": "Paso 1 · Cuenta",
  "2": "Paso 2 · Sobre ti",
  "3": "Paso 3 · Fotos",
  "4": "Paso 4 · Tu chat",
  "5": "Paso 5 · Ubicación",
  form: "Formulario",
  verify: "Código",
  creación: "Creación de la cuenta",
};

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function dropPointLabel(point: string) {
  if (point.startsWith("field:")) return `Último campo tocado: ${fieldLabel(point.slice(6))}`;
  switch (point) {
    case "stage:untouched":
      return "Eligió el tipo de cuenta pero no tocó ningún campo";
    case "stage:submit":
      return "Envió el formulario pero no llegó al código";
    case "stage:verify":
      return "Se quedó en la pantalla del código (no lo ingresó)";
    case "stage:verified":
      return "Verificó el código pero la cuenta no se creó";
    case "stage:fail":
      return "La creación de la cuenta falló (error de la API)";
    default:
      return "Sin datos suficientes";
  }
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(part / total < 0.1 ? 1 : 0)}%`;
}

export default function AdminEmbudoRegistro() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = canOpenAdmin(user);
  const [period, setPeriod] = useState<Period>("7d");
  const [flow, setFlow] = useState<FlowKey>("CLIENT");
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    setError(false);
    setLoadingData(true);
    apiFetch<FunnelResponse>(`/admin/register-funnel?period=${period}`)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoadingData(false));
  }, [isAdmin, period, reloadKey]);

  const report = useMemo(() => data?.flows.find((f) => f.flow === flow) ?? null, [data, flow]);

  const fields = useMemo(() => {
    if (!report) return [];
    const order = (f: string) =>
      flow === "PROFESSIONAL"
        ? (PRO_FIELD_STEP[f] ?? 9) * 100 + Object.keys(PRO_FIELD_STEP).indexOf(f)
        : FORM_FIELD_ORDER.indexOf(f) === -1
          ? 999
          : FORM_FIELD_ORDER.indexOf(f);
    return [...report.fields].sort((a, b) => order(a.field) - order(b.field));
  }, [report, flow]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Inicia sesion.</div>;
  if (!isAdmin) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Acceso restringido.</div>;

  const realCreated = data?.accountsCreated?.[flow] ?? 0;
  const start = report?.stages[0]?.count ?? 0;
  const maxAbandon = Math.max(1, ...(report?.fields.map((f) => f.abandonedHere) ?? [1]));

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/estadisticas"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Volver a estadísticas"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <Filter className="h-5 w-5 text-fuchsia-400" />
                Embudo de registro
              </h1>
              <p className="text-xs text-white/45">
                Hasta dónde llega cada visita y en qué campo se queda quien no termina.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    period === p.key ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/50 transition hover:text-white"
              aria-label="Actualizar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tipo de cuenta */}
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
          {FLOW_TABS.map((t) => {
            const n = data?.flows.find((f) => f.flow === t.key)?.sessions ?? 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFlow(t.key)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition ${
                  flow === t.key
                    ? "border-fuchsia-400 font-semibold text-white"
                    : "border-transparent text-white/45 hover:text-white/75"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-white/35">{n}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            No se pudo cargar el embudo.
          </div>
        )}

        {data?.truncated && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            El periodo tiene demasiados eventos; el reporte usa sólo los primeros 300.000. Prueba con un periodo más corto.
          </div>
        )}

        {!data && loadingData && <p className="mt-10 text-center text-sm text-white/40">Cargando…</p>}

        {data && report && (
          <>
            {/* Resumen */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <SummaryCard icon={Users} label="Visitas a /register" value={data.visits} hint="todas las cuentas" />
              <SummaryCard icon={Filter} label="Empezaron este registro" value={start} hint="eligieron el tipo" />
              <SummaryCard
                icon={UserPlus}
                label="Cuentas creadas"
                value={report.done}
                hint={`${pct(report.done, start)} de conversión · ${realCreated} en la base`}
              />
              <SummaryCard
                icon={LogOut}
                label="Abandonaron"
                value={report.abandoned}
                hint={`${pct(report.abandoned, start)} · ${report.inProgress} en curso`}
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Avisos de error"
                value={report.errors.reduce((a, e) => a + e.count, 0)}
                hint="validación + API"
              />
            </div>

            {/* Embudo por etapa */}
            <Section title="Etapas" subtitle="Visitas que llegaron al menos hasta cada etapa.">
              <div className="grid gap-2">
                {report.stages.map((s, i) => {
                  const prev = i === 0 ? s.count : report.stages[i - 1].count;
                  const lost = prev - s.count;
                  return (
                    <div key={s.key} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 sm:grid-cols-[16rem_1fr_9rem]">
                      <span className="truncate text-sm text-white/75">{s.label}</span>
                      <div className="h-7 overflow-hidden rounded-md bg-white/[0.04]">
                        <div
                          className="flex h-full items-center rounded-md bg-gradient-to-r from-fuchsia-600/70 to-violet-600/70 px-2 text-xs font-semibold"
                          style={{ width: `${start ? Math.max(2, (s.count / start) * 100) : 0}%` }}
                        >
                          {s.count}
                        </div>
                      </div>
                      <span className="text-right text-xs tabular-nums text-white/50">
                        {pct(s.count, start)}
                        {i > 0 && lost > 0 && <span className="ml-2 text-red-300/80">−{lost}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Dónde abandonan */}
              <Section
                title="Dónde abandonan"
                subtitle={`Visitas sin cuenta creada y sin actividad en ${data.idleMinutes} min.`}
              >
                {report.dropPoints.length === 0 ? (
                  <Empty />
                ) : (
                  <ul className="grid gap-1.5">
                    {report.dropPoints.map((d) => (
                      <li key={d.point} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                        <span className="text-white/75">{dropPointLabel(d.point)}</span>
                        <span className="shrink-0 tabular-nums text-white/60">
                          {d.count} <span className="text-white/35">· {pct(d.count, report.abandoned)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Errores */}
              <Section title="Avisos y errores que vieron" subtitle="Validaciones del formulario, del código y respuestas de la API.">
                {report.errors.length === 0 ? (
                  <Empty />
                ) : (
                  <ul className="grid gap-1.5">
                    {report.errors.map((e, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block text-white/75">{e.message}</span>
                          <span className="block text-[11px] text-white/35">
                            {STEP_LABELS[e.step] ?? e.step}
                            {e.field ? ` · ${fieldLabel(e.field)}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white/60">{e.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* Campos */}
            <Section
              title="Campos"
              subtitle="Cuántas visitas tocaron cada campo y en cuántas fue el último antes de irse."
            >
              {fields.length === 0 ? (
                <Empty />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-white/35">
                        <th className="py-2 pr-3 font-medium">Campo</th>
                        {flow === "PROFESSIONAL" && <th className="py-2 pr-3 font-medium">Paso</th>}
                        <th className="py-2 pr-3 text-right font-medium">Lo tocaron</th>
                        <th className="py-2 pr-3 text-right font-medium">% del inicio</th>
                        <th className="py-2 font-medium">Abandonaron aquí</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f.field} className="border-t border-white/[0.05]">
                          <td className="py-2 pr-3 text-white/80">{fieldLabel(f.field)}</td>
                          {flow === "PROFESSIONAL" && (
                            <td className="py-2 pr-3 text-white/45">{PRO_FIELD_STEP[f.field] ?? "—"}</td>
                          )}
                          <td className="py-2 pr-3 text-right tabular-nums text-white/70">{f.touched}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-white/45">{pct(f.touched, start)}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/[0.05]">
                                <div
                                  className="h-full rounded-full bg-red-400/70"
                                  style={{ width: `${(f.abandonedHere / maxAbandon) * 100}%` }}
                                />
                              </div>
                              <span className="tabular-nums text-white/60">{f.abandonedHere}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <p className="mt-6 text-[11px] leading-relaxed text-white/35">
              Cada visita es una pestaña del navegador. “Cuentas creadas” cuenta las que terminaron el formulario en
              el periodo; “en la base” son las cuentas de ese tipo creadas en el mismo periodo por cualquier vía. Los
              datos empiezan a juntarse desde que se publicó este embudo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString("es-CL")}</p>
      {hint && <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white/90">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-white/35">Sin datos en este periodo.</p>;
}
