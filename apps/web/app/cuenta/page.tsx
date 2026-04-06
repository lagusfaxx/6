"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import useMe from "../../hooks/useMe";
import useSubscriptionStatus from "../../hooks/useSubscriptionStatus";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { Badge } from "../../components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import {
  User, Settings, Image, MapPin, MessageSquare, Heart,
  CreditCard, LogOut, ExternalLink, Palette, ShoppingBag,
  Building, Sparkles, ChevronRight, Camera, Eye, Edit3,
  TrendingUp, Zap, Shield, Wallet, Video, RefreshCw,
  Gift, Copy, Check,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

type QuickLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof Edit3;
  color: string;
};

export default function AccountPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const { status: subscriptionStatus, loading: statusLoading } = useSubscriptionStatus();
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

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
  const isAdmin = role === "ADMIN";

  const isTrialPeriod = subscriptionStatus?.trialActive && !subscriptionStatus?.membershipActive;
  const profileLabel =
    isProfessional ? "Experiencia"
    : profileType === "ESTABLISHMENT" ? "Lugar"
    : isShop ? "Tienda"
    : "Cliente";

  const profileIcon =
    isProfessional ? <Sparkles className="h-4 w-4" />
    : profileType === "ESTABLISHMENT" ? <Building className="h-4 w-4" />
    : isShop ? <ShoppingBag className="h-4 w-4" />
    : <User className="h-4 w-4" />;

  const publicProfileUrl = user
    ? isProfessional ? `/profesional/${user.id}`
    : profileType === "ESTABLISHMENT" ? `/establecimiento/${user.id}`
    : isShop ? `/sexshop/${user.username}`
    : "/"
    : "/";

  // Quick actions grid (from dashboard)
  const quickActions: QuickAction[] = [];
  if (isProfessional || isShop) {
    quickActions.push(
      { label: "Editar perfil", description: "Fotos, bio, servicios", href: "/dashboard/services", icon: Edit3, color: "text-fuchsia-400" },
      { label: "Mis mensajes", description: "Chat con clientes", href: "/chats", icon: MessageSquare, color: "text-blue-400" },
    );
  }
  if (isProfessional) {
    quickActions.push(
      { label: "Subir story", description: "Foto o video de 24h", href: "/dashboard/stories", icon: Camera, color: "text-pink-400" },
      { label: "Ver mi perfil", description: "Como lo ven los clientes", href: publicProfileUrl, icon: Eye, color: "text-violet-400" },
    );
  }
  if (isProfessional) {
    quickActions.push(
      { label: "Videollamadas", description: "Config y reservas", href: "/videocall", icon: Video, color: "text-emerald-400" },
    );
  }
  if (!canManageProfile) {
    quickActions.push(
      { label: "Mi perfil", description: "Foto y nombre", href: "/cuenta/perfil", icon: Edit3, color: "text-violet-400" },
      { label: "Explorar", description: "Descubre cerca tuyo", href: "/servicios", icon: Sparkles, color: "text-fuchsia-400" },
      { label: "Mensajes", description: "Conversaciones", href: "/chats", icon: MessageSquare, color: "text-blue-400" },
      { label: "Favoritos", description: "Perfiles guardados", href: "/favoritos", icon: Heart, color: "text-rose-400" },
    );
  }
  // Wallet for all authenticated users
  quickActions.push(
    { label: "Billetera", description: "Tokens y saldo", href: "/wallet", icon: Wallet, color: "text-amber-400" },
  );

  const managementLinks: QuickLink[] = isMotelProfile
    ? [
        { href: "/dashboard/motel", label: "Dashboard Motel", icon: <Building className="h-4 w-4" />, description: "Panel principal" },
        { href: "/dashboard/motel?tab=rooms", label: "Habitaciones", icon: <Settings className="h-4 w-4" />, description: "Gestionar habitaciones" },
        { href: "/dashboard/motel?tab=promos", label: "Promociones", icon: <Palette className="h-4 w-4" />, description: "Ofertas activas" },
        { href: "/dashboard/motel?tab=location", label: "Ubicación", icon: <MapPin className="h-4 w-4" />, description: "Mapa y dirección" },
      ]
    : [
        { href: "/dashboard/services?tab=perfil", label: "Editar perfil", icon: <User className="h-4 w-4" />, description: "Info, bio y detalles" },
        { href: "/dashboard/services?tab=servicios", label: "Servicios", icon: <Settings className="h-4 w-4" />, description: "Gestionar publicaciones" },
        ...(isShop ? [{ href: "/dashboard/services?tab=productos", label: "Productos", icon: <ShoppingBag className="h-4 w-4" />, description: "Inventario y precios" }] : []),
        { href: "/dashboard/services?tab=galeria", label: "Galería", icon: <Image className="h-4 w-4" />, description: "Fotos y media" },
        { href: "/dashboard/services?tab=ubicacion", label: "Ubicación", icon: <MapPin className="h-4 w-4" />, description: "Mapa y dirección" },
      ];

  const links = canManageProfile ? managementLinks : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 pb-10">
      {loading ? (
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      ) : user ? (
        <motion.div initial="hidden" animate="visible" className="space-y-3">
          {/* Profile hero */}
          <motion.div custom={0} variants={fadeUp} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
            <div className="relative h-28 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(168,85,247,0.3),transparent_70%)]" />
            </div>

            <div className="relative px-5 pb-5">
              <div className="-mt-12 mb-3 flex justify-center">
                <div className="rounded-full p-[3px] bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
                  <Avatar
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
                    size={80}
                    className="border-[3px] border-[#0e0e12]"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-lg font-semibold leading-tight">{user.displayName || user.username}</h1>
                  <Badge className="flex items-center gap-1">
                    {profileIcon}
                    {profileLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-white/40">@{user.username}</p>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {canManageProfile && (
                  <Link href={publicProfileUrl} className="btn-secondary flex items-center gap-1.5 text-xs px-4 py-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver perfil
                  </Link>
                )}
                {canManageProfile && !isMotelProfile ? (
                  <Link href="/dashboard/services" className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2">
                    <Palette className="h-3.5 w-3.5" />
                    Creator Studio
                  </Link>
                ) : !canManageProfile ? (
                  <>
                    <Link href="/cuenta/perfil" className="btn-secondary flex items-center gap-1.5 text-xs px-4 py-2">
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar perfil
                    </Link>
                    <Link href="/servicios" className="btn-primary text-xs px-4 py-2">
                      Explorar servicios
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </motion.div>

          {/* Quick actions grid */}
          {quickActions.length > 0 && (
            <motion.div custom={1} variants={fadeUp}>
              <h2 className="mb-3 text-sm font-semibold text-white/50 flex items-center gap-2">
                <Zap className="h-4 w-4 text-fuchsia-400" />
                Acciones rápidas
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-fuchsia-500/20 hover:bg-white/[0.06] hover:-translate-y-0.5"
                    >
                      <Icon className={`h-5 w-5 mb-2 ${action.color}`} />
                      <div className="text-sm font-semibold">{action.label}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">{action.description}</div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Subscription — compact inline */}
          {requiresPayment && !statusLoading && subscriptionStatus && (
            <motion.div custom={2} variants={fadeUp} className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-4 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

              {/* Header row: title + badge + action */}
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-white/40 shrink-0" />
                <span className="text-sm font-semibold text-white/70 uppercase tracking-wider">Suscripción</span>
                {subscriptionStatus.isActive ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                    {subscriptionStatus.membershipActive ? "Activa" : "Prueba"}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Expirada</Badge>
                )}
                <span className="ml-auto text-xs text-white/50">
                  {subscriptionStatus.isActive
                    ? `${subscriptionStatus.daysRemaining || 0} días restantes`
                    : null}
                </span>
              </div>

              {/* Status details */}
              <div className="mt-3 space-y-2">
                {isTrialPeriod && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <p className="text-xs text-amber-300">
                      Plan de prueba — vence en <span className="font-semibold text-amber-400">{subscriptionStatus.daysRemaining || 0} días</span>
                    </p>
                  </div>
                )}

                {!subscriptionStatus.isActive && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                    Suscripción expirada. Renuévala para seguir visible.
                  </p>
                )}

                {subscriptionStatus.flowSubscriptionStatus === "active" ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-300 font-medium">PAC activo</span>
                      <span className="text-[11px] text-white/40">
                        {subscriptionStatus.flowCardType && subscriptionStatus.flowCardLast4
                          ? `${subscriptionStatus.flowCardType} ****${subscriptionStatus.flowCardLast4}`
                          : "Tarjeta registrada"}
                      </span>
                    </div>
                    <button onClick={handleSubscribe} className="text-[11px] text-white/40 hover:text-white/70 transition underline underline-offset-2">
                      Administrar
                    </button>
                  </div>
                ) : !isTrialPeriod ? (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-white/50">
                      ${(subscriptionStatus.subscriptionPrice || 4990).toLocaleString("es-CL")} CLP/mes
                    </span>
                    <button
                      onClick={handleSubscribe}
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-1.5 text-xs font-medium text-white transition-all hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                    >
                      {subscriptionStatus.isActive ? "Renovar" : "Suscribirse"}
                    </button>
                  </div>
                ) : null}

                {subscriptionStatus.recentPayments && subscriptionStatus.recentPayments.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06] mt-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Pagos:</span>
                    <div className="flex gap-3 overflow-x-auto">
                      {subscriptionStatus.recentPayments.slice(0, 3).map((payment) => (
                        <span key={payment.id} className="flex items-center gap-1.5 text-[11px] text-white/50 whitespace-nowrap">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            payment.status === "PAID" ? "bg-green-500" :
                            payment.status === "PENDING" ? "bg-yellow-500" :
                            "bg-red-500"
                          }`} />
                          {new Date(payment.createdAt).toLocaleDateString("es-CL")} · ${payment.amount.toLocaleString("es-CL")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Visibility tip + Referral — side by side */}
          {(isProfessional || profileType === "CREATOR") && (
            <motion.div custom={3} variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isProfessional && (
                <div className="rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-600/[0.06] to-transparent p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-fuchsia-400" />
                    <span className="text-sm font-semibold">Aumenta tu visibilidad</span>
                  </div>
                  <p className="text-xs text-white/50 mb-3">
                    Sube stories, completa tu perfil y activa UMate.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href="/dashboard/stories" className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-1 text-[11px] text-fuchsia-300 hover:bg-fuchsia-500/20 transition">
                      <Camera className="h-3 w-3" /> Story
                    </Link>
                    <Link href="/dashboard/services" className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 transition">
                      <Edit3 className="h-3 w-3" /> Perfil
                    </Link>
                    <Link href="/umate/account" className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-500/15 to-violet-500/15 border border-violet-500/20 px-2.5 py-1 text-[11px] text-violet-300 transition">
                      <Sparkles className="h-3 w-3" /> UMate
                    </Link>
                  </div>
                </div>
              )}
              <div className={isProfessional ? "" : "sm:col-span-2"}>
                <ReferralSection />
              </div>
            </motion.div>
          )}

          {/* Management links — horizontal grid */}
          {links.length > 0 && (
            <motion.div custom={4} variants={fadeUp}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60">
                      {link.icon}
                    </div>
                    <span className="text-xs font-medium text-white/80 text-center">{link.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Admin link */}
          {isAdmin && (
            <motion.div custom={5} variants={fadeUp}>
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 hover:bg-white/[0.06] transition"
              >
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">Panel de administración</span>
                <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
              </Link>
            </motion.div>
          )}

          {/* Logout */}
          <motion.div custom={6} variants={fadeUp}>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-sm text-white/40 transition-all hover:border-red-500/20 hover:bg-red-500/[0.04] hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-8 text-center overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
              <img
                src="/brand/isotipo-new.png"
                alt="UZEED"
                className="relative w-16 h-16 rounded-2xl"
              />
            </div>
          </div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">Accede a tu cuenta</h1>
          <p className="mt-2 text-sm text-white/50">
            Inicia sesión para guardar favoritos, chatear y más.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary px-6">Iniciar sesión</Link>
            <Link href="/register" className="btn-secondary px-6">Crear cuenta</Link>
          </div>
        </motion.div>
      )}
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
    return <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />;
  }

  if (!data?.hasCode) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-600/[0.06] px-4 py-3">
        <Gift className="h-4 w-4 text-violet-400 shrink-0" />
        <span className="text-sm text-white/60 flex-1">Invita amigas y gana por cada referida.</span>
        <button
          onClick={generateCode}
          disabled={generating}
          className="shrink-0 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white transition hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] disabled:opacity-50"
        >
          {generating ? "..." : "Obtener código"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-600/[0.06] px-4 py-3">
      <Gift className="h-4 w-4 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-widest">Código de amigo</p>
        <span className="text-base font-bold tracking-wider text-violet-300">{data.code}</span>
      </div>
      <button
        onClick={copyCode}
        className="shrink-0 flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 transition"
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
