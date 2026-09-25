"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import useMe from "../../hooks/useMe";
import useSubscriptionStatus from "../../hooks/useSubscriptionStatus";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import Avatar from "../../components/Avatar";
import EmailNotificationsToggle from "../../components/EmailNotificationsToggle";
import AutoReplySettings from "../../components/AutoReplySettings";
import { canOpenAdmin, isTeamStaff } from "../../lib/adminAccess";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  User, MessageSquare, Heart,
  CreditCard, LogOut, ExternalLink, Palette, ShoppingBag,
  Building, Sparkles, ChevronRight, Camera, Eye, Edit3,
  TrendingUp, Zap, Shield, ShieldCheck, Wallet, RefreshCw,
  Gift, Copy, Check, VenetianMask, ArrowRight, Bell, BadgeCheck,
  Settings,
} from "lucide-react";

type Tone = "fuchsia" | "blue" | "pink" | "violet" | "emerald" | "amber" | "rose";

/* Clases completas por tono: Tailwind sólo genera las que ve escritas. */
const TONES: Record<Tone, string> = {
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/20",
  blue: "bg-sky-500/15 text-sky-300 ring-sky-400/20",
  pink: "bg-pink-500/15 text-pink-300 ring-pink-400/20",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/20",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/20",
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof Edit3;
  tone: Tone;
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function Card({ title, icon, action, children, className = "" }: {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl ${className}`}>
      {title && (
        <header className="mb-4 flex items-center gap-2">
          {icon && <span className="text-fuchsia-300/70">{icon}</span>}
          <h2 className="text-sm font-semibold text-white/85">{title}</h2>
          {action && <div className="ml-auto">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  const cls = {
    ok: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    bad: "border-red-400/25 bg-red-500/10 text-red-300",
    neutral: "border-white/10 bg-white/[0.05] text-white/70",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const { status: subscriptionStatus, loading: statusLoading } = useSubscriptionStatus();
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const [umateCreatorStatus, setUmateCreatorStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: { status?: string } | null }>("/umate/creator/me")
      .then((d) => setUmateCreatorStatus(d?.creator?.status ?? null))
      .catch(() => setUmateCreatorStatus(null));
  }, [me]);
  const umateHref = umateCreatorStatus === "ACTIVE" ? "/umate/explore" : "/umate/onboarding";
  const umateDescription =
    umateCreatorStatus === "ACTIVE" ? "Ir a UMate"
    : umateCreatorStatus === "PENDING_REVIEW" ? "En revisión"
    : umateCreatorStatus ? "Continúa tu registro"
    : "Crea tu perfil UMate";

  const handleSubscribe = () => {
    router.push("/pago");
  };

  const profileType = (user?.profileType || "").toUpperCase();
  const role = (user?.role || "").toUpperCase();
  const isMotelProfile = profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const isProfessional = profileType === "PROFESSIONAL";
  const isShop = profileType === "SHOP";
  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);
  const requiresPayment = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);
  const canUpgradeToProfessional = profileType === "CLIENT";
  /* El panel lo abren el administrador y las cuentas de equipo. Antes esto
     miraba sólo ADMIN y el equipo no tenía por dónde entrar: había que
     escribir /admin a mano en la barra del navegador. */
  const canSeeAdminPanel = canOpenAdmin(user);
  const isTeamAccount = isTeamStaff(user);

  const isTrialPeriod = subscriptionStatus?.trialActive && !subscriptionStatus?.membershipActive;
  const profileLabel =
    isProfessional ? "Experiencia"
    : profileType === "ESTABLISHMENT" ? "Lugar"
    : isShop ? "Tienda"
    : "Cliente";

  const profileIcon =
    isProfessional ? <Sparkles className="h-3.5 w-3.5" />
    : profileType === "ESTABLISHMENT" ? <Building className="h-3.5 w-3.5" />
    : isShop ? <ShoppingBag className="h-3.5 w-3.5" />
    : <User className="h-3.5 w-3.5" />;

  const publicProfileUrl = user
    ? isProfessional ? `/profesional/${user.id}`
    : profileType === "ESTABLISHMENT" ? `/establecimiento/${user.id}`
    : isShop ? `/sexshop/${user.username}`
    : "/"
    : "/";

  const quickActions: QuickAction[] = [];
  if (isProfessional || isShop) {
    quickActions.push(
      { label: "Editar perfil", description: "Fotos, bio, servicios", href: "/dashboard/services", icon: Edit3, tone: "fuchsia" },
      { label: "Mis mensajes", description: "Chat con clientes", href: "/chats", icon: MessageSquare, tone: "blue" },
    );
  }
  if (isProfessional) {
    quickActions.push(
      { label: "Subir historia", description: "Foto o video de 20 días", href: "/dashboard/stories?nueva=1", icon: Camera, tone: "pink" },
      { label: "Ver mi perfil", description: "Como lo ven los clientes", href: publicProfileUrl, icon: Eye, tone: "violet" },
      { label: "Marketplace", description: "Vende tus artículos", href: "/marketplace/vender", icon: ShoppingBag, tone: "emerald" },
      { label: "Acreditar exámenes", description: "Sube documentos profesionales", href: "/cuenta/acreditacion", icon: ShieldCheck, tone: "blue" },
    );
  }
  if (!canManageProfile) {
    quickActions.push(
      { label: "Mi perfil", description: "Foto y nombre", href: "/cuenta/perfil", icon: Edit3, tone: "violet" },
      { label: "Explorar", description: "Descubre cerca tuyo", href: "/services", icon: Sparkles, tone: "fuchsia" },
      { label: "Mensajes", description: "Conversaciones", href: "/chats", icon: MessageSquare, tone: "blue" },
      { label: "Favoritos", description: "Perfiles guardados", href: "/favoritos", icon: Heart, tone: "rose" },
    );
  }
  quickActions.push(
    { label: "Billetera", description: "Tokens y saldo", href: "/wallet", icon: Wallet, tone: "amber" },
    { label: "UMate", description: umateDescription, href: umateHref, icon: Sparkles, tone: "violet" },
  );

  const showVisibility = isProfessional || profileType === "CREATOR";
  const coverSrc = resolveMediaUrl(user?.coverUrl);

  /* Resumen del plan en una píldora del hero, para no tener que bajar a verlo. */
  const planPill = (() => {
    if (!requiresPayment || statusLoading || !subscriptionStatus) return null;
    if (subscriptionStatus.billingEnabled === false) return <StatusPill tone="ok">Publicación gratis</StatusPill>;
    if (!subscriptionStatus.isActive) return <StatusPill tone="bad">Plan vencido</StatusPill>;
    return (
      <StatusPill tone={isTrialPeriod ? "warn" : "ok"}>
        {isTrialPeriod ? "Prueba" : "Plan activo"} · {subscriptionStatus.daysRemaining || 0} días
      </StatusPill>
    );
  })();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
        <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-56 rounded-2xl bg-white/5 animate-pulse lg:col-span-2" />
          <div className="h-56 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md pb-10">
        <motion.div
          {...fadeUp()}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl" />
              <img src="/brand/isotipo-new.png" alt="UZEED" className="relative h-16 w-16 rounded-2xl" />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-xl font-semibold text-transparent">
            Accede a tu cuenta
          </h1>
          <p className="mt-2 text-sm text-white/50">Inicia sesión para guardar favoritos, chatear y más.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary px-6">Iniciar sesión</Link>
            <Link href="/register" className="btn-secondary px-6">Crear cuenta</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
      {/* ── Hero ── */}
      <motion.section
        {...fadeUp()}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0f0d15] shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="relative h-32 sm:h-40">
          {coverSrc ? (
            <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-700/50 via-fuchsia-600/30 to-rose-500/20">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-fuchsia-500/30 blur-3xl" />
              <div className="absolute right-0 -top-10 h-48 w-48 rounded-full bg-violet-500/30 blur-3xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d15] via-[#0f0d15]/30 to-transparent" />
        </div>

        <div className="relative -mt-14 px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="shrink-0 self-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 p-[3px] shadow-[0_0_30px_rgba(192,38,211,0.35)] sm:self-auto">
              <Avatar
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                size={96}
                className="border-[3px] border-[#0f0d15]"
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
              <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {user.displayName || user.username}
                </h1>
                {user.isVerified && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-sky-400" aria-label="Verificada" />
                )}
              </div>
              <p className="mt-0.5 text-sm text-white/45">@{user.username}</p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <StatusPill tone="neutral">{profileIcon}{profileLabel}</StatusPill>
                {planPill}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:pb-1">
              {canManageProfile && (
                <Link href={publicProfileUrl} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver perfil
                </Link>
              )}
              {canManageProfile && !isMotelProfile ? (
                <Link href="/dashboard/services" className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
                  <Palette className="h-3.5 w-3.5" />
                  Creator Studio
                </Link>
              ) : !canManageProfile ? (
                <>
                  <Link href="/cuenta/perfil" className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar perfil
                  </Link>
                  <Link href="/services" className="btn-primary px-4 py-2 text-xs">
                    Explorar servicios
                  </Link>
                </>
              ) : null}
            </div>
          </div>

        </div>
      </motion.section>

      {/* ── Conviértete en profesional (clientes) ── */}
      {canUpgradeToProfessional && (
        <motion.div {...fadeUp(0.05)}>
          <Link
            href="/cuenta/convertir-profesional"
            className="group relative block overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/15 to-pink-600/20 p-5 transition hover:border-fuchsia-400/50"
          >
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 shadow-lg shadow-fuchsia-500/20">
                <VenetianMask className="h-6 w-6 text-fuchsia-100" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-white">Conviértete en profesional</span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-white/60">
                  Publica tu perfil y empieza a recibir clientes. Necesitas fotos, género, nombre y tipo de servicio.
                </p>
              </div>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20 sm:flex">
                <ArrowRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Columna principal ── */}
        <motion.div {...fadeUp(0.08)} className="space-y-4 lg:col-span-2">
          <Card title="Accesos rápidos" icon={<Zap className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.05]"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${TONES[action.tone]} transition-transform group-hover:scale-105`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight text-white/90">{action.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{action.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* ── Suscripción ── */}
          {requiresPayment && !statusLoading && subscriptionStatus?.billingEnabled === false && (
            <Card
              title="Suscripción"
              icon={<CreditCard className="h-4 w-4" />}
              action={<StatusPill tone="ok">Gratis</StatusPill>}
            >
              <p className="text-sm leading-relaxed text-white/55">
                Por ahora publicar en UZEED es gratis: tu perfil está visible sin pagar nada. Te avisaremos antes de que
                empiece el cobro.
              </p>
            </Card>
          )}

          {requiresPayment && !statusLoading && subscriptionStatus && subscriptionStatus.billingEnabled !== false && (
            <Card
              title="Suscripción"
              icon={<CreditCard className="h-4 w-4" />}
              action={
                subscriptionStatus.isActive ? (
                  <StatusPill tone="ok">{subscriptionStatus.membershipActive ? "Activa" : "Prueba"}</StatusPill>
                ) : (
                  <StatusPill tone="bad">Expirada</StatusPill>
                )
              }
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {subscriptionStatus.isActive ? subscriptionStatus.daysRemaining || 0 : 0}
                    <span className="ml-1.5 text-sm font-medium text-white/40">días restantes</span>
                  </p>
                  {!isTrialPeriod && subscriptionStatus.flowSubscriptionStatus !== "active" && (
                    <p className="mt-1 text-xs text-white/45">
                      ${(subscriptionStatus.subscriptionPrice || 4990).toLocaleString("es-CL")} CLP/mes
                    </p>
                  )}
                </div>
                {subscriptionStatus.flowSubscriptionStatus !== "active" && !isTrialPeriod && (
                  <button onClick={handleSubscribe} className="btn-primary px-5 py-2 text-xs">
                    {subscriptionStatus.isActive ? "Renovar" : "Suscribirse"}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {isTrialPeriod && (
                  <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Plan de prueba — vence en{" "}
                    <span className="font-semibold text-amber-400">{subscriptionStatus.daysRemaining || 0} días</span>
                  </p>
                )}

                {subscriptionStatus.inGrace && subscriptionStatus.graceEndsAt && !subscriptionStatus.membershipActive && (
                  <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Comenzó el cobro de membresías. Tu perfil sigue visible hasta el{" "}
                    <span className="font-semibold">
                      {new Date(subscriptionStatus.graceEndsAt).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
                    </span>
                    ; activa tu plan antes para no dejar de aparecer.
                  </p>
                )}

                {!subscriptionStatus.isActive && (
                  <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    Tu perfil está oculto porque no tienes un plan vigente. Actívalo para volver a aparecer.
                  </p>
                )}

                {subscriptionStatus.flowSubscriptionStatus === "active" && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-300">PAC activo</span>
                      <span className="truncate text-[11px] text-white/40">
                        {subscriptionStatus.flowCardType && subscriptionStatus.flowCardLast4
                          ? `${subscriptionStatus.flowCardType} ****${subscriptionStatus.flowCardLast4}`
                          : "Tarjeta registrada"}
                      </span>
                    </div>
                    <button
                      onClick={handleSubscribe}
                      className="shrink-0 text-[11px] text-white/45 underline underline-offset-2 transition hover:text-white/75"
                    >
                      Administrar
                    </button>
                  </div>
                )}
              </div>

              {subscriptionStatus.recentPayments && subscriptionStatus.recentPayments.length > 0 && (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Últimos pagos</p>
                  <ul className="space-y-1.5">
                    {subscriptionStatus.recentPayments.slice(0, 3).map((payment) => (
                      <li key={payment.id} className="flex items-center gap-2 text-xs text-white/55">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          payment.status === "PAID" ? "bg-green-500"
                          : payment.status === "PENDING" ? "bg-yellow-500"
                          : "bg-red-500"
                        }`} />
                        {new Date(payment.createdAt).toLocaleDateString("es-CL")}
                        <span className="ml-auto font-medium text-white/70">${payment.amount.toLocaleString("es-CL")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* ── Visibilidad ── */}
          {isProfessional && (
            <Card title="Aumenta tu visibilidad" icon={<TrendingUp className="h-4 w-4" />}>
              <p className="mb-4 text-sm text-white/50">Sube stories, completa tu perfil y activa UMate.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Link href="/dashboard/stories?nueva=1" className="flex items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/10 px-3 py-2.5 text-xs font-medium text-pink-200 transition hover:bg-pink-500/20">
                  <Camera className="h-4 w-4" /> Subir story
                </Link>
                <Link href="/dashboard/services" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-white/75 transition hover:bg-white/10">
                  <Edit3 className="h-4 w-4" /> Editar perfil
                </Link>
                <Link href={umateHref} className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20">
                  <Sparkles className="h-4 w-4" /> UMate
                </Link>
              </div>
              <Link
                href="/planes"
                className="group mt-3 flex items-center gap-3 rounded-xl border border-amber-400/15 bg-gradient-to-r from-amber-500/[0.08] to-transparent px-4 py-3 transition hover:border-amber-400/30"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white/85">Planes y boosts</span>
                  <span className="block text-xs text-white/40">Gold, Diamond y boosts para destacar tu perfil</span>
                </span>
                <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5" />
              </Link>
            </Card>
          )}
        </motion.div>

        {/* ── Columna lateral ── */}
        <motion.div {...fadeUp(0.12)} className="space-y-4">
          {showVisibility && <ReferralSection />}

          <Card title="Notificaciones" icon={<Bell className="h-4 w-4" />}>
            <div className="space-y-2">
              <EmailNotificationsToggle />
              {/* Solo las profesionales reciben clientes por chat. */}
              {isProfessional && <AutoReplySettings />}
            </div>
          </Card>

          <Card title="Cuenta" icon={<Settings className="h-4 w-4" />} className="!p-2 [&>header]:px-3 [&>header]:pt-3">
            <div className="flex flex-col">
              {canSeeAdminPanel && (
                <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/75 transition hover:bg-white/[0.04]">
                  <Shield className="h-4 w-4 text-amber-400" />
                  {isTeamAccount ? "Panel de equipo" : "Panel de administración"}
                  <ChevronRight className="ml-auto h-4 w-4 text-white/20" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-300/80 transition hover:bg-red-500/[0.07] hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Referral Program Section ─── */

function ReferralSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/referrals/stats");
      if (res && typeof res === "object") setData(res);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      await apiFetch<any>("/referrals/code", { method: "POST" });
      await fetchStats();
    } catch {}
    setGenerating(false);
  };

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />;
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/[0.14] via-fuchsia-600/[0.06] to-transparent p-5">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/25">
            <Gift className="h-4 w-4 text-violet-300" />
          </span>
          <h2 className="text-sm font-semibold text-white/90">Invita y gana</h2>
        </div>

        {!data?.hasCode ? (
          <>
            <p className="mt-3 text-xs leading-relaxed text-white/55">Invita amigas y gana por cada referida.</p>
            <button
              onClick={generateCode}
              disabled={generating}
              className="btn-primary mt-4 w-full py-2 text-xs disabled:opacity-50"
            >
              {generating ? "Generando..." : "Obtener mi código"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">Tu código de amigo</p>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-violet-400/30 bg-black/20 py-2 pl-4 pr-2">
              <span className="min-w-0 flex-1 truncate font-mono text-lg font-bold tracking-wider text-violet-200">{data.code}</span>
              <button
                onClick={copyCode}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/15"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
