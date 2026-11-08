"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { canOpenAdmin } from "../../../lib/adminAccess";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  BookImage,
  Clock,
  Download,
  Filter,
  Globe,
  Info,
  LayoutGrid,
  Lightbulb,
  MapPin,
  Megaphone,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

/* ─── Tipos de /admin/analytics ─── */

type Cmp = { actual: number | null; anterior: number | null; variacionPct: number | null; diferencia: number; baseChica?: boolean };
type KpiKey =
  | "visitantes" | "visitantesNuevos" | "sesiones" | "rebotePct" | "paginasPorSesion" | "duracionMedianaSeg"
  | "vistas" | "vistasFichas" | "visitantesFichas" | "contactosWhatsapp" | "contactosTelefono" | "conversacionesNuevas"
  | "leads" | "visitantesQueContactaron" | "tasaContactoPct" | "conversionVisitaLeadPct" | "registrosClientes"
  | "registrosOferentes" | "ingresosClp" | "pagos" | "pagadores" | "busquedas" | "busquedasSinResultados";

type Rates = { entradas: number; rebotePct: number | null; conversionPct: number | null };
type Segment = { clave: string; sesiones: number; visitantes: number; rebotePct: number | null; conversionPct: number | null };
type Perfil = {
  id: string; nombre: string; username: string | null; ciudad: string | null; tipo: string; tier: string | null;
  visitantes: number; whatsapp: number; telefono: number; contactos: number; tasaContactoPct: number | null;
};
type Insight = { tipo: "alerta" | "oportunidad" | "dato"; titulo: string; detalle: string };

type Dashboard = {
  generadoEl: string;
  periodo: { clave: string; etiqueta: string; anterior: string; dias: number; enCurso: boolean; agrupacion: "hora" | "dia" };
  kpis: Record<KpiKey, Cmp>;
  embudo: { paso: string; valor: number; anterior: number }[];
  serie: { t: string; visitantes: number; sesiones: number; contactos: number; registrosClientes: number; registrosOferentes: number }[];
  fuentes: {
    fuente: string; etiqueta: string; sesiones: number; visitantes: number; nuevosPct: number | null; rebotePct: number | null;
    contactos: number; conversionPct: number | null; registrosClientes: number; registrosOferentes: number; registros: number; registrosAnterior: number;
  }[];
  campanas: { campana: string; origen: string; medio: string; sesiones: number; visitantes: number; rebotePct: number | null; contactos: number; conversionPct: number | null; registros: number }[];
  dominios: { dominio: string; fuente: string; sesiones: number; conversionPct: number | null }[];
  landingSecciones: (Rates & { seccion: string })[];
  landings: (Rates & { pagina: string })[];
  dispositivos: Segment[];
  modos: Segment[];
  audiencia: Segment[];
  heatmap: { dias: string[]; matriz: number[][]; picos: { dia: string; hora: number; sesiones: number }[] };
  ciudades: { ciudad: string; region: string; sesiones: number; visitantes: number; contactos: number; perfiles: number; visitantesPorPerfil: number | null }[];
  busquedas: {
    terminos: { termino: string; busquedas: number; sinResultados: number }[];
    sinResultados: { termino: string; ciudad: string | null; categoria: string | null; veces: number }[];
  };
  perfiles: { topContactos: Perfil[]; bajaConversion: Perfil[] };
  negocio: {
    precioMembresiaClp: number; cobroActivo: boolean; perfilesPublicados: number; membresiasActivas: number; perfilesEnPrueba: number;
    membresiasPorVencer7d: number; membresiasVencidasEnPeriodo: number; mrrEstimadoClp: number;
    porProposito: { proposito: string; monto: number; pagos: number }[];
    ingresosClp: number; ticketPromedioClp: number | null; leadsPorPerfilPublicado: number | null;
  };
  excluido: { brutas: number; bots: number; equipo: number; panel: number; reales: number };
  insights: Insight[];
  criterios: Record<string, string>;
};

const PERIODS = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "mes_actual", label: "Este mes" },
  { key: "mes_anterior", label: "Mes anterior" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const PURPOSE_LABEL: Record<string, string> = {
  MEMBERSHIP_PLAN: "Membresías",
  SHOP_PLAN: "Plan tiendas",
  TOKEN_PURCHASE: "Compra de tokens",
  CREATOR_SUBSCRIPTION: "Suscripciones creadoras",
  UMATE_PLAN: "Plan U-Mate",
  PUBLICATE_GOLD: "Publicación Gold",
  MARKETPLACE_ORDER: "Marketplace",
  PROMO_PURCHASE: "Promociones / destacados",
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/estadisticas", label: "Estadisticas", icon: BarChart3 },
  { href: "/admin/embudo-registro", label: "Embudo registro", icon: Filter },
  { href: "/admin/verification", label: "Verificaciones", icon: UserCheck },
  { href: "/admin/profiles", label: "Perfiles", icon: Users },
  { href: "/admin/expired-trials", label: "Pruebas caducadas", icon: Clock },
  { href: "/admin/deposits", label: "Depositos", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", label: "Retiros", icon: ArrowUpFromLine },
  { href: "/admin/banners", label: "Banners", icon: BookImage },
  { href: "/admin/cobros", label: "Cobros", icon: Tag },
  { href: "/admin/quick-listings", label: "Listados", icon: Store },
  { href: "/admin/moderation", label: "Moderacion", icon: Shield },
  { href: "/admin/privacy-requests", label: "Privacidad", icon: Trash2 },
];

/* ─── Formato ─── */

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("es-CL"));
const clp = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `$${Math.round(v).toLocaleString("es-CL")}`);
const pctTxt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);
const secs = (v: number | null | undefined) => {
  if (!v) return "—";
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
};

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Página ─── */

export default function AdminEstadisticas() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  /* Las cuentas de equipo también abren esta pantalla, en modo lectura. */
  const isAdmin = canOpenAdmin(user);
  const [data, setData] = useState<Dashboard | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [error, setError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setError(false);
    setLoadingData(true);
    apiFetch<Dashboard>(`/admin/analytics?period=${period}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoadingData(false));
    return () => {
      alive = false;
    };
  }, [isAdmin, period]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Inicia sesion.</div>;
  if (!isAdmin) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Acceso restringido.</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="flex">
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0e1a] min-h-screen sticky top-0">
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-violet-600">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">Uzeed Admin</span>
          </div>
          <nav className="flex-1 py-3 px-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/admin/estadisticas";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ${
                    isActive ? "bg-fuchsia-500/10 text-fuchsia-300 font-medium" : "text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors lg:hidden">
                  <ArrowLeft className="h-4 w-4 text-white/50" />
                </Link>
                <div>
                  <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-fuchsia-400/60" />
                    Estadísticas de marketing
                  </h1>
                  <p className="text-[11px] text-white/35">
                    {data ? (
                      <>
                        {data.periodo.etiqueta} · comparado con {data.periodo.anterior}
                      </>
                    ) : (
                      "Adquisición, conversión y negocio"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      period === p.key ? "bg-fuchsia-600 text-white shadow-sm" : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-5 space-y-8">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {NAV_ITEMS.filter((n) => n.href !== "/admin/estadisticas").map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white/70 transition-all"
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </Link>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <Activity className="h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-200/80">No se pudieron cargar las estadísticas. Intenta de nuevo en un momento.</p>
              </div>
            )}

            {loadingData && !data && <Skeleton />}

            {data && (
              <div className={`space-y-8 transition-opacity ${loadingData ? "opacity-50" : ""}`}>
                <Insights items={data.insights} />
                <KpiGrid data={data} />
                <div className="grid gap-4 xl:grid-cols-5">
                  <div className="xl:col-span-3">
                    <TrendChart data={data} />
                  </div>
                  <div className="xl:col-span-2">
                    <Funnel data={data} />
                  </div>
                </div>
                <Acquisition data={data} />
                <Landings data={data} />
                <Audience data={data} />
                <Heatmap data={data} />
                <Geography data={data} />
                <Searches data={data} />
                <Profiles data={data} />
                <Business data={data} />
                <Criteria data={data} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Bloques ─── */

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 h-24" />
        ))}
      </div>
      <div className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] h-72" />
    </div>
  );
}

function Section({ icon: Icon, title, hint, children, action }: { icon: any; title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-white/45">
            <Icon className="h-3.5 w-3.5 text-white/30" />
            {title}
          </h2>
          {hint && <p className="mt-1 text-[11px] text-white/30 max-w-3xl">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ title, children, action, className = "" }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-4 py-3">
          <h3 className="text-sm font-semibold text-white/85">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function CsvButton({ name, rows }: { name: string; rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  return (
    <button
      onClick={() => downloadCsv(name, rows)}
      className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/45 hover:bg-white/[0.05] hover:text-white/70"
      title="Descargar CSV"
    >
      <Download className="h-3 w-3" /> CSV
    </button>
  );
}

function Insights({ items }: { items: Insight[] }) {
  if (!items.length) return null;
  const style = {
    alerta: { icon: AlertTriangle, box: "border-amber-500/20 bg-amber-500/[0.05]", ic: "text-amber-300", tag: "Atención" },
    oportunidad: { icon: Lightbulb, box: "border-emerald-500/20 bg-emerald-500/[0.05]", ic: "text-emerald-300", tag: "Oportunidad" },
    dato: { icon: Info, box: "border-sky-500/20 bg-sky-500/[0.05]", ic: "text-sky-300", tag: "Dato" },
  } as const;
  return (
    <Section icon={Lightbulb} title="Qué hacer ahora" hint="Lecturas automáticas del periodo: dónde se pierde gente y dónde conviene invertir.">
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((it, i) => {
          const s = style[it.tipo];
          return (
            <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${s.box}`}>
              <s.icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.ic}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white/90">
                  <span className={`mr-1.5 text-[10px] font-medium uppercase tracking-wide ${s.ic}`}>{s.tag}</span>
                  {it.titulo}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">{it.detalle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Delta({ c, kind = "count", inverse = false }: { c: Cmp; kind?: "count" | "rate" | "plain"; inverse?: boolean }) {
  if (c.anterior === null || c.actual === null) return null;
  let text: string;
  let sign: number;
  if (kind === "count") {
    if (c.variacionPct === null) return <span className="text-[10px] text-white/30">sin datos previos</span>;
    sign = Math.sign(c.variacionPct);
    text = `${c.variacionPct > 0 ? "+" : ""}${c.variacionPct.toLocaleString("es-CL")}%`;
  } else {
    sign = Math.sign(c.diferencia);
    const unit = kind === "rate" ? " pts" : "";
    text = `${c.diferencia > 0 ? "+" : ""}${c.diferencia.toLocaleString("es-CL")}${unit}`;
  }
  const good = inverse ? sign < 0 : sign > 0;
  const color = sign === 0 ? "text-white/40" : good ? "text-emerald-300" : "text-rose-300";
  const Arrow = sign >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${color}`} title={`Periodo anterior: ${c.anterior.toLocaleString("es-CL")}`}>
      {sign !== 0 && <Arrow className="h-3 w-3" />}
      {text}
      {c.baseChica && <span className="ml-1 text-[9px] font-normal text-white/30">(pocos casos)</span>}
    </span>
  );
}

function Kpi({ label, value, c, kind, inverse, help }: { label: string; value: string; c: Cmp; kind?: "count" | "rate" | "plain"; inverse?: boolean; help: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4" title={help}>
      <p className="text-[11px] text-white/45 truncate">{label}</p>
      <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <Delta c={c} kind={kind} inverse={inverse} />
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-white/30 line-clamp-2">{help}</p>
    </div>
  );
}

function KpiGrid({ data }: { data: Dashboard }) {
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <Section icon={TrendingUp} title="Resultados" hint="Lo que el negocio necesita: gente que llega, contactos que reciben los anunciantes, registros e ingresos.">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi label="Visitantes únicos" value={num(k.visitantes.actual)} c={k.visitantes} help="Personas (navegadores) distintas, sin bots ni equipo." />
          <Kpi label="Leads generados" value={num(k.leads.actual)} c={k.leads} help={`${num(k.contactosWhatsapp.actual)} WhatsApp · ${num(k.contactosTelefono.actual)} llamadas · ${num(k.conversacionesNuevas.actual)} chats nuevos`} />
          <Kpi label="Tasa de contacto" value={pctTxt(k.tasaContactoPct.actual)} c={k.tasaContactoPct} kind="rate" help="De quienes vieron una ficha, % que contactó por WhatsApp o llamada." />
          <Kpi label="Conversión visita → contacto" value={pctTxt(k.conversionVisitaLeadPct.actual)} c={k.conversionVisitaLeadPct} kind="rate" help="% de todos los visitantes que terminó contactando a alguien." />
          <Kpi label="Registros de clientes" value={num(k.registrosClientes.actual)} c={k.registrosClientes} help="Altas reales de clientes (sin pruebas ni equipo)." />
          <Kpi label="Registros de anunciantes" value={num(k.registrosOferentes.actual)} c={k.registrosOferentes} help="Profesionales, establecimientos y tiendas que se registraron solos." />
          <Kpi label="Ingresos" value={clp(k.ingresosClp.actual)} c={k.ingresosClp} help={`${num(k.pagos.actual)} pagos de ${num(k.pagadores.actual)} clientes.`} />
          <Kpi label="MRR estimado" value={clp(data.negocio.mrrEstimadoClp)} c={{ actual: data.negocio.mrrEstimadoClp, anterior: null, variacionPct: null, diferencia: 0 }} help={`${num(data.negocio.membresiasActivas)} membresías vigentes × ${clp(data.negocio.precioMembresiaClp)}.`} />
        </div>
      </Section>
      <Section icon={Activity} title="Calidad del tráfico">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
          <Kpi label="Sesiones" value={num(k.sesiones.actual)} c={k.sesiones} help="Visitas (pestañas) distintas." />
          <Kpi label="Visitantes nuevos" value={num(k.visitantesNuevos.actual)} c={k.visitantesNuevos} help="Primera vez que llegan al sitio." />
          <Kpi label="Rebote" value={pctTxt(k.rebotePct.actual)} c={k.rebotePct} kind="rate" inverse help="Sesiones que vieron una sola página y se fueron. Más bajo es mejor." />
          <Kpi label="Páginas por sesión" value={(k.paginasPorSesion.actual ?? 0).toLocaleString("es-CL")} c={k.paginasPorSesion} kind="plain" help="Cuánto navegan en cada visita." />
          <Kpi label="Tiempo típico" value={secs(k.duracionMedianaSeg.actual)} c={k.duracionMedianaSeg} kind="plain" help="Mediana de duración de las sesiones de más de una página." />
          <Kpi label="Visitantes de fichas" value={num(k.visitantesFichas.actual)} c={k.visitantesFichas} help={`${num(k.vistasFichas.actual)} vistas de fichas en total.`} />
        </div>
        <p className="mt-2 text-[10px] text-white/25">
          Excluido del periodo: {num(data.excluido.bots)} vistas de bots, {num(data.excluido.equipo)} del equipo y {num(data.excluido.panel)} del panel admin
          {data.excluido.brutas ? ` (${pctTxt(((data.excluido.brutas - data.excluido.reales) / data.excluido.brutas) * 100)} del total registrado)` : ""}.
        </p>
      </Section>
    </div>
  );
}

const SERIES = [
  { key: "visitantes", label: "Visitantes" },
  { key: "sesiones", label: "Sesiones" },
  { key: "contactos", label: "Contactos" },
  { key: "registrosClientes", label: "Registros clientes" },
  { key: "registrosOferentes", label: "Registros anunciantes" },
] as const;

function TrendChart({ data }: { data: Dashboard }) {
  const [metric, setMetric] = useState<(typeof SERIES)[number]["key"]>("visitantes");
  const [hover, setHover] = useState<number | null>(null);
  const points = data.serie;
  const values = points.map((p) => p[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 640;
  const H = 200;
  const padL = 36;
  const padB = 22;
  const padT = 10;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const label = (t: string) =>
    data.periodo.agrupacion === "hora" ? t.slice(11, 16) : new Date(`${t}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  const every = Math.max(1, Math.ceil(points.length / 8));
  const line = points.map((p, i) => `${x(i)},${y(p[metric])}`).join(" ");
  const h = hover !== null ? points[hover] : null;

  return (
    <Card
      title="Evolución"
      action={<span className="text-[11px] text-white/35 tabular-nums">{num(total)} en el periodo</span>}
      className="h-full"
    >
      <div className="flex flex-wrap gap-1 px-4 pt-3">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setMetric(s.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
              metric === s.key ? "bg-fuchsia-500/15 text-fuchsia-200" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="relative px-2 pb-3 pt-2">
        {points.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-white/25">Sin datos</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
                <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">
                  {t.toLocaleString("es-CL")}
                </text>
              </g>
            ))}
            <polygon points={`${x(0)},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`} fill="rgba(217,70,239,0.10)" />
            <polyline points={line} fill="none" stroke="#d946ef" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              i % every === 0 ? (
                <text key={p.t} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">
                  {label(p.t)}
                </text>
              ) : null,
            )}
            {h && hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(h[metric])} r="4.5" fill="#d946ef" stroke="#0a0b14" strokeWidth="2" />
              </g>
            )}
            {points.map((p, i) => (
              <rect
                key={`hit-${p.t}`}
                x={x(i) - innerW / Math.max(points.length, 1) / 2}
                y={padT}
                width={innerW / Math.max(points.length, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            ))}
          </svg>
        )}
        {h && (
          <div className="pointer-events-none absolute right-4 top-2 rounded-lg border border-white/10 bg-[#141526]/95 px-3 py-2 text-[11px] shadow-xl">
            <p className="font-semibold text-white/80">{data.periodo.agrupacion === "hora" ? h.t : new Date(`${h.t}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" })}</p>
            {SERIES.map((s) => (
              <p key={s.key} className={`tabular-nums ${s.key === metric ? "text-white" : "text-white/45"}`}>
                {s.label}: {num(h[s.key])}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Funnel({ data }: { data: Dashboard }) {
  const top = data.embudo[0]?.valor || 1;
  return (
    <Card title="Embudo de conversión" className="h-full">
      <div className="space-y-4 p-4">
        {data.embudo.map((s, i) => {
          const prev = i > 0 ? data.embudo[i - 1].valor : null;
          const step = prev ? (s.valor / prev) * 100 : null;
          const w = Math.max((s.valor / top) * 100, 2);
          return (
            <div key={s.paso}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-white/70">{s.paso}</span>
                <span className="text-sm font-semibold tabular-nums">{num(s.valor)}</span>
              </div>
              <div className="h-7 w-full rounded-md bg-white/[0.04]">
                <div className="h-full rounded-md bg-fuchsia-500/60" style={{ width: `${w}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/35">
                <span>{step !== null ? `${pctTxt(step)} del paso anterior` : "Punto de partida"}</span>
                <span>antes: {num(s.anterior)}</span>
              </div>
            </div>
          );
        })}
        <p className="text-[10px] leading-relaxed text-white/30">
          Además, {num(data.kpis.conversacionesNuevas.actual)} clientes iniciaron una conversación nueva por el chat. Si cae el paso “vieron una ficha”, el problema
          está en los listados; si cae “contactaron”, en las fichas (fotos, tarifas, descripción).
        </p>
      </div>
    </Card>
  );
}

function Bar({ value, max, className = "bg-fuchsia-500/50" }: { value: number; max: number; className?: string }) {
  return (
    <div className="h-1.5 w-full min-w-[40px] rounded-full bg-white/[0.05]">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${max ? Math.max((value / max) * 100, 2) : 0}%` }} />
    </div>
  );
}

type Col<T> = { key: string; label: string; align?: "right"; render: (r: T) => ReactNode; className?: string };

function Table<T>({ rows, cols, empty = "Sin datos en el periodo", max = 12 }: { rows: T[]; cols: Col<T>[]; empty?: string; max?: number }) {
  if (!rows.length) return <div className="px-4 py-8 text-center text-xs text-white/25">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wide text-white/35">
            {cols.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? "text-white/70"}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateCell({ v, good = 20, bad = 5, inverse = false }: { v: number | null; good?: number; bad?: number; inverse?: boolean }) {
  if (v === null) return <span className="text-white/25">—</span>;
  const isGood = inverse ? v <= good : v >= good;
  const isBad = inverse ? v >= bad : v <= bad;
  return <span className={isGood ? "text-emerald-300" : isBad ? "text-rose-300" : "text-white/70"}>{pctTxt(v)}</span>;
}

function Acquisition({ data }: { data: Dashboard }) {
  const maxSes = Math.max(1, ...data.fuentes.map((f) => f.sesiones));
  return (
    <Section
      icon={Megaphone}
      title="Adquisición: de dónde viene la gente y cuál canal rinde"
      hint="Conversión = % de sesiones que terminan en al menos un contacto. Registros se atribuyen al canal de la primera visita de esa persona."
    >
      <div className="space-y-4">
        <Card title="Canales" action={<CsvButton name={`canales-${data.periodo.clave}`} rows={data.fuentes} />}>
          <Table
            rows={data.fuentes}
            cols={[
              { key: "c", label: "Canal", render: (r) => <span className="font-medium text-white/85">{r.etiqueta}</span> },
              { key: "s", label: "Sesiones", align: "right", render: (r) => num(r.sesiones) },
              { key: "b", label: "", render: (r) => <Bar value={r.sesiones} max={maxSes} /> },
              { key: "n", label: "Nuevos", align: "right", render: (r) => pctTxt(r.nuevosPct) },
              { key: "r", label: "Rebote", align: "right", render: (r) => <RateCell v={r.rebotePct} good={35} bad={65} inverse /> },
              { key: "k", label: "Contactos", align: "right", render: (r) => num(r.contactos) },
              { key: "cv", label: "Conversión", align: "right", render: (r) => <RateCell v={r.conversionPct} good={15} bad={5} /> },
              { key: "rc", label: "Reg. clientes", align: "right", render: (r) => num(r.registrosClientes) },
              { key: "ro", label: "Reg. anunciantes", align: "right", render: (r) => num(r.registrosOferentes) },
            ]}
          />
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Campañas (UTM)" action={<CsvButton name={`campanas-${data.periodo.clave}`} rows={data.campanas} />}>
            <Table
              rows={data.campanas}
              empty="Sin campañas etiquetadas. Usa ?utm_source=…&utm_medium=…&utm_campaign=… en tus enlaces."
              cols={[
                {
                  key: "c",
                  label: "Campaña",
                  render: (r) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white/85">{r.campana}</p>
                      <p className="truncate text-[10px] text-white/35">{[r.origen, r.medio].filter(Boolean).join(" / ") || "—"}</p>
                    </div>
                  ),
                },
                { key: "s", label: "Sesiones", align: "right", render: (r) => num(r.sesiones) },
                { key: "r", label: "Rebote", align: "right", render: (r) => <RateCell v={r.rebotePct} good={35} bad={65} inverse /> },
                { key: "k", label: "Contactos", align: "right", render: (r) => num(r.contactos) },
                { key: "cv", label: "Conv.", align: "right", render: (r) => <RateCell v={r.conversionPct} good={15} bad={5} /> },
                { key: "g", label: "Registros", align: "right", render: (r) => num(r.registros) },
              ]}
            />
          </Card>
          <Card title="Sitios que nos envían tráfico">
            <Table
              rows={data.dominios}
              cols={[
                { key: "d", label: "Dominio", render: (r) => <span className="text-white/80">{r.dominio}</span> },
                { key: "f", label: "Tipo", render: (r) => <span className="text-white/40">{data.fuentes.find((f) => f.fuente === r.fuente)?.etiqueta ?? r.fuente}</span> },
                { key: "s", label: "Sesiones", align: "right", render: (r) => num(r.sesiones) },
                { key: "cv", label: "Conv.", align: "right", render: (r) => <RateCell v={r.conversionPct} good={15} bad={5} /> },
              ]}
            />
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Landings({ data }: { data: Dashboard }) {
  return (
    <Section icon={Globe} title="Páginas de entrada" hint="La primera página que ve cada visita. Rebote alto = la página no engancha; conversión baja = no lleva a contactar.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Por sección">
          <Table
            rows={data.landingSecciones}
            cols={[
              { key: "s", label: "Sección", render: (r) => <span className="text-white/80">{r.seccion}</span> },
              { key: "e", label: "Entradas", align: "right", render: (r) => num(r.entradas) },
              { key: "r", label: "Rebote", align: "right", render: (r) => <RateCell v={r.rebotePct} good={35} bad={65} inverse /> },
              { key: "c", label: "Conversión", align: "right", render: (r) => <RateCell v={r.conversionPct} good={15} bad={5} /> },
            ]}
          />
        </Card>
        <Card title="Páginas concretas" action={<CsvButton name={`landings-${data.periodo.clave}`} rows={data.landings} />}>
          <Table
            rows={data.landings}
            cols={[
              { key: "p", label: "Página", render: (r) => <span className="block max-w-[260px] truncate text-white/80" title={r.pagina}>{r.pagina}</span> },
              { key: "e", label: "Entradas", align: "right", render: (r) => num(r.entradas) },
              { key: "r", label: "Rebote", align: "right", render: (r) => <RateCell v={r.rebotePct} good={35} bad={65} inverse /> },
              { key: "c", label: "Conv.", align: "right", render: (r) => <RateCell v={r.conversionPct} good={15} bad={5} /> },
            ]}
          />
        </Card>
      </div>
    </Section>
  );
}

const SEG_LABEL: Record<string, string> = {
  mobile: "Móvil",
  desktop: "Computador",
  tablet: "Tablet",
  desconocido: "Desconocido",
  app: "App instalada",
  web: "Navegador",
  nuevo: "Nuevos",
  recurrente: "Recurrentes",
};

function SegmentCard({ title, rows }: { title: string; rows: Segment[] }) {
  const total = rows.reduce((a, r) => a + r.sesiones, 0) || 1;
  return (
    <Card title={title}>
      <div className="space-y-3 p-4">
        {rows.length === 0 && <p className="text-xs text-white/25">Sin datos</p>}
        {rows.map((r) => (
          <div key={r.clave}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-white/75">{SEG_LABEL[r.clave] ?? r.clave}</span>
              <span className="tabular-nums text-white/50">
                {pctTxt((r.sesiones / total) * 100)} · {num(r.sesiones)}
              </span>
            </div>
            <Bar value={r.sesiones} max={total} />
            <p className="mt-1 text-[10px] text-white/35">
              Conversión <RateCell v={r.conversionPct} good={15} bad={5} />
              {r.rebotePct !== null && (
                <>
                  {" "}· rebote <RateCell v={r.rebotePct} good={35} bad={65} inverse />
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Audience({ data }: { data: Dashboard }) {
  return (
    <Section icon={Smartphone} title="Audiencia" hint="Compara cómo convierte cada tipo de visita para decidir formatos de anuncio y prioridades de diseño.">
      <div className="grid gap-4 md:grid-cols-3">
        <SegmentCard title="Dispositivo" rows={data.dispositivos} />
        <SegmentCard title="App vs navegador" rows={data.modos} />
        <SegmentCard title="Nuevos vs recurrentes" rows={data.audiencia} />
      </div>
    </Section>
  );
}

function Heatmap({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.heatmap.matriz.flat());
  const [tip, setTip] = useState<string | null>(null);
  return (
    <Section icon={Clock} title="¿Cuándo entra la gente?" hint="Sesiones por día y hora (Chile). Programa publicaciones, historias y pauta un poco antes de los picos.">
      <Card>
        <div className="overflow-x-auto p-4">
          <div className="min-w-[620px]">
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-[9px] text-white/30">
                  {h % 3 === 0 ? h : ""}
                </div>
              ))}
              {data.heatmap.dias.map((d, di) => (
                <FragmentRow key={d} label={d}>
                  {data.heatmap.matriz[di].map((v, h) => (
                    <div
                      key={h}
                      className="h-6 rounded-[3px]"
                      style={{ background: v ? `rgba(217,70,239,${0.12 + (v / max) * 0.83})` : "rgba(255,255,255,0.03)" }}
                      onMouseEnter={() => setTip(`${d} ${String(h).padStart(2, "0")}:00 — ${num(v)} sesiones`)}
                      onMouseLeave={() => setTip(null)}
                      title={`${d} ${String(h).padStart(2, "0")}:00 — ${num(v)} sesiones`}
                    />
                  ))}
                </FragmentRow>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
            <span>{tip ?? (data.heatmap.picos.length ? `Picos: ${data.heatmap.picos.map((p) => `${p.dia} ${String(p.hora).padStart(2, "0")}:00`).join(" · ")}` : "Sin datos")}</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/30">
              menos
              <span className="inline-block h-2.5 w-10 rounded-sm" style={{ background: "linear-gradient(90deg, rgba(217,70,239,0.12), rgba(217,70,239,0.95))" }} />
              más
            </span>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function FragmentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="flex items-center text-[10px] text-white/40">{label}</div>
      {children}
    </>
  );
}

function Geography({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.ciudades.map((c) => c.visitantes));
  return (
    <Section
      icon={MapPin}
      title="Demanda vs oferta por ciudad"
      hint="Ciudad del visitante (según su red) contra perfiles publicados ahí. Muchos visitantes por perfil = falta oferta: ahí conviene captar anunciantes."
    >
      <Card action={<CsvButton name={`ciudades-${data.periodo.clave}`} rows={data.ciudades} />} title="Ciudades">
        <Table
          rows={data.ciudades}
          max={20}
          cols={[
            {
              key: "c",
              label: "Ciudad",
              render: (r) => (
                <div>
                  <p className="text-white/85">{r.ciudad}</p>
                  <p className="text-[10px] text-white/30">{r.region}</p>
                </div>
              ),
            },
            { key: "v", label: "Visitantes", align: "right", render: (r) => num(r.visitantes) },
            { key: "b", label: "", render: (r) => <Bar value={r.visitantes} max={max} /> },
            { key: "k", label: "Contactos", align: "right", render: (r) => num(r.contactos) },
            { key: "p", label: "Perfiles publicados", align: "right", render: (r) => num(r.perfiles) },
            {
              key: "r",
              label: "Visitantes / perfil",
              align: "right",
              render: (r) =>
                r.perfiles === 0 && r.visitantes > 0 ? (
                  <span className="text-amber-300">sin oferta</span>
                ) : (
                  <span className={r.visitantesPorPerfil !== null && r.visitantesPorPerfil >= 30 ? "text-amber-300" : "text-white/70"}>
                    {r.visitantesPorPerfil?.toLocaleString("es-CL") ?? "—"}
                  </span>
                ),
            },
          ]}
        />
      </Card>
    </Section>
  );
}

function Searches({ data }: { data: Dashboard }) {
  const k = data.kpis;
  const sinPct = k.busquedas.actual ? ((k.busquedasSinResultados.actual ?? 0) / k.busquedas.actual) * 100 : null;
  return (
    <Section
      icon={Search}
      title="Qué busca la gente"
      hint={`${num(k.busquedas.actual)} búsquedas en el periodo; ${pctTxt(sinPct)} no encontró nada. Lo que no se encuentra es demanda que hoy se pierde.`}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Términos más buscados">
          <Table
            rows={data.busquedas.terminos}
            cols={[
              { key: "t", label: "Término", render: (r) => <span className="text-white/85">{r.termino}</span> },
              { key: "b", label: "Búsquedas", align: "right", render: (r) => num(r.busquedas) },
              {
                key: "s",
                label: "Sin resultado",
                align: "right",
                render: (r) => <span className={r.sinResultados ? "text-amber-300" : "text-white/40"}>{num(r.sinResultados)}</span>,
              },
            ]}
          />
        </Card>
        <Card title="Búsquedas sin resultados" action={<CsvButton name={`sin-resultados-${data.periodo.clave}`} rows={data.busquedas.sinResultados} />}>
          <Table
            rows={data.busquedas.sinResultados}
            empty="Todas las búsquedas encontraron algo."
            cols={[
              { key: "t", label: "Término", render: (r) => <span className="text-white/85">{r.termino}</span> },
              { key: "c", label: "Categoría", render: (r) => <span className="text-white/45">{r.categoria ?? "—"}</span> },
              { key: "l", label: "Ciudad", render: (r) => <span className="text-white/45">{r.ciudad ?? "—"}</span> },
              { key: "v", label: "Veces", align: "right", render: (r) => num(r.veces) },
            ]}
          />
        </Card>
      </div>
    </Section>
  );
}

function ProfileName({ p }: { p: Perfil }) {
  return (
    <Link href={`/profesional/${p.id}`} className="block min-w-0 hover:underline" target="_blank">
      <p className="truncate font-medium text-white/85">{p.nombre}</p>
      <p className="truncate text-[10px] text-white/30">{[p.ciudad, p.tier].filter(Boolean).join(" · ") || "—"}</p>
    </Link>
  );
}

function Profiles({ data }: { data: Dashboard }) {
  const cols: Col<Perfil>[] = [
    { key: "n", label: "Perfil", render: (p) => <ProfileName p={p} /> },
    { key: "v", label: "Visitantes", align: "right", render: (p) => num(p.visitantes) },
    { key: "w", label: "WhatsApp", align: "right", render: (p) => num(p.whatsapp) },
    { key: "t", label: "Llamadas", align: "right", render: (p) => num(p.telefono) },
    { key: "c", label: "Tasa", align: "right", render: (p) => <RateCell v={p.tasaContactoPct} good={15} bad={3} /> },
  ];
  return (
    <Section
      icon={Users}
      title="Anunciantes"
      hint="Los que más contactos reciben sirven como caso de éxito; los que tienen visitas pero casi no reciben contactos necesitan mejorar su ficha."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Más contactos" action={<CsvButton name={`top-perfiles-${data.periodo.clave}`} rows={data.perfiles.topContactos} />}>
          <Table rows={data.perfiles.topContactos} cols={cols} max={15} />
        </Card>
        <Card title="Visitas sin contactos (mejorar ficha)" action={<CsvButton name={`baja-conversion-${data.periodo.clave}`} rows={data.perfiles.bajaConversion} />}>
          <Table rows={data.perfiles.bajaConversion} cols={cols} empty="Ningún perfil con muchas visitas y menos de 3% de contacto." />
        </Card>
      </div>
    </Section>
  );
}

function Business({ data }: { data: Dashboard }) {
  const n = data.negocio;
  const maxP = Math.max(1, ...n.porProposito.map((p) => p.monto));
  const tiles: { label: string; value: string; help: string; warn?: boolean }[] = [
    { label: "Perfiles publicados", value: num(n.perfilesPublicados), help: "Activos y verificados hoy." },
    { label: "Membresías vigentes", value: num(n.membresiasActivas), help: `MRR estimado ${clp(n.mrrEstimadoClp)}.` },
    { label: "En período de prueba", value: num(n.perfilesEnPrueba), help: "Potenciales clientes a convertir en pago." },
    { label: "Vencen en 7 días", value: num(n.membresiasPorVencer7d), help: "Contactar para renovar.", warn: n.membresiasPorVencer7d > 0 },
    { label: "Vencidas en el periodo", value: num(n.membresiasVencidasEnPeriodo), help: "Posible fuga (churn) si no renovaron." },
    { label: "Ticket promedio", value: clp(n.ticketPromedioClp), help: "Ingresos ÷ pagos del periodo." },
    { label: "Leads por perfil", value: n.leadsPorPerfilPublicado?.toLocaleString("es-CL") ?? "—", help: "Valor que entrega UZEED a cada anunciante: úsalo en la venta." },
  ];
  return (
    <Section icon={Wallet} title="Negocio" hint={n.cobroActivo ? "El cobro de membresías está activo." : "El cobro de membresías está apagado: los perfiles se ven sin pagar."}>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 xl:col-span-2 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-xl border p-3 ${t.warn ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <p className="text-[11px] text-white/45">{t.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{t.value}</p>
              <p className="mt-1 text-[10px] leading-snug text-white/30">{t.help}</p>
            </div>
          ))}
        </div>
        <Card title={`Ingresos por concepto · ${clp(n.ingresosClp)}`}>
          <div className="space-y-3 p-4">
            {n.porProposito.length === 0 && <p className="text-xs text-white/25">Sin pagos en el periodo</p>}
            {n.porProposito.map((p) => (
              <div key={p.proposito}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-white/75">{PURPOSE_LABEL[p.proposito] ?? p.proposito}</span>
                  <span className="tabular-nums text-white/55">{clp(p.monto)}</span>
                </div>
                <Bar value={p.monto} max={maxP} className="bg-emerald-500/50" />
                <p className="mt-0.5 text-[10px] text-white/30">{num(p.pagos)} pagos</p>
              </div>
            ))}
            <p className="text-[10px] text-white/30">Las transferencias aprobadas de tokens se suman al total pero no aparecen en este desglose.</p>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function Criteria({ data }: { data: Dashboard }) {
  const entries = useMemo(() => Object.entries(data.criterios), [data.criterios]);
  return (
    <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/45">
      <summary className="cursor-pointer select-none text-white/55">Cómo se calcula cada número</summary>
      <ul className="mt-2 space-y-1">
        {entries.map(([k, v]) => (
          <li key={k}>
            <span className="text-white/65">{k}:</span> {v}
          </li>
        ))}
        <li>
          <span className="text-white/65">actualizado:</span> {new Date(data.generadoEl).toLocaleString("es-CL")} (se recalcula cada 5 minutos)
        </li>
      </ul>
    </details>
  );
}
