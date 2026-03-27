"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CreditCard,
  Edit3,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  UserCircle2,
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>;

  const checks = [
    { label: "Términos de servicio", ok: creatorStats?.termsAccepted, href: "/umate/terms" },
    { label: "Reglas de la plataforma", ok: creatorStats?.rulesAccepted, href: "/umate/rules" },
    { label: "Contrato de creadora", ok: creatorStats?.contractAccepted, href: "#" },
    { label: "Datos bancarios", ok: creatorStats?.bankConfigured, href: "#" },
  ];
  const pendingCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Cuenta y ajustes</h1>
        <p className="mt-1 text-sm text-white/40">Perfil, datos legales y configuración.</p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4" /> {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
          </div>
          <p className="mt-1 text-xs text-white/40">Completa los requisitos para activar tu cuenta.</p>
        </div>
      )}

      {/* Creator Profile Editor */}
      {creatorFull && (
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
          {/* Cover photo */}
          <div className="relative h-36 bg-gradient-to-br from-[#00aff0]/15 via-purple-600/[0.08] to-transparent sm:h-44">
            {creatorFull.coverUrl && (
              <img src={resolveMediaUrl(creatorFull.coverUrl) || ""} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <button
              onClick={() => coverRef.current?.click()}
              disabled={uploadingCover}
              className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
            >
              {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {creatorFull.coverUrl ? "Cambiar portada" : "Agregar portada"}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCover} />
          </div>

          <div className="p-5">
            {/* Avatar + name */}
            <div className="-mt-14 flex items-end gap-4">
              <div className="relative">
                <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-[#08080d] bg-[#08080d] shadow-lg">
                  {creatorFull.avatarUrl ? (
                    <img src={resolveMediaUrl(creatorFull.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white/[0.08] text-xl font-bold text-white/50">
                      {(creatorFull.displayName || "?")[0]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => avatarRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#00aff0] text-white shadow-md transition hover:bg-[#00aff0]/90 disabled:opacity-50"
                >
                  {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h3 className="text-base font-bold text-white truncate">{creatorFull.displayName}</h3>
                <p className="text-xs text-white/40">@{me?.user?.username || "—"}</p>
              </div>
              <button
                onClick={() => setEditingProfile(!editingProfile)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/50 transition hover:border-white/20 hover:text-white/70"
              >
                <Edit3 className="h-3 w-3" /> Editar perfil
              </button>
            </div>

            {/* Bio display */}
            {!editingProfile && creatorFull.bio && (
              <p className="mt-3 text-sm text-white/50 leading-relaxed">{creatorFull.bio}</p>
            )}

            {/* Edit form */}
            {editingProfile && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Nombre público</label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Tu nombre de creadora"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Descripción / Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Cuéntale a tus fans sobre ti..."
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#00aff0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90 disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar
                  </button>
                  <button
                    onClick={() => { setEditingProfile(false); setEditDisplayName(creatorFull.displayName || ""); setEditBio(creatorFull.bio || ""); }}
                    className="rounded-full border border-white/[0.08] px-4 py-2 text-sm text-white/40 transition hover:text-white/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
          <UserCircle2 className="h-4 w-4" /> Información de cuenta
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Username", value: `@${me?.user?.username || "—"}` },
            { label: "Nombre público", value: creatorFull?.displayName || me?.user?.displayName || "Sin definir" },
            { label: "Email", value: me?.user?.email || "—" },
            { label: "Estado creadora", value: creator?.status || "No activa", isStatus: true },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[11px] text-white/40">{item.label}</p>
              <p className={`mt-1 text-sm font-semibold ${
                "isStatus" in item && item.isStatus
                  ? creator?.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400"
                  : "text-white/80"
              }`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Subscription */}
      {subscription && (
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
            <CreditCard className="h-4 w-4" /> Tu suscripción
          </h2>
          {subscription.active ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{subscription.plan?.name || "Plan activo"}</p>
                  <p className="text-xs text-white/40">
                    {subscription.slotsUsed}/{subscription.slotsTotal} cupos usados · Vence {subscription.cycleEnd ? new Date(subscription.cycleEnd).toLocaleDateString("es-CL") : "—"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400">Activo</span>
              </div>
              {subscription.subscribedCreators && subscription.subscribedCreators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {subscription.subscribedCreators.map((c) => (
                    <span key={c.username} className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/40">
                      @{c.username}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Cancelar suscripción
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-white/40">No tienes un plan activo.</p>
              <Link href="/umate/plans" className="mt-2 inline-block rounded-full bg-[#00aff0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
                Ver planes
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Legal */}
      <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
          <ShieldCheck className="h-4 w-4" /> Legal y cumplimiento
        </h2>
        <div className="mt-4 space-y-2">
          {checks.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/[0.04] p-3 transition hover:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-white/60">{item.label}</p>
                  <p className="text-[10px] text-white/45">{item.ok ? "Completado" : "Pendiente"}</p>
                </div>
              </div>
              {!item.ok && (
                <Link href={item.href} className="rounded-lg bg-[#00aff0]/10 px-3 py-1.5 text-xs font-semibold text-[#00aff0] transition hover:bg-[#00aff0]/20">
                  Completar
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
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium text-white/40 transition hover:border-white/[0.12] hover:text-white/50"
          >
            {link.label} <ExternalLink className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
