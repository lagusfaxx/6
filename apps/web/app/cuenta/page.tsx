"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import useMe from "../../hooks/useMe";
import useSubscriptionStatus from "../../hooks/useSubscriptionStatus";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { Badge } from "../../components/ui/badge";
import {
  User, Settings, Image, MapPin, MessageSquare, Heart,
  CreditCard, LogOut, ExternalLink, Palette, ShoppingBag,
  Building, Sparkles, ChevronRight,
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

export default function AccountPage() {
  const { me, loading } = useMe();
  const { status: subscriptionStatus, loading: statusLoading } = useSubscriptionStatus();
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleSubscribe = async () => {
    setPayError(null);
    setPayBusy(true);
    try {
      await apiFetch("/billing/subscription/start", { method: "POST", body: JSON.stringify({}) });
      window.location.reload();
    } catch (err: any) {
      const msg = err?.body?.message || err?.message || "Error al crear la suscripción. Intenta de nuevo.";
      setPayError(msg);
    } finally {
      setPayBusy(false);
    }
  };

  const profileType = (user?.profileType || "").toUpperCase();
  const role = (user?.role || "").toUpperCase();
  const isMotelProfile = profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);
  const requiresPayment = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(profileType);

  const isTrialPeriod = subscriptionStatus?.trialActive && !subscriptionStatus?.membershipActive;
  const profileLabel =
    profileType === "PROFESSIONAL"
      ? "Experiencia"
      : profileType === "ESTABLISHMENT"
        ? "Lugar"
        : profileType === "SHOP"
          ? "Tienda"
          : "Cliente";

  const profileIcon =
    profileType === "PROFESSIONAL"
      ? <Sparkles className="h-4 w-4" />
      : profileType === "ESTABLISHMENT"
        ? <Building className="h-4 w-4" />
        : profileType === "SHOP"
          ? <ShoppingBag className="h-4 w-4" />
          : <User className="h-4 w-4" />;

  const publicProfileUrl = user
    ? profileType === "PROFESSIONAL"
      ? `/profesional/${user.id}`
      : profileType === "ESTABLISHMENT"
        ? `/establecimiento/${user.id}`
        : profileType === "SHOP"
          ? `/sexshop/${user.username}`
          : "/"
    : "/";

  const managementLinks: QuickLink[] = isMotelProfile
    ? [
        { href: "/dashboard/motel", label: "Dashboard Motel", icon: <Building className="h-4 w-4" />, description: "Panel principal" },
        { href: "/dashboard/motel?tab=rooms", label: "Habitaciones", icon: <Settings className="h-4 w-4" />, description: "Gestionar habitaciones" },
        { href: "/dashboard/motel?tab=promos", label: "Promociones", icon: <Palette className="h-4 w-4" />, description: "Ofertas activas" },
        { href: "/dashboard/motel?tab=location", label: "Ubicación", icon: <MapPin className="h-4 w-4" />, description: "Mapa y dirección" },
        { href: "/chats", label: "Chats", icon: <MessageSquare className="h-4 w-4" />, description: "Mensajes directos" },
      ]
    : [
        { href: "/dashboard/services?tab=perfil", label: "Editar perfil", icon: <User className="h-4 w-4" />, description: "Info, bio y detalles" },
        { href: "/dashboard/services?tab=servicios", label: "Servicios", icon: <Settings className="h-4 w-4" />, description: "Gestionar publicaciones" },
        ...(profileType === "SHOP" ? [{ href: "/dashboard/services?tab=productos", label: "Productos", icon: <ShoppingBag className="h-4 w-4" />, description: "Inventario y precios" }] : []),
        { href: "/dashboard/services?tab=galeria", label: "Galería", icon: <Image className="h-4 w-4" />, description: "Fotos y media" },
        { href: "/dashboard/services?tab=ubicacion", label: "Ubicación", icon: <MapPin className="h-4 w-4" />, description: "Mapa y dirección" },
        { href: "/chats", label: "Chats", icon: <MessageSquare className="h-4 w-4" />, description: "Mensajes directos" },
      ];

  const clientLinks: QuickLink[] = [
    { href: "/favoritos", label: "Favoritos", icon: <Heart className="h-4 w-4" />, description: "Perfiles guardados" },
    { href: "/servicios", label: "Explorar", icon: <Sparkles className="h-4 w-4" />, description: "Buscar servicios" },
    { href: "/chats", label: "Chats", icon: <MessageSquare className="h-4 w-4" />, description: "Mensajes directos" },
  ];

  const links = canManageProfile ? managementLinks : clientLinks;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
      {loading ? (
        <div className="editor-card p-6 text-white/60 animate-pulse">Cargando...</div>
      ) : user ? (
        <motion.div initial="hidden" animate="visible" className="space-y-5">
          {/* Profile hero */}
          <motion.div custom={0} variants={fadeUp} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="relative h-32 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(168,85,247,0.3),transparent_70%)]" />
            </div>

            <div className="relative px-6 pb-6">
              <div className="-mt-14 mb-4 flex justify-center">
                <div className="rounded-full p-[3px] bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
                  <Avatar
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
                    size={96}
                    className="border-[3px] border-[#0e0e12]"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-xl font-semibold leading-tight">{user.displayName || user.username}</h1>
                  <Badge className="flex items-center gap-1">
                    {profileIcon}
                    {profileLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-white/40">@{user.username}</p>
              </div>

              <div className="mt-5 flex justify-center gap-3">
                {canManageProfile && (
                  <Link href={publicProfileUrl} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver perfil público
                  </Link>
                )}
                {canManageProfile && !isMotelProfile ? (
                  <Link href="/dashboard/services" className="btn-primary flex items-center gap-1.5 text-sm">
                    <Palette className="h-3.5 w-3.5" />
                    Creator Studio
                  </Link>
                ) : !canManageProfile ? (
                  <Link href="/servicios" className="btn-primary text-sm">
                    Explorar servicios
                  </Link>
                ) : null}
              </div>
            </div>
          </motion.div>

          {/* Subscription */}
          {requiresPayment && !statusLoading && subscriptionStatus && (
            <motion.div custom={1} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/50">
                  <CreditCard className="h-4 w-4" />
                  Suscripción
                </h2>
                {subscriptionStatus.isActive ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {subscriptionStatus.membershipActive ? "Activa" : "Prueba"}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    Expirada
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  {subscriptionStatus.isActive ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Días restantes:</span>
                        <span className="font-semibold text-white/90">
                          {subscriptionStatus.daysRemaining || 0} días
                        </span>
                      </div>
                      {subscriptionStatus.membershipExpiresAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/60">Vence el:</span>
                          <span className="text-white/90">
                            {new Date(subscriptionStatus.membershipExpiresAt).toLocaleDateString("es-CL")}
                          </span>
                        </div>
                      )}
                      {isTrialPeriod && (
                        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                          Período de prueba gratis
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                      Tu suscripción ha expirado. Renuévala para seguir visible.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm pt-3 border-t border-white/[0.06]">
                  <span className="text-white/60">Precio mensual:</span>
                  <span className="font-semibold text-white/90">
                    ${(subscriptionStatus.subscriptionPrice || 4990).toLocaleString("es-CL")} CLP
                  </span>
                </div>

                {payError && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                    {payError}
                  </p>
                )}
                <button
                  onClick={handleSubscribe}
                  disabled={payBusy}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payBusy
                    ? "Procesando..."
                    : subscriptionStatus.isActive
                      ? "Renovar suscripción"
                      : "Suscribirse al plan mensual"}
                </button>

                {subscriptionStatus.recentPayments && subscriptionStatus.recentPayments.length > 0 && (
                  <div className="pt-4 border-t border-white/[0.06]">
                    <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                      Últimos pagos
                    </p>
                    <div className="space-y-2">
                      {subscriptionStatus.recentPayments.slice(0, 3).map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between text-xs bg-white/[0.02] rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${
                              payment.status === "PAID" ? "bg-green-500" :
                              payment.status === "PENDING" ? "bg-yellow-500" :
                              "bg-red-500"
                            }`} />
                            <span className="text-white/60">
                              {new Date(payment.createdAt).toLocaleDateString("es-CL")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/90">${payment.amount.toLocaleString("es-CL")}</span>
                            <span className="text-white/40">
                              {payment.status === "PAID" ? "Pagado" : payment.status === "PENDING" ? "Pendiente" : "Fallido"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Quick links */}
          <motion.div custom={2} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
              Accesos rápidos
            </h2>
            <div className="space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60">
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/85">{link.label}</p>
                    {link.description && (
                      <p className="text-[11px] text-white/40">{link.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Logout */}
          <motion.div custom={3} variants={fadeUp}>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 text-sm text-white/40 transition-all hover:border-red-500/20 hover:bg-red-500/[0.04] hover:text-red-400"
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
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center"
        >
          <h1 className="text-xl font-semibold">Accede para guardar favoritos y chatear</h1>
          <p className="mt-2 text-sm text-white/50">
            Si solo quieres consumir servicios, crea cuenta Cliente. Si quieres publicar, usa registro profesional/comercio.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary">Iniciar sesión</Link>
            <Link href="/register" className="btn-secondary">Crear cuenta</Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
