"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Compass,
  CreditCard,
  Crown,
  Edit3,
  ExternalLink,
  Heart,
  ImageIcon,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserCircle2,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type CreatorInfo = { id: string; status: string } | null;
type CreatorStats = {
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};
type SubscriptionInfo = {
  active: boolean;
  plan?: { name: string; tier: string };
  slotsTotal?: number;
  slotsUsed?: number;
  slotsAvailable?: number;
  cycleEnd?: string;
  subscribedCreators?: { displayName: string; username: string }[];
};

type CreatorFull = {
  id: string;
  status: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
};

export default function UmateAccountPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorFull, setCreatorFull] = useState<CreatorFull | null>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const isCreator = Boolean(creatorFull && creatorFull.status !== "SUSPENDED");

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: CreatorFull }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
      apiFetch<SubscriptionInfo>("/umate/subscription/status").catch(() => null),
    ]).then(([c, st, sub]) => {
      const cr = c?.creator || null;
      setCreator(cr ? { id: cr.id, status: cr.status } : null);
      setCreatorFull(cr);
      if (cr) {
        setEditDisplayName(cr.displayName || "");
        setEditBio(cr.bio || "");
      }
      setCreatorStats(st);
      setSubscription(sub);
      setLoading(false);
    });
  }, []);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiBase()}/umate/creator/avatar`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.url) setCreatorFull((prev) => prev ? { ...prev, avatarUrl: json.url } : prev);
      }
    } catch {}
    setUploadingAvatar(false);
    if (avatarRef.current) avatarRef.current.value = "";
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiBase()}/umate/creator/cover`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.url) setCreatorFull((prev) => prev ? { ...prev, coverUrl: json.url } : prev);
      }
    } catch {}
    setUploadingCover(false);
    if (coverRef.current) coverRef.current.value = "";
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const res = await apiFetch<{ creator: CreatorFull }>("/umate/creator/profile", {
      method: "PUT",
      body: JSON.stringify({ displayName: editDisplayName, bio: editBio }),
    }).catch(() => null);
    if (res?.creator) {
      setCreatorFull(res.creator);
      setCreator({ id: res.creator.id, status: res.creator.status });
      setEditingProfile(false);
    }
    setSavingProfile(false);
  };

  const handleCancelSubscription = async () => {
    if (!confirm("¿Estás seguro de cancelar tu plan? Mantendrás acceso hasta el fin del ciclo.")) return;
    setCancelling(true);
    const res = await apiFetch<{ cancelled: boolean }>("/umate/subscription/cancel", { method: "POST" }).catch(() => null);
    if (res?.cancelled) {
      setSubscription((prev) => prev ? { ...prev, active: false } : prev);
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
        <p className="text-xs text-white/30">Cargando cuenta...</p>
      </div>
    );
  }

  // ─── CLIENT VIEW (no creator) ───
  if (!isCreator) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Mi cuenta</h1>
          <p className="mt-1 text-sm text-white/30">Gestiona tu perfil y suscripción.</p>
        </div>

        {/* User info card */}
        <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
              {me?.user?.avatarUrl ? (
                <img src={resolveMediaUrl(me.user.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg font-bold text-white/40">
                  {(me?.user?.displayName || me?.user?.username || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{me?.user?.displayName || me?.user?.username || "Usuario"}</h2>
              <p className="text-sm text-white/30">@{me?.user?.username || "—"}</p>
              <p className="mt-0.5 text-xs text-white/25">{me?.user?.email || ""}</p>
            </div>
          </div>
        </section>

        {/* Subscription */}
        <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30">
            <CreditCard className="h-4 w-4" /> Tu suscripción
          </h2>
          {subscription?.active ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-white">{subscription.plan?.name || "Plan activo"}</p>
                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">Activo</span>
                  </div>
                  <p className="mt-1 text-xs text-white/30">
                    {subscription.slotsUsed}/{subscription.slotsTotal} cupos usados · Vence {subscription.cycleEnd ? new Date(subscription.cycleEnd).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>

              {/* Slots visual */}
              {subscription.slotsTotal && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {Array.from({ length: subscription.slotsTotal }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full transition ${
                          i < (subscription.slotsUsed || 0) ? "bg-[#00aff0]" : "bg-white/[0.06]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-white/25">
                    {(subscription.slotsAvailable || 0) > 0
                      ? `${subscription.slotsAvailable} cupos disponibles para suscribirte a creadoras`
                      : "Todos los cupos utilizados"}
                  </p>
                </div>
              )}

              {/* Subscribed creators */}
              {subscription.subscribedCreators && subscription.subscribedCreators.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2">Suscripciones activas</p>
                  <div className="space-y-1">
                    {subscription.subscribedCreators.map((c) => (
                      <Link
                        key={c.username}
                        href={`/umate/profile/${c.username}`}
                        className="flex items-center gap-2 rounded-lg p-2 text-sm text-white/50 transition hover:bg-white/[0.03] hover:text-white/70"
                      >
                        <Star className="h-3.5 w-3.5 text-[#00aff0]/60" />
                        <span className="font-medium">{c.displayName}</span>
                        <span className="text-xs text-white/25">@{c.username}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/15 px-4 py-2 text-xs font-medium text-red-400/50 transition hover:bg-red-500/[0.06] hover:text-red-400 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Cancelar suscripción
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <div className="rounded-xl border border-[#00aff0]/10 bg-gradient-to-br from-[#00aff0]/[0.04] to-transparent p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00aff0]/10">
                  <Crown className="h-5 w-5 text-[#00aff0]" />
                </div>
                <p className="text-sm font-bold text-white/80">No tienes un plan activo</p>
                <p className="mt-1 text-xs text-white/30">Activa un plan para suscribirte a creadoras y acceder a contenido exclusivo.</p>
                <Link
                  href="/umate/plans"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition hover:shadow-[0_6px_28px_rgba(0,175,240,0.4)]"
                >
                  Ver planes <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Quick actions for client */}
        <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">Acciones rápidas</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { href: "/umate/explore", label: "Explorar contenido", desc: "Descubre nuevas creadoras", icon: Compass, color: "text-[#00aff0]" },
              { href: "/umate/plans", label: "Ver planes", desc: "Elige tu plan premium", icon: Crown, color: "text-amber-400" },
              { href: "/umate/onboarding", label: "Ser creadora", desc: "Crea tu perfil de creadora", icon: Sparkles, color: "text-purple-400" },
              { href: "/", label: "Volver a UZEED", desc: "Ir a la plataforma principal", icon: ExternalLink, color: "text-white/40" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-white/[0.04] p-3.5 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.08]"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] ${a.color}`}>
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white/70">{a.label}</p>
                  <p className="text-[11px] text-white/25">{a.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ─── CREATOR VIEW ───
  const checks = [
    { label: "Términos de servicio", ok: creatorStats?.termsAccepted, href: "/umate/terms", desc: "Lee y acepta los términos" },
    { label: "Reglas de la plataforma", ok: creatorStats?.rulesAccepted, href: "/umate/rules", desc: "Lee y acepta las reglas" },
    { label: "Contrato de creadora", ok: creatorStats?.contractAccepted, href: "/umate/onboarding", desc: "Completa en el onboarding" },
    { label: "Datos bancarios", ok: creatorStats?.bankConfigured, href: "/umate/onboarding", desc: "Configura en el onboarding" },
  ];
  const pendingCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Cuenta y ajustes</h1>
        <p className="mt-1 text-sm text-white/30">Perfil de creadora, datos legales y configuración.</p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4" /> {pendingCount} pendiente{pendingCount > 1 ? "s" : ""} para activar tu cuenta
          </div>
          <p className="mt-1 text-xs text-white/30">Completa el onboarding para poder publicar y recibir suscriptores.</p>
        </div>
      )}

      {/* Creator Profile Editor */}
      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] overflow-hidden">
        {/* Cover photo */}
        <div className="relative h-36 bg-gradient-to-br from-[#00aff0]/10 via-purple-600/[0.05] to-transparent sm:h-44">
          {creatorFull?.coverUrl && (
            <img src={resolveMediaUrl(creatorFull.coverUrl) || ""} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12]/80 to-transparent" />
          <button
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-xl bg-black/40 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-xl transition hover:bg-black/60 disabled:opacity-50"
          >
            {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {creatorFull?.coverUrl ? "Cambiar portada" : "Agregar portada"}
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCover} />
        </div>

        <div className="p-5">
          {/* Avatar + name */}
          <div className="-mt-14 flex items-end gap-4">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#0a0a12] bg-[#0a0a12] shadow-lg">
                {creatorFull?.avatarUrl ? (
                  <img src={resolveMediaUrl(creatorFull.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-white/[0.06] text-xl font-bold text-white/40">
                    {(creatorFull?.displayName || "?")[0]}
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h3 className="text-base font-bold text-white truncate">{creatorFull?.displayName}</h3>
              <p className="text-xs text-white/30">@{me?.user?.username || "—"}</p>
            </div>
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/40 transition hover:border-white/15 hover:text-white/60"
            >
              <Edit3 className="h-3 w-3" /> Editar perfil
            </button>
          </div>

          {/* Bio display */}
          {!editingProfile && creatorFull?.bio && (
            <p className="mt-3 text-sm text-white/40 leading-relaxed">{creatorFull.bio}</p>
          )}

          {/* Edit form */}
          {editingProfile && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Nombre público</label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Tu nombre de creadora"
                  className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/30"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Descripción / Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Cuéntale a tus fans sobre ti..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/30 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2 text-sm font-bold text-white transition disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Guardar
                </button>
                <button
                  onClick={() => { setEditingProfile(false); setEditDisplayName(creatorFull?.displayName || ""); setEditBio(creatorFull?.bio || ""); }}
                  className="rounded-xl border border-white/[0.06] px-4 py-2 text-sm text-white/30 transition hover:text-white/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Account info */}
      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30">
          <UserCircle2 className="h-4 w-4" /> Información de cuenta
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Username", value: `@${me?.user?.username || "—"}` },
            { label: "Nombre público", value: creatorFull?.displayName || me?.user?.displayName || "Sin definir" },
            { label: "Email", value: me?.user?.email || "—" },
            { label: "Estado", value: creator?.status === "ACTIVE" ? "Activa" : creator?.status === "PENDING_REVIEW" ? "En revisión" : creator?.status || "Pendiente", isStatus: true },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/[0.03] p-3.5">
              <p className="text-[11px] text-white/25">{item.label}</p>
              <p className={`mt-1 text-sm font-semibold ${
                "isStatus" in item && item.isStatus
                  ? creator?.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400"
                  : "text-white/70"
              }`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Legal & compliance */}
      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30">
          <ShieldCheck className="h-4 w-4" /> Legal y cumplimiento
        </h2>
        <div className="mt-4 space-y-2">
          {checks.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/[0.04] p-3.5 transition hover:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                {item.ok ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white/60">{item.label}</p>
                  <p className="text-[10px] text-white/25">{item.ok ? "Completado" : item.desc}</p>
                </div>
              </div>
              {!item.ok && (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#00aff0]/[0.08] px-3 py-1.5 text-xs font-semibold text-[#00aff0] transition hover:bg-[#00aff0]/15"
                >
                  Completar <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Términos", href: "/umate/terms" },
          { label: "Reglas", href: "/umate/rules" },
          { label: "Volver a UZEED", href: "/" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex items-center gap-1 rounded-xl border border-white/[0.04] px-3 py-2 text-xs font-medium text-white/30 transition hover:border-white/[0.08] hover:text-white/45"
          >
            {link.label} <ExternalLink className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
