"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import {
  Camera,
  ChevronRight,
  CreditCard,
  Edit3,
  Eye,
  LayoutDashboard,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof Edit3;
  color: string;
};

export default function DashboardPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const membershipActive = useMemo(() => {
    if (!user?.membershipExpiresAt) return false;
    const d = new Date(user.membershipExpiresAt);
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
  }, [user?.membershipExpiresAt]);

  const isProfessional = user?.profileType === "PROFESSIONAL";
  const isShop = user?.profileType === "SHOP";
  const isViewer = user?.profileType === "VIEWER";
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const isMotel = (user?.profileType ?? "").toUpperCase() === "ESTABLISHMENT" || ["MOTEL", "MOTEL_OWNER"].includes((user?.role ?? "").toUpperCase());

  useEffect(() => {
    if (isMotel) window.location.href = "/dashboard/motel";
  }, [isMotel]);

  const handleSubscribe = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/billing/subscription/start", { method: "POST", body: JSON.stringify({}) });
      window.location.reload();
    } catch (e: any) {
      setError(e?.body?.message || e?.message || "No se pudo iniciar la suscripción. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const quickActions: QuickAction[] = useMemo(() => {
    const actions: QuickAction[] = [];
    if (isProfessional || isShop) {
      actions.push(
        { label: "Editar perfil", description: "Fotos, bio, servicios", href: "/dashboard/services", icon: Edit3, color: "text-fuchsia-400" },
        { label: "Mis mensajes", description: "Chat con clientes", href: "/chats", icon: MessageCircle, color: "text-blue-400" },
      );
    }
    if (isProfessional) {
      actions.push(
        { label: "Subir story", description: "Foto o video de 24h", href: "/dashboard/stories", icon: Camera, color: "text-pink-400" },
        { label: "Ver mi perfil", description: "Como lo ven los clientes", href: `/profesional/${user?.id ?? ""}`, icon: Eye, color: "text-violet-400" },
      );
    }
    if (isViewer) {
      actions.push(
        { label: "Explorar", description: "Descubre cerca tuyo", href: "/servicios", icon: Sparkles, color: "text-fuchsia-400" },
        { label: "Mensajes", description: "Conversaciones", href: "/chats", icon: MessageCircle, color: "text-blue-400" },
        { label: "Favoritos", description: "Perfiles guardados", href: "/favoritos", icon: Star, color: "text-amber-400" },
      );
    }
    actions.push(
      { label: "Mi cuenta", description: "Configuración", href: "/cuenta", icon: Settings, color: "text-white/60" },
    );
    return actions;
  }, [isProfessional, isShop, isViewer, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10">
          <User className="h-7 w-7 text-fuchsia-400" />
        </div>
        <h1 className="text-xl font-bold">Inicia sesión</h1>
        <p className="mt-2 text-sm text-white/60">Debes iniciar sesión para ver tu dashboard.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold transition hover:brightness-110"
        >
          Iniciar sesión <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const profileTypeLabel =
    isProfessional ? "Profesional" :
    isShop ? "Tienda" :
    isMotel ? "Establecimiento" :
    isViewer ? "Cliente" : user.profileType ?? "—";

  return (
    <div className="mx-auto max-w-3xl py-2 space-y-6">
      {/* ── Header card ── */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-600/[0.06] via-transparent to-violet-600/[0.04] p-5">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatarUrl} alt={user.username} size={56} className="border-2 border-fuchsia-500/30" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-fuchsia-400" />
              Dashboard
            </h1>
            <p className="text-sm text-white/60 truncate">{user.username}</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-white/40">Tipo</div>
            <div className="text-sm font-medium capitalize">{profileTypeLabel}</div>
          </div>
        </div>
      </div>

      {/* ── Quick actions grid ── */}
      <div>
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
      </div>

      {/* ── Membership status ── */}
      {(isProfessional || isShop) && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${membershipActive ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
              {membershipActive ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <CreditCard className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">
                Publicidad mensual
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  membershipActive
                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : "border border-amber-400/30 bg-amber-500/10 text-amber-300"
                }`}>
                  {membershipActive ? "Activa" : "Inactiva"}
                </span>
              </div>
              {user.membershipExpiresAt && (
                <div className="text-xs text-white/40 mt-0.5">
                  Vence: {fmtDate(user.membershipExpiresAt)}
                </div>
              )}
            </div>
          </div>

          {!membershipActive && (
            <p className="text-xs text-white/50 mb-4">
              Activa tu plan mensual para aparecer como perfil <span className="text-fuchsia-300 font-medium">activo</span> en el directorio y recibir más mensajes.
            </p>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 mb-3 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(168,85,247,0.2)]"
          >
            {busy ? "Procesando..." : membershipActive ? "Renovar plan" : "Activar publicidad mensual"}
          </button>

          <p className="mt-2 text-center text-[10px] text-white/30">
            Pago seguro. Se confirma automáticamente.
          </p>
        </div>
      )}

      {/* ── Viewer info ── */}
      {isViewer && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold">Perfil cliente</div>
              <div className="text-xs text-white/50">Explora categorías, chatea y solicita servicios. Sin costo.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tip for professionals ── */}
      {isProfessional && (
        <div className="rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-600/[0.06] to-transparent p-5">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-fuchsia-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Aumenta tu visibilidad</div>
              <p className="mt-1 text-xs text-white/50">
                Sube stories diariamente, completa tu perfil al 100% y mantén tu plan activo para aparecer primero en los resultados.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard/stories" className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 px-3 py-1.5 text-xs text-fuchsia-300 hover:bg-fuchsia-500/20 transition">
                  <Camera className="h-3 w-3" /> Subir story
                </Link>
                <Link href="/dashboard/services" className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 transition">
                  <Edit3 className="h-3 w-3" /> Completar perfil
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin link ── */}
      {isAdmin && (
        <Link
          href="/admin/pricing"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
        >
          <Settings className="h-5 w-5 text-white/50" />
          <div>
            <div className="text-sm font-medium">Panel de administración</div>
            <div className="text-xs text-white/40">Precios, banners, gestión</div>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
        </Link>
      )}
    </div>
  );
}
