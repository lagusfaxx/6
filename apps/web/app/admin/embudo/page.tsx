"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { isFullAdmin } from "../../../lib/adminAccess";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  Download,
  Filter,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  TrendingDown,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

/* ── Tipos (espejo de apps/api/src/admin/funnel.ts) ── */

type Stage = {
  key: string;
  label: string;
  hint: string;
  count: number;
  pctOfTotal: number | null;
  pctOfPrevious: number | null;
  dropFromPrevious: number;
  independent: number;
  stuckHere: number;
};

type FunnelResponse = {
  generatedAt: string;
  filters: { days: number; profileType: string };
  billing: { enabled: boolean; enforced: boolean; graceEndsAt: string | null; trialDays: number; priceClp: number };
  funnel: {
    total: number;
    stages: Stage[];
    trialEnded: number;
    trialEndedPaid: number;
    trialConversionPct: number | null;
    medianDaysToFirstPayment: number | null;
    bySource: { source: string; registros: number; publicadas: number; verificadas: number; pagaron: number; pctPublicadas: number | null; pctPagaron: number | null }[];
  };
  signup: {
    trackingSince: string | null;
    visitors: { registerPage: number; landingPages: number };
    started: number;
    completed: number;
    completionPct: number | null;
    steps: { key: string; label: string; count: number; pctOfStarted: number | null; pctOfPrevious: number | null; abandonedHere: number }[];
    byFlow: { flow: string; empezaron: number; terminaron: number; pct: number | null }[];
    errors: { step: string; stepLabel: string; error: string; personas: number; veces: number; terminaron: number }[];
  };
  paymentStatus: {
    total: number;
    activos: number;
    pagando: number;
    pagandoConPac: number;
    renuevanEn7d: number;
    enPrueba: number;
    pruebaVencenEn5d: number;
    pruebaVencidaNuncaPago: number;
    exPagadoras: number;
    intentoSinCerrar: number;
    pendientesTransferencia: number;
  };
  checkout: {
    byMethod: { method: string; abiertos: number; pagados: number; fallidos: number; abandonados: number; pendientes: number; clp: number; pctPagados: number | null }[];
    startedUsers: number;
    paidUsers: number;
    conversionPct: number | null;
  };
  cohorts: {
    mes: string;
    registros: number;
    publicadas: number;
    verificadas: number;
    pagaron30d: number;
    pagaronAlguna: number;
    pagandoHoy: number;
    activas30d: number;
    pctPublicadas: number | null;
    pctPagaron30d: number | null;
    pctPagandoHoy: number | null;
  }[];
  value: {
    publishedProfiles: number;
    avgContacts30d: number | null;
    medianContacts30d: number | null;
    paying: { profiles: number; avgContacts30d: number | null; medianContacts30d: number | null };
    notPaying: { profiles: number; avgContacts30d: number | null; medianContacts30d: number | null };
    contactBuckets: { label: string; count: number; pct: number | null }[];
    pctWithContacts: number | null;
    costPerContactClp: number | null;
    medianServiceRateClp: number | null;
    feeAsPctOfServiceRate: number | null;
    rateSample: number;
  };
  pricing: {
    priceClp: number;
    activeMembers: number;
    mrrClp: number;
    revenue30dClp: number;
    payers30d: number;
    arpuClp: number | null;
    churn: { expired: number; lost: number; pct: number | null };
    ltvClp: number | null;
    pricePoints: { monto: number; intentos: number; pagados: number; pagadoras: number; pctPagados: number | null; desde: string; hasta: string }[];
    monthlyPool: number;
    unpaidPublishedNow: number;
  };
  criteria: string[];
};

type Lead = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  profileType: string;
  signupSource: string | null;
  createdAt: string;
  lastSeen: string | null;
  isActive: boolean;
  isVerified: boolean;
  photos: number;
  missing: string[];
  contacts30d: number;
  conversations30d: number;
  trialEndsAt: string;
  membershipExpiresAt: string | null;
  hasPac: boolean;
  payments: number;
  lastPaidAt: string | null;
  openAttempt: { status: string; method: string; amount: number; createdAt: string } | null;
};

type LeadsResponse = { segment: string; label: string; goal: string; total: number; priceClp: number; items: Lead[] };

/* ── Segmentos y mensajes sugeridos ── */

type SegmentKey =
  | "sin_publicar"
  | "sin_fotos"
  | "ficha_incompleta"
  | "sin_verificar"
  | "prueba_por_vencer"
  | "prueba_vencida"
  | "pago_abandonado"
  | "ex_pagadoras"
  | "renovacion_proxima";

const SEGMENTS: { key: SegmentKey; label: string; template: string }[] = [
  {
    key: "sin_publicar",
    label: "No publicó",
    template: "Hola {nombre}! Te escribimos de UZEED. Vimos que creaste tu cuenta pero tu anuncio aún no está publicado. ¿Te ayudamos a dejarlo listo? Toma 5 minutos y empiezas a recibir clientes.",
  },
  {
    key: "sin_fotos",
    label: "Sin fotos",
    template: "Hola {nombre}! Tu anuncio en UZEED ya está publicado, pero le faltan fotos. Los perfiles con 3 fotos o más reciben muchos más contactos. ¿Las subes hoy?",
  },
  {
    key: "ficha_incompleta",
    label: "Ficha incompleta",
    template: "Hola {nombre}! A tu ficha en UZEED le falta: {faltan}. Completarla te sube en los resultados y los clientes confían más. ¿Te ayudamos?",
  },
  {
    key: "sin_verificar",
    label: "Sin verificar",
    template: "Hola {nombre}! Verifica tu perfil en UZEED: el sello de verificada da confianza y aparece primero. Es rápido, ¿te mando el enlace?",
  },
  {
    key: "prueba_por_vencer",
    label: "Prueba por vencer",
    template: "Hola {nombre}! Tu prueba gratis en UZEED termina el {vence}. En este mes recibiste {contactos} contactos. Para seguir visible, la membresía cuesta {precio} al mes. ¿Te ayudo a activarla?",
  },
  {
    key: "prueba_vencida",
    label: "Prueba vencida",
    template: "Hola {nombre}! Tu prueba en UZEED terminó y tu anuncio quedó oculto. Si lo reactivas hoy por {precio} al mes vuelves a aparecer de inmediato. ¿Te interesa?",
  },
  {
    key: "pago_abandonado",
    label: "Pago sin terminar",
    template: "Hola {nombre}! Vimos que intentaste pagar tu membresía de UZEED y no se completó. ¿Tuviste algún problema? También puedes pagar por transferencia, te ayudo.",
  },
  {
    key: "ex_pagadoras",
    label: "Dejó de pagar",
    template: "Hola {nombre}! Te extrañamos en UZEED. Tu membresía venció y tu anuncio no se ve. ¿Quieres volver? Cuéntanos qué podemos mejorar.",
  },
  {
    key: "renovacion_proxima",
    label: "Renueva pronto",
    template: "Hola {nombre}! Tu membresía de UZEED vence el {vence}. Renuévala para no perder tu lugar. Puedes activar el pago automático y olvidarte.",
  },
];

const TYPE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Profesionales" },
  { value: "ESTABLISHMENT", label: "Locales" },
  { value: "SHOP", label: "Tiendas" },
  { value: "ALL", label: "Todos" },
];
const DAY_OPTIONS = [30, 90, 180, 365];
const TABS = [
  { key: "registro", label: "Registro", icon: UserPlus },
  { key: "embudo", label: "Embudo", icon: Filter },
  { key: "pagos", label: "Quién paga", icon: CircleDollarSign },
  { key: "precio", label: "Valor y precio", icon: Calculator },
  { key: "marketing", label: "Marketing", icon: Megaphone },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SOURCE_LABELS: Record<string, string> = {
  form: "Formulario",
  google: "Google",
  publicate_gold: "Publícate Gold",
  admin: "Admin",
  referral: "Referido",
};

/* ── Utilidades ── */

const clp = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("es-CL")}`);
const num = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("es-CL"));
const pctTxt = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("es-CL")}%`);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function ago(iso: string | null): string {
  if (!iso) return "Nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 30)}m`;
}

/** Número chileno a formato wa.me (569XXXXXXXX). */
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 8) d = `569${d}`;
  else if (d.length === 9 && d.startsWith("9")) d = `56${d}`;
  return d.length >= 10 ? d : null;
}

function fillTemplate(template: string, lead: Lead, price: number): string {
  const vence = lead.membershipExpiresAt && new Date(lead.membershipExpiresAt) > new Date() ? lead.membershipExpiresAt : lead.trialEndsAt;
  return template
    .split("{nombre}").join((lead.displayName || lead.username).split(" ")[0])
    .split("{precio}").join(clp(price))
    .split("{faltan}").join(lead.missing.length ? lead.missing.join(", ").toLowerCase() : "algunos datos")
    .split("{contactos}").join(String(lead.contacts30d + lead.conversations30d))
    .split("{vence}").join(fmtDate(vence));
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Piezas ── */

function Kpi({ label, value, sub, tone = "white" }: { label: string; value: string; sub?: string; tone?: "white" | "emerald" | "amber" | "red" | "fuchsia" }) {
  const tones: Record<string, string> = {
    white: "border-white/[0.08] bg-white/[0.03]",
    emerald: "border-emerald-500/15 bg-emerald-500/[0.06]",
    amber: "border-amber-500/15 bg-amber-500/[0.06]",
    red: "border-red-500/15 bg-red-500/[0.06]",
    fuchsia: "border-fuchsia-500/15 bg-fuchsia-500/[0.06]",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] text-white/45">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.05] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-[11px] text-white/35">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div className="h-6 w-full rounded bg-white/[0.04]" title={label}>
      <div className="h-6 rounded-r bg-fuchsia-500/70 transition-all hover:bg-fuchsia-400/80" style={{ width: `${w}%` }} />
    </div>
  );
}

function Table({ head, rows, alignRightFrom = 1 }: { head: string[]; rows: React.ReactNode[][]; alignRightFrom?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-2 font-medium ${i >= alignRightFrom ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              {r.map((c, i) => (
                <td key={i} className={`px-2 py-2 tabular-nums ${i >= alignRightFrom ? "text-right text-white/70" : "text-white/80"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Página ── */

export default function AdminSalesFunnel() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const allowed = isFullAdmin(user);

  const [tab, setTab] = useState<TabKey>("registro");
  const [profileType, setProfileType] = useState("PROFESSIONAL");
  const [days, setDays] = useState(90);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    setLoadingData(true);
    setError(null);
    apiFetch<FunnelResponse>(`/admin/funnel?days=${days}&profileType=${profileType}`)
      .then(setData)
      .catch((e: any) => setError(e?.message || "No se pudo cargar el embudo."))
      .finally(() => setLoadingData(false));
  }, [allowed, days, profileType, reload]);

  const [segment, setSegment] = useState<SegmentKey>("prueba_por_vencer");
  const openSegment = (s: SegmentKey) => {
    setSegment(s);
    setTab("marketing");
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }
  if (!allowed) return <div className="mx-auto max-w-lg py-16 text-center text-white/60">Acceso restringido al administrador.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Filter className="h-5 w-5 text-fuchsia-400" /> Embudo de ventas
            </h1>
            <p className="text-xs text-white/40">Dónde se quedan las anunciantes, quién no paga y cuánto vale la app</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={profileType}
            onChange={(e) => setProfileType(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#14151f]">{o.label}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-2.5 py-1.5 text-xs ${days === d ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/50 hover:text-white/80"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setReload((n) => n + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            title="Actualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
              tab === t.key ? "border-fuchsia-400 text-white" : "border-transparent text-white/45 hover:text-white/75"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200/80">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {!data && loadingData && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {data && (
        <div className={`space-y-5 ${loadingData ? "opacity-60" : ""}`}>
          <BillingBanner billing={data.billing} />
          {tab === "registro" && <SignupTab data={data} />}
          {tab === "embudo" && <FunnelTab data={data} />}
          {tab === "pagos" && <PaymentsTab data={data} onSegment={openSegment} />}
          {tab === "precio" && <PricingTab key={data.generatedAt} data={data} />}
          {tab === "marketing" && <MarketingTab segment={segment} setSegment={setSegment} profileType={profileType} days={days} />}
          {tab !== "marketing" && (
            <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/45">
              <summary className="cursor-pointer text-white/60">Cómo se calculan estos números</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {data.criteria.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function BillingBanner({ billing }: { billing: FunnelResponse["billing"] }) {
  const tone = !billing.enabled
    ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-100/80"
    : billing.enforced
      ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-100/80"
      : "border-sky-500/20 bg-sky-500/[0.06] text-sky-100/80";
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs ${tone}`}>
      {!billing.enabled
        ? "El cobro está apagado: nadie paga todavía, así que las etapas de pago salen en cero. Usa “Valor y precio” para decidir el precio antes de encenderlo."
        : billing.enforced
          ? `Cobro activo: la membresía cuesta ${clp(billing.priceClp)} al mes y los perfiles sin plan se ocultan.`
          : `Cobro encendido en periodo de gracia hasta el ${fmtDate(billing.graceEndsAt)}.`}{" "}
      <span className="text-white/40">Prueba gratis: {billing.trialDays} días.</span>
    </div>
  );
}

/* ── Pestaña: Registro (antes de que exista la cuenta) ── */

function SignupTab({ data }: { data: FunnelResponse }) {
  const su = data.signup;
  const steps = su.steps;
  const leak = steps.reduce<(typeof steps)[number] | null>((w, s) => (s.abandonedHere > (w?.abandonedHere ?? 0) ? s : w), null);

  if (!su.trackingSince) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/60">
        Todavía no hay datos de registro. El seguimiento de cada paso del formulario empieza a contar desde que se publica esta versión: vuelve en unos días.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visitaron páginas para anunciarse" value={num(su.visitors.landingPages)} sub="Publícate, trabajar de escort, etc." />
        <Kpi label="Abrieron /register" value={num(su.visitors.registerPage)} sub="Visitantes únicos, todos los tipos" />
        <Kpi label="Empezaron el formulario" value={num(su.started)} sub="Eligieron tipo de cuenta" tone="fuchsia" />
        <Kpi label="Terminaron (cuenta creada)" value={pctTxt(su.completionPct)} sub={`${num(su.completed)} de ${num(su.started)}`} tone="emerald" />
      </div>

      {leak && leak.abandonedHere > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-sm text-red-100/80">
            Donde más desisten: <strong>“{leak.label}”</strong>. {num(leak.abandonedHere)} personas llegaron ahí y no siguieron. Mira abajo qué error les apareció.
          </p>
        </div>
      )}

      <Card title="Hasta dónde llegaron" subtitle="Cada barra cuenta a quienes llegaron a ese punto; “desistieron aquí” son las que llegaron y no avanzaron más">
        <div className="space-y-2.5">
          {steps.map((s, i) => (
            <div key={s.key} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 sm:grid-cols-[15rem_1fr_10rem]">
              <p className="truncate text-[13px] font-medium text-white/85" title={s.label}>{s.label}</p>
              <div className="relative">
                <Bar value={s.count} max={su.started} label={`${s.label}: ${num(s.count)} (${pctTxt(s.pctOfStarted)})`} />
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold tabular-nums text-white">
                  {num(s.count)} · {pctTxt(s.pctOfStarted)}
                </span>
              </div>
              <div className="col-span-2 text-[11px] text-white/45 sm:col-span-1 sm:text-right">
                {i > 0 && <span className="text-white/70">{pctTxt(s.pctOfPrevious)}</span>}
                {i > 0 && " del anterior"}
                {s.abandonedHere > 0 && <span className="text-red-300/80"> · {num(s.abandonedHere)} desistieron aquí</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card title="Qué los frenó" subtitle="Errores que vieron al intentar avanzar, y cuántos terminaron igual">
          {su.errors.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/30">Sin errores registrados en el periodo.</p>
          ) : (
            <Table
              head={["Dónde", "Mensaje que vieron", "Personas", "Veces", "Terminaron igual"]}
              alignRightFrom={2}
              rows={su.errors.map((e) => [
                <span key="s" className="whitespace-nowrap">{e.stepLabel}</span>,
                <span key="e" className="text-white/60">{e.error}</span>,
                num(e.personas),
                num(e.veces),
                `${num(e.terminaron)} (${pctTxt(e.personas ? Math.round((e.terminaron / e.personas) * 1000) / 10 : null)})`,
              ])}
            />
          )}
        </Card>
        <Card title="Correo vs. Google" subtitle="Cómo se registran y cuál termina más">
          <Table
            head={["Camino", "Empezaron", "Terminaron", "%"]}
            rows={su.byFlow.map((f) => [f.flow === "google" ? "Google" : "Correo", num(f.empezaron), num(f.terminaron), pctTxt(f.pct)])}
          />
        </Card>
      </div>

      <p className="text-[11px] text-white/35">
        Datos desde el {fmtDate(su.trackingSince)}. Una persona = un navegador. No se guarda el correo ni el teléfono de quien no terminó (todavía no aceptó los términos), así que
        estas personas no aparecen en las listas de Marketing: sirve para arreglar el formulario, no para contactarlas.
      </p>
    </>
  );
}

/* ── Pestaña: Embudo ── */

function FunnelTab({ data }: { data: FunnelResponse }) {
  const { funnel } = data;
  const stages = funnel.stages;
  const total = funnel.total;
  // La etapa que más gente pierde (sin contar la primera).
  const leak = stages.slice(1).reduce<Stage | null>((worst, s) => (!worst || s.dropFromPrevious > worst.dropFromPrevious ? s : worst), null);
  const published = stages.find((s) => s.key === "publicada");
  const paid = stages.find((s) => s.key === "pago");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Registros (${data.filters.days} días)`} value={num(total)} sub="Orgánicos, sin altas del equipo" />
        <Kpi label="Publicaron su ficha" value={pctTxt(published?.pctOfTotal)} sub={`${num(published?.count)} perfiles`} tone="fuchsia" />
        <Kpi label="Pagaron al terminar la prueba" value={pctTxt(funnel.trialConversionPct)} sub={`${num(funnel.trialEndedPaid)} de ${num(funnel.trialEnded)} con prueba vencida`} tone="emerald" />
        <Kpi
          label="Días hasta el primer pago"
          value={funnel.medianDaysToFirstPayment == null ? "—" : `${funnel.medianDaysToFirstPayment} d`}
          sub="Mediana desde el registro"
          tone="amber"
        />
      </div>

      {leak && leak.dropFromPrevious > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-sm text-red-100/80">
            La mayor fuga está en <strong>“{leak.label}”</strong>: {num(leak.dropFromPrevious)} perfiles ({pctTxt(100 - (leak.pctOfPrevious ?? 0))} de la etapa anterior) no la
            pasan. Ahí conviene enfocar la campaña.
          </p>
        </div>
      )}

      <Card title="Embudo etapa por etapa" subtitle="Cada barra cuenta a quienes cumplen esa etapa y todas las anteriores">
        <div className="space-y-2.5">
          {stages.map((s, i) => (
            <div key={s.key} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr_9rem]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-white/85" title={s.hint}>{s.label}</p>
                <p className="text-[10px] text-white/35">{s.hint}</p>
              </div>
              <div className="relative">
                <Bar value={s.count} max={total} label={`${s.label}: ${num(s.count)} (${pctTxt(s.pctOfTotal)})`} />
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold tabular-nums text-white">
                  {num(s.count)} · {pctTxt(s.pctOfTotal)}
                </span>
              </div>
              <div className="col-span-2 text-[11px] text-white/45 sm:col-span-1 sm:text-right">
                {i > 0 && (
                  <>
                    <span className="text-white/70">{pctTxt(s.pctOfPrevious)}</span> de la anterior
                    {s.dropFromPrevious > 0 && <span className="text-red-300/80"> · −{num(s.dropFromPrevious)}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Dónde se quedaron" subtitle="Primera etapa que no cumplieron">
          <Table
            head={["Etapa", "Se quedaron", "%", "Cumplen igual*"]}
            rows={stages.slice(1).map((s) => [s.label, num(s.stuckHere), pctTxt(total ? Math.round((s.stuckHere / total) * 1000) / 10 : null), num(s.independent)])}
          />
          <p className="mt-2 text-[10px] text-white/30">* Cumplen la etapa aunque se hayan saltado una anterior (ej. verificadas sin ficha completa).</p>
        </Card>
        <Card title="Por origen del registro" subtitle="Qué canal trae anunciantes que sí pagan">
          <Table
            head={["Origen", "Registros", "Publican", "Pagan"]}
            rows={funnel.bySource.map((r) => [SOURCE_LABELS[r.source] || r.source, num(r.registros), pctTxt(r.pctPublicadas), pctTxt(r.pctPagaron)])}
          />
        </Card>
      </div>
      {paid && paid.count === 0 && data.billing.enabled && (
        <p className="text-[11px] text-white/35">Todavía no hay pagos en esta ventana de registros. Prueba con 180 o 365 días.</p>
      )}
    </>
  );
}

/* ── Pestaña: Quién paga ── */

function PaymentsTab({ data, onSegment }: { data: FunnelResponse; onSegment: (s: SegmentKey) => void }) {
  const s = data.paymentStatus;
  const cards: { label: string; value: number; sub: string; icon: typeof CheckCircle2; tone: string; segment?: SegmentKey }[] = [
    { label: "Pagando", value: s.pagando, sub: `${num(s.pagandoConPac)} con pago automático`, icon: CheckCircle2, tone: "text-emerald-300" },
    { label: "Renuevan en ≤ 7 días sin PAC", value: s.renuevanEn7d, sub: "Riesgo de no renovar", icon: Clock, tone: "text-amber-300", segment: "renovacion_proxima" },
    { label: "En prueba gratis", value: s.enPrueba, sub: `${num(s.pruebaVencenEn5d)} vencen en ≤ 5 días`, icon: Clock, tone: "text-sky-300", segment: "prueba_por_vencer" },
    { label: "Prueba vencida, nunca pagó", value: s.pruebaVencidaNuncaPago, sub: "Lo que más pesa en el embudo", icon: XCircle, tone: "text-red-300", segment: "prueba_vencida" },
    { label: "Intentó pagar y no terminó", value: s.intentoSinCerrar, sub: `${num(s.pendientesTransferencia)} transferencias por revisar`, icon: AlertTriangle, tone: "text-amber-300", segment: "pago_abandonado" },
    { label: "Pagó y dejó de pagar", value: s.exPagadoras, sub: "Churn acumulado", icon: TrendingDown, tone: "text-red-300", segment: "ex_pagadoras" },
  ];
  const totalCheckout = data.checkout.byMethod.reduce((acc, m) => acc + m.abiertos, 0);

  return (
    <>
      <p className="text-xs text-white/40">
        Foto de hoy sobre {num(s.total)} anunciantes orgánicas ({num(s.activos)} activas). Toca una tarjeta para ver la lista y contactarlas.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.label}
            disabled={!c.segment}
            onClick={() => c.segment && onSegment(c.segment)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition enabled:hover:border-fuchsia-500/30 enabled:hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-2 text-[12px] text-white/60">
              <c.icon className={`h-4 w-4 ${c.tone}`} /> {c.label}
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{num(c.value)}</p>
            <p className="text-[11px] text-white/35">{c.sub}</p>
            {c.segment && <p className="mt-2 text-[11px] text-fuchsia-300/80">Ver lista →</p>}
          </button>
        ))}
      </div>

      <Card
        title={`Pagos abiertos en los últimos ${data.filters.days} días`}
        subtitle={`${num(data.checkout.startedUsers)} anunciantes abrieron el pago y ${num(data.checkout.paidUsers)} lo terminaron (${pctTxt(data.checkout.conversionPct)})`}
      >
        {totalCheckout === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">Sin pagos de membresía en el periodo.</p>
        ) : (
          <Table
            head={["Método", "Abiertos", "Pagados", "% pagado", "Abandonados", "Fallidos", "Pendientes", "Cobrado"]}
            rows={data.checkout.byMethod.map((m) => [
              m.method === "FLOW" ? "Flow (tarjeta)" : m.method === "TRANSFER" ? "Transferencia" : m.method,
              num(m.abiertos),
              num(m.pagados),
              pctTxt(m.pctPagados),
              num(m.abandonados),
              num(m.fallidos),
              num(m.pendientes),
              clp(m.clp),
            ])}
          />
        )}
      </Card>

      <Card title="Cohortes por mes de registro" subtitle="Qué pasó con quienes se registraron cada mes">
        <Table
          head={["Mes", "Registros", "Publicaron", "Verificadas", "Pagaron ≤ 30 d", "Pagaron alguna vez", "Pagando hoy", "Activas 30 d"]}
          rows={data.cohorts.map((c) => [
            c.mes,
            num(c.registros),
            `${num(c.publicadas)} (${pctTxt(c.pctPublicadas)})`,
            num(c.verificadas),
            `${num(c.pagaron30d)} (${pctTxt(c.pctPagaron30d)})`,
            num(c.pagaronAlguna),
            `${num(c.pagandoHoy)} (${pctTxt(c.pctPagandoHoy)})`,
            num(c.activas30d),
          ])}
        />
      </Card>
    </>
  );
}

/* ── Pestaña: Valor y precio ── */

function PricingTab({ data }: { data: FunnelResponse }) {
  const { value, pricing } = data;
  const maxBucket = Math.max(...value.contactBuckets.map((b) => b.count), 0);

  // Simulador: conversión a otro precio con elasticidad constante (supuesto editable).
  const baseConversion = data.funnel.trialConversionPct && data.funnel.trialConversionPct > 0 ? data.funnel.trialConversionPct : 15;
  const [basePrice, setBasePrice] = useState(pricing.priceClp || 10000);
  const [conversion, setConversion] = useState(baseConversion);
  const [elasticity, setElasticity] = useState(1.2);
  const [pool, setPool] = useState(Math.max(pricing.monthlyPool, 1));
  const [stock, setStock] = useState(pricing.unpaidPublishedNow);
  const churn = pricing.churn.pct && pricing.churn.pct > 0 ? pricing.churn.pct : 20;

  const scenarios = useMemo(() => {
    const factors = [0.4, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];
    return factors.map((f) => {
      const price = Math.round((basePrice * f) / 500) * 500;
      const conv = Math.min(100, conversion * Math.pow(f, -elasticity));
      const newPerMonth = (pool * conv) / 100;
      const fromStock = (stock * conv) / 100;
      // Base pagante en régimen: altas mensuales ÷ churn mensual.
      const steadyMembers = newPerMonth / (churn / 100);
      return {
        price,
        conv,
        firstMonthClp: (newPerMonth + fromStock) * price,
        steadyMrrClp: steadyMembers * price,
        steadyMembers,
        ltvClp: price / (churn / 100),
      };
    });
  }, [basePrice, conversion, elasticity, pool, stock, churn]);
  const best = scenarios.reduce((b, s) => (s.steadyMrrClp > b.steadyMrrClp ? s : b), scenarios[0]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="MRR (membresías vigentes × precio)" value={clp(pricing.mrrClp)} sub={`${num(pricing.activeMembers)} pagando a ${clp(pricing.priceClp)}`} tone="emerald" />
        <Kpi label="Cobrado últimos 30 días" value={clp(pricing.revenue30dClp)} sub={`ARPU ${clp(pricing.arpuClp)} · ${num(pricing.payers30d)} pagadoras`} />
        <Kpi label="Churn mensual" value={pctTxt(pricing.churn.pct)} sub={`${num(pricing.churn.lost)} de ${num(pricing.churn.expired)} vencidas no renovaron`} tone="red" />
        <Kpi label="LTV (valor de una pagadora)" value={clp(pricing.ltvClp)} sub="Precio ÷ churn mensual" tone="fuchsia" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Valor que reciben" subtitle={`${num(value.publishedProfiles)} perfiles publicados · últimos 30 días`}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Contactos por perfil (promedio)" value={num(value.avgContacts30d)} sub={`Mediana ${num(value.medianContacts30d)}`} />
            <Kpi label="Reciben al menos 1 contacto" value={pctTxt(value.pctWithContacts)} />
            <Kpi label="Costo por contacto al precio actual" value={clp(value.costPerContactClp)} sub="Precio ÷ contactos promedio" tone="amber" />
            <Kpi
              label="Membresía vs. tarifa de una atención"
              value={pctTxt(value.feeAsPctOfServiceRate)}
              sub={`Tarifa mediana ${clp(value.medianServiceRateClp)} (${num(value.rateSample)} fichas)`}
              tone="emerald"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-lg border border-white/[0.06] p-3">
              <p className="text-white/45">Pagando ({num(value.paying.profiles)})</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{num(value.paying.avgContacts30d)} <span className="text-xs font-normal text-white/40">contactos/mes</span></p>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-3">
              <p className="text-white/45">Sin pagar ({num(value.notPaying.profiles)})</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{num(value.notPaying.avgContacts30d)} <span className="text-xs font-normal text-white/40">contactos/mes</span></p>
            </div>
          </div>
        </Card>

        <Card title="Contactos por perfil al mes" subtitle="Cuántos perfiles caen en cada tramo">
          <div className="space-y-2">
            {value.contactBuckets.map((b) => (
              <div key={b.label} className="grid grid-cols-[3.5rem_1fr_6rem] items-center gap-2 text-[12px]">
                <span className="text-white/60">{b.label}</span>
                <Bar value={b.count} max={maxBucket} label={`${b.label} contactos: ${num(b.count)} perfiles`} />
                <span className="text-right tabular-nums text-white/60">{num(b.count)} · {pctTxt(b.pct)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            Si una profesional recupera la membresía con un solo cliente, el precio se vende solo. Los perfiles con 0 contactos son los que más se van: ayúdalos antes de cobrarles más.
          </p>
        </Card>
      </div>

      <Card title="Precios que ya se cobraron" subtitle="Si la tarifa cambió alguna vez, cada precio es un experimento real">
        {pricing.pricePoints.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">Aún no hay intentos de pago de membresía.</p>
        ) : (
          <Table
            head={["Precio", "Intentos", "Pagados", "% pagado", "Pagadoras", "Desde", "Hasta"]}
            rows={pricing.pricePoints.map((p) => [clp(p.monto), num(p.intentos), num(p.pagados), pctTxt(p.pctPagados), num(p.pagadoras), fmtDate(p.desde), fmtDate(p.hasta)])}
          />
        )}
      </Card>

      <Card title="Simulador de precio" subtitle="Estimación: ajusta los supuestos y compara escenarios">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SimInput label="Precio de referencia (CLP)" value={basePrice} step={500} onChange={setBasePrice} />
          <SimInput label="Conversión a ese precio (%)" value={conversion} step={0.5} onChange={setConversion} />
          <SimInput label="Elasticidad (sensibilidad)" value={elasticity} step={0.1} onChange={setElasticity} />
          <SimInput label="Pruebas que terminan / mes" value={pool} step={1} onChange={setPool} />
          <SimInput label="Publicadas hoy sin pagar" value={stock} step={1} onChange={setStock} />
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Conversión = conversión de referencia × (precio nuevo ÷ precio de referencia)<sup>−elasticidad</sup>. Elasticidad 1 = si duplicas el precio, paga la mitad. Churn usado:{" "}
          {pctTxt(churn)} {pricing.churn.pct ? "(real)" : "(supuesto, aún sin datos)"}. Los valores iniciales salen de tus datos.
        </p>
        <div className="mt-4">
          <Table
            head={["Precio", "Conversión", "Ingreso 1er mes", "Pagadoras en régimen", "MRR en régimen", "LTV"]}
            rows={scenarios.map((s) => [
              <span key="p" className={s === best ? "font-semibold text-emerald-300" : ""}>
                {clp(s.price)} {s === best && "★"}
              </span>,
              pctTxt(Math.round(s.conv * 10) / 10),
              clp(s.firstMonthClp),
              num(Math.round(s.steadyMembers)),
              clp(s.steadyMrrClp),
              clp(s.ltvClp),
            ])}
          />
        </div>
        <p className="mt-3 text-[12px] text-white/60">
          Con estos supuestos el MRR en régimen es máximo a <strong className="text-emerald-300">{clp(best.price)}</strong>. Valídalo subiendo o bajando el precio por unas semanas y mira la tabla de
          “Precios que ya se cobraron”.
        </p>
      </Card>
    </>
  );
}

function SimInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/45">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm tabular-nums text-white outline-none focus:border-fuchsia-500/40"
      />
    </label>
  );
}

/* ── Pestaña: Marketing ── */

function MarketingTab({ segment, setSegment, profileType, days }: { segment: SegmentKey; setSegment: (s: SegmentKey) => void; profileType: string; days: number }) {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, string>>(() => Object.fromEntries(SEGMENTS.map((s) => [s.key, s.template])));
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<LeadsResponse>(`/admin/funnel/leads?segment=${segment}&profileType=${profileType}&days=${days}&limit=500`)
      .then(setData)
      .catch((e: any) => setError(e?.message || "No se pudo cargar la lista."))
      .finally(() => setLoading(false));
  }, [segment, profileType, days]);

  const template = templates[segment] ?? "";

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* el navegador no dejó copiar: no pasa nada */
    }
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`embudo-${segment}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Nombre", "Usuario", "Email", "Teléfono", "Comuna", "Registro", "Última conexión", "Fotos", "Le falta", "Contactos 30d", "Chats 30d", "Fin prueba", "Membresía hasta", "Pagos", "Mensaje"],
      ...data.items.map((l) => [
        l.displayName || l.username,
        l.username,
        l.email,
        l.phone,
        l.city,
        l.createdAt.slice(0, 10),
        l.lastSeen?.slice(0, 10) ?? "",
        l.photos,
        l.missing.join(" / "),
        l.contacts30d,
        l.conversations30d,
        l.trialEndsAt.slice(0, 10),
        l.membershipExpiresAt?.slice(0, 10) ?? "",
        l.payments,
        fillTemplate(template, l, data.priceClp),
      ]),
    ]);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              segment === s.key ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100" : "border-white/10 text-white/55 hover:text-white/85"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card
        title={data ? `${data.label} · ${num(data.total)} perfiles` : "Cargando…"}
        subtitle={data ? `Objetivo: ${data.goal} Ordenadas por interés (contactos y chats de los últimos 30 días).` : undefined}
        right={
          <button
            onClick={exportCsv}
            disabled={!data?.items.length}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        }
      >
        <label className="block">
          <span className="text-[11px] text-white/45">
            Mensaje de WhatsApp (variables: {"{nombre}"}, {"{precio}"}, {"{faltan}"}, {"{contactos}"}, {"{vence}"})
          </span>
          <textarea
            value={template}
            onChange={(e) => setTemplates((t) => ({ ...t, [segment]: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none focus:border-fuchsia-500/40"
          />
        </label>

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        )}
        {!loading && data && data.items.length === 0 && <p className="py-8 text-center text-xs text-white/30">No hay perfiles en este segmento. 🎉</p>}
        {!loading && data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
                  <th className="px-2 py-2 font-medium">Perfil</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 text-right font-medium">Interés 30d</th>
                  <th className="px-2 py-2 font-medium">Última conexión</th>
                  <th className="px-2 py-2 text-right font-medium">Contactar</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => {
                  const wa = waNumber(l.phone);
                  const msg = fillTemplate(template, l, data.priceClp);
                  const isDone = done.has(l.id);
                  return (
                    <tr key={l.id} className={`border-b border-white/[0.03] align-top hover:bg-white/[0.02] ${isDone ? "opacity-40" : ""}`}>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {l.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-white/40">
                              {(l.displayName || l.username).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link href={`/profesional/${l.id}`} target="_blank" className="block truncate font-medium text-white/85 hover:text-fuchsia-300">
                              {l.displayName || l.username}
                            </Link>
                            <p className="truncate text-[10px] text-white/35">
                              @{l.username}
                              {l.city ? ` · ${l.city}` : ""} · {l.phone || "sin teléfono"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[16rem] px-2 py-2.5 text-[11px] text-white/55">
                        <p>Registro {fmtDate(l.createdAt)} · {l.photos} fotos{l.isVerified ? " · verificada" : ""}</p>
                        {l.missing.length > 0 && <p className="text-amber-300/70">Falta: {l.missing.join(", ")}</p>}
                        {l.openAttempt && (
                          <p className="text-red-300/70">
                            Pago {l.openAttempt.method === "FLOW" ? "Flow" : "transferencia"} {l.openAttempt.status.toLowerCase()} el {fmtDate(l.openAttempt.createdAt)}
                          </p>
                        )}
                        {l.membershipExpiresAt && <p>Membresía hasta {fmtDate(l.membershipExpiresAt)}{l.hasPac ? " (PAC)" : ""}</p>}
                        {!l.membershipExpiresAt && <p>Prueba hasta {fmtDate(l.trialEndsAt)}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-white/70">
                        <span title="Contactos por WhatsApp/teléfono">{num(l.contacts30d)}</span>
                        <span className="text-white/30"> + </span>
                        <span title="Conversaciones de chat">{num(l.conversations30d)}</span>
                      </td>
                      <td className="px-2 py-2.5 text-white/55">{ago(l.lastSeen)}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {wa ? (
                            <a
                              href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setDone((d) => new Set(d).add(l.id))}
                              className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/25"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          ) : (
                            <span className="rounded-lg px-2.5 py-1.5 text-[11px] text-white/25">Sin número</span>
                          )}
                          <button
                            onClick={() => copy(msg, l.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.06]"
                            title="Copiar mensaje"
                          >
                            {copied === l.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.total > data.items.length && (
              <p className="mt-2 text-[11px] text-white/30">Mostrando {num(data.items.length)} de {num(data.total)}. El CSV trae las mismas filas.</p>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/45">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Al abrir WhatsApp la fila se atenúa para que sepas a quién ya le escribiste (sólo en esta pestaña). Para un aviso masivo dentro de la app usa “enviar_aviso” desde Claude con el mismo
          segmento.
        </p>
      </div>
    </>
  );
}
