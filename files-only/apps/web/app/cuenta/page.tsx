"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import useMe from "../../hooks/useMe";
import useSubscriptionStatus from "../../hooks/useSubscriptionStatus";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { Badge } from "../../components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function AccountPage() {
  const { me, loading } = useMe();
  const { status: subscriptionStatus, loading: statusLoading } =
    useSubscriptionStatus();
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const user = me?.user ?? null;

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleSubscribe = async () => {
    setPayError(null);
    setPayBusy(true);
    try {
      await apiFetch("/billing/subscription/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      // Subscription created — webhook will activate membership
      window.location.reload();
    } catch (err: any) {
      const msg =
        err?.body?.message ||
        err?.message ||
        "Error al crear la suscripción. Intenta de nuevo.";
      setPayError(msg);
    } finally {
      setPayBusy(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!user) return;
    setAvailabilityBusy(true);
    try {
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          isAvailableNow: !Boolean((user as any).isAvailableNow),
        }),
      });
      window.location.reload();
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const profileType = (user?.profileType || "").toUpperCase();
  const role = (user?.role || "").toUpperCase();
  const isMotelProfile =
    profileType === "ESTABLISHMENT" ||
    role === "MOTEL" ||
    role === "MOTEL_OWNER";
  const canManageProfile = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(
    profileType,
  );
  const requiresPayment = ["PROFESSIONAL", "SHOP", "ESTABLISHMENT"].includes(
    profileType,
  );

  // Compute derived subscription values
  const isTrialPeriod =
    subscriptionStatus?.trialActive && !subscriptionStatus?.membershipActive;
  const profileLabel =
    profileType === "PROFESSIONAL"
      ? "Experiencia"
      : profileType === "ESTABLISHMENT"
        ? "Lugar"
        : profileType === "SHOP"
          ? "Tienda"
          : "Cliente";

  const publicProfileUrl = user
    ? profileType === "PROFESSIONAL"
      ? `/profesional/${user.id}`
      : profileType === "ESTABLISHMENT"
        ? `/establecimiento/${user.id}`
        : profileType === "SHOP"
          ? `/sexshop/${user.username}`
          : "/"
    : "/";

  /* ── Quick-link definitions ── */
  const managementLinks = isMotelProfile
    ? [
        { href: "/dashboard/motel", label: "Dashboard Motel" },
        { href: "/dashboard/motel?tab=bookings", label: "Reservas" },
        { href: "/dashboard/motel?tab=rooms", label: "Habitaciones" },
        { href: "/dashboard/motel?tab=promos", label: "Promociones" },
        { href: "/dashboard/motel?tab=location", label: "Ubicación" },
      ]
    : [
        { href: "/dashboard/services?tab=perfil", label: "Editar perfil" },
        {
          href: "/dashboard/services?tab=servicios",
          label: "Gestionar servicio",
        },
        ...(profileType === "SHOP"
          ? [{ href: "/dashboard/services?tab=productos", label: "Productos" }]
          : []),
        { href: "/dashboard/services?tab=galeria", label: "Galería" },
        { href: "/dashboard/services?tab=ubicacion", label: "Ubicación" },
        { href: "/chats", label: "Chats" },
      ];

  const clientLinks = [
    { href: "/favoritos", label: "Favoritos" },
    { href: "/servicios", label: "Solicitudes" },
    { href: "/chats", label: "Chats" },
  ];

  const links = canManageProfile ? managementLinks : clientLinks;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
      {loading ? (
        <div className="editor-card p-6 text-white/60 animate-pulse">
          Cargando...
        </div>
      ) : user ? (
        <motion.div initial="hidden" animate="visible" className="space-y-5">
          {/* ── Profile hero ── */}
          <motion.div
            custom={0}
            variants={fadeUp}
            className="editor-card overflow-hidden"
          >
            {/* Mini cover gradient */}
            <div className="relative h-28 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-transparent" />

            <div className="relative px-6 pb-6">
              {/* Avatar overlapping cover */}
              <div className="-mt-12 mb-4 flex justify-center">
                <div className="rounded-full p-[3px] bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
                  <Avatar
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
                    size={88}
                    className="border-2 border-[#0e0e12]"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-xl font-semibold leading-tight">
                    {user.displayName || user.username}
                  </h1>
                  <Badge>{profileLabel}</Badge>
                </div>
                <p className="mt-1 text-sm text-white/40">@{user.username}</p>
              </div>

              {/* Public profile link */}
              <div className="mt-5 flex justify-center">
                {canManageProfile ? (
                  <Link href={publicProfileUrl} className="btn-primary text-sm">
                    Ver mi perfil público
                  </Link>
                ) : (
                  <Link href="/servicios" className="btn-primary text-sm">
                    Explorar servicios
                  </Link>
                )}
              </div>
            </div>
          </motion.div>

          {canManageProfile ? (
            <motion.div
              custom={0.5}
              variants={fadeUp}
              className="editor-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">Estado de moderación</p>
                  <p className="font-semibold">
                    {(user as any).moderationStatus || "APPROVED"}
                  </p>
                </div>
                {profileType === "PROFESSIONAL" ? (
                  <button
                    onClick={handleToggleAvailability}
                    disabled={availabilityBusy}
                    className="rounded-xl border border-white/15 px-3 py-2 text-sm"
                  >
                    {availabilityBusy
                      ? "Actualizando..."
                      : Boolean((user as any).isAvailableNow)
                        ? "Desactivar Disponible ahora"
                        : "Activar Disponible ahora"}
                  </button>
                ) : null}
              </div>
              {(user as any).moderationStatus === "PENDING_REVIEW" ? (
                <p className="mt-2 text-xs text-amber-300">
                  Tu perfil está en revisión y aún no aparece en el
                  mapa/explore.
                </p>
              ) : null}
            </motion.div>
          ) : null}

          {/* ── Creator Studio CTA (only for manageable profiles) ── */}
          {canManageProfile && !isMotelProfile && (
            <motion.div custom={1} variants={fadeUp}>
              <Link
                href="/dashboard/services"
                className="editor-card group flex items-center gap-4 px-6 py-5 transition-all hover:border-violet-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.12)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-lg shadow-lg">
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white/90 group-hover:text-white transition-colors">
                    Creator Studio
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Edita tu perfil completo con vista previa en tiempo real
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir →
                </span>
              </Link>
            </motion.div>
          )}

          {/* ── Payment Management (only for business profiles) ── */}
          {requiresPayment && !statusLoading && subscriptionStatus && (
            <motion.div
              custom={2}
              variants={fadeUp}
              className="editor-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
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
                {/* Status info */}
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
                            {new Date(
                              subscriptionStatus.membershipExpiresAt,
                            ).toLocaleDateString("es-CL")}
                          </span>
                        </div>
                      )}
                      {isTrialPeriod && (
                        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                          ⚡ Período de prueba gratis
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                      Tu suscripción ha expirado. Renuévala para seguir visible.
                    </p>
                  )}
                </div>

                {/* Price info */}
                <div className="flex items-center justify-between text-sm pt-3 border-t border-white/[0.06]">
                  <span className="text-white/60">Precio mensual:</span>
                  <span className="font-semibold text-white/90">
                    $
                    {(
                      subscriptionStatus.subscriptionPrice || 4990
                    ).toLocaleString("es-CL")}{" "}
                    CLP
                  </span>
                </div>

                {/* Subscribe / Renew button */}
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

                {/* Recent payments */}
                {subscriptionStatus.recentPayments &&
                  subscriptionStatus.recentPayments.length > 0 && (
                    <div className="pt-4 border-t border-white/[0.06]">
                      <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                        Últimos pagos
                      </p>
                      <div className="space-y-2">
                        {subscriptionStatus.recentPayments
                          .slice(0, 3)
                          .map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between text-xs bg-white/[0.02] rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    payment.status === "PAID"
                                      ? "bg-green-500"
                                      : payment.status === "PENDING"
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                  }`}
                                />
                                <span className="text-white/60">
                                  {new Date(
                                    payment.createdAt,
                                  ).toLocaleDateString("es-CL")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white/90">
                                  ${payment.amount.toLocaleString("es-CL")}
                                </span>
                                <span className="text-white/40 capitalize">
                                  {payment.status === "PAID"
                                    ? "Pagado"
                                    : payment.status === "PENDING"
                                      ? "Pendiente"
                                      : "Fallido"}
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

          {/* ── Quick links grid ── */}
          <motion.div custom={3} variants={fadeUp} className="editor-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-4">
              Accesos rápidos
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="studio-link-card"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* ── Logout ── */}
          <motion.div custom={4} variants={fadeUp}>
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 text-sm text-white/40 transition-all hover:border-red-500/20 hover:bg-red-500/[0.04] hover:text-red-400"
            >
              Cerrar sesión
            </button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="editor-card p-8 text-center"
        >
          <h1 className="text-xl font-semibold">
            Accede para guardar favoritos y chatear
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Si solo quieres consumir servicios, crea cuenta Cliente. Si quieres
            publicar, usa registro profesional/comercio.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary">
              Iniciar sesión
            </Link>
            <Link href="/register" className="btn-secondary">
              Crear cuenta
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
