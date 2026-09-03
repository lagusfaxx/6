"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Search,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MapPin,
  Mail,
  Copy,
  ScanFace,
  Send,
  ShieldCheck,
} from "lucide-react";

type PendingProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  profileType: string;
  isActive: boolean;
  phone: string | null;
  city: string | null;
  address: string | null;
  bio: string | null;
  createdAt: string;
};

type FaceShot = { id: string; url: string; pose: string };

type FaceVerification = {
  id: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";
  expiresAt: string;
  sentAt: string | null;
  sentTo: string | null;
  submittedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  shots: FaceShot[];
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    phone: string | null;
    city: string | null;
    isVerified: boolean;
    isActive: boolean;
    createdAt: string;
    profileMedia: { id: string; url: string }[];
  };
};

const PAGE_SIZE = 30;

const POSE_LABEL: Record<string, string> = {
  FRONT: "Frente",
  LEFT: "Izquierda",
  RIGHT: "Derecha",
};

export default function AdminVerificationPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Verificación facial: enlaces enviados y fotos recibidas.
  const [tab, setTab] = useState<"pending" | "face">("pending");
  const [faceItems, setFaceItems] = useState<FaceVerification[]>([]);
  const [loadingFace, setLoadingFace] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED">("SUBMITTED");
  const [sendingLink, setSendingLink] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, { url: string; sent: boolean; error?: string }>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const loadProfiles = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchQuery) params.set("q", searchQuery);

      const res = await apiFetch<{ profiles: PendingProfile[]; total: number }>(`/admin/verification/pending?${params}`);
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar los perfiles pendientes.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    if (!loading && isAdmin) loadProfiles();
  }, [loading, isAdmin, loadProfiles]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadFace = useCallback(async () => {
    setLoadingFace(true);
    try {
      const res = await apiFetch<{ verifications: FaceVerification[] }>(
        `/admin/face-verifications?status=${faceStatus}`,
      );
      setFaceItems(res?.verifications ?? []);
    } catch {
      setError("No se pudieron cargar las verificaciones faciales.");
    } finally {
      setLoadingFace(false);
    }
  }, [faceStatus]);

  useEffect(() => {
    if (!loading && isAdmin && tab === "face") loadFace();
  }, [loading, isAdmin, tab, loadFace]);

  /** Crea el enlace único del perfil y lo manda por WhatsApp. */
  async function sendLink(p: PendingProfile) {
    setSendingLink(p.id);
    setError(null);
    try {
      const res = await apiFetch<{ url: string; whatsapp: { sent: boolean; error?: string } }>(
        "/admin/face-verifications",
        { method: "POST", body: JSON.stringify({ userId: p.id, send: true }) },
      );
      setLinks((prev) => ({
        ...prev,
        [p.id]: { url: res.url, sent: res.whatsapp?.sent, error: res.whatsapp?.error },
      }));
      setSuccess(
        res.whatsapp?.sent
          ? `Enlace enviado por WhatsApp a ${p.displayName || p.username}.`
          : "Enlace creado. No se pudo enviar por WhatsApp: cópialo y mándalo a mano.",
      );
    } catch {
      setError("No se pudo crear el enlace de verificación.");
    } finally {
      setSendingLink(null);
    }
  }

  async function reviewFace(item: FaceVerification, action: "approve" | "reject") {
    setBusy(item.id);
    setError(null);
    try {
      await apiFetch(`/admin/face-verifications/${item.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReasons[item.id]?.trim() || null }),
      });
      setSuccess(
        action === "approve"
          ? `${item.user.displayName || item.user.username} verificada y publicada.`
          : `Verificación de ${item.user.displayName || item.user.username} rechazada.`,
      );
      loadFace();
      loadProfiles();
    } catch {
      setError("No se pudo procesar la verificación.");
    } finally {
      setBusy(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput);
  }

  async function approveProfile(p: PendingProfile) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/verification/${p.id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ verifiedByPhone: phoneInputs[p.id] || p.phone || "" }),
      });
      setSuccess(`${p.displayName || p.username} ha sido verificado y activado.`);
      await loadProfiles();
    } catch {
      setError("No se pudo aprobar el perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function rejectProfile(p: PendingProfile) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/verification/${p.id}/reject`, { method: "PUT" });
      setSuccess(`${p.displayName || p.username} ha sido rechazado.`);
      await loadProfiles();
    } catch {
      setError("No se pudo rechazar el perfil.");
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesion.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Solicitudes de Verificacion</h1>
            <p className="text-xs text-white/40">{total} perfil{total !== 1 ? "es" : ""} pendiente{total !== 1 ? "s" : ""} de verificacion</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Phone className="h-3.5 w-3.5" />
          Verificacion telefonica manual
        </div>
      </div>

      {/* Pestañas: la cola de perfiles y las fotos que llegaron por el enlace */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
            tab === "pending"
              ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Perfiles pendientes
        </button>
        <button
          onClick={() => setTab("face")}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
            tab === "face"
              ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          <ScanFace className="h-3.5 w-3.5" />
          Verificación facial
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {tab === "pending" && (
        <>
        {/* Search */}
        <div className="mt-4">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
              placeholder="Buscar por nombre, usuario, email o telefono..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>

        {/* Profiles list */}
        <div className="mt-4 space-y-3">
          {loadingProfiles ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400/50 mb-3" />
              <div className="text-sm text-white/50">No hay perfiles pendientes de verificacion.</div>
            </div>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-500/10 bg-white/[0.02] overflow-hidden transition">
                <div className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={48} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{p.displayName || p.username}</span>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> Pendiente
                        </span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{p.profileType}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40 flex-wrap">
                        <span>@{p.username}</span>
                        {p.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {p.phone}</span>}
                        {p.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {p.city}</span>}
                        <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {p.email}</span>
                        <span>{new Date(p.createdAt).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 transition"
                        title="Ver detalles"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={busy === p.id}
                        onClick={() => approveProfile(p)}
                        className="flex h-8 items-center gap-1 rounded-lg px-3 border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition disabled:opacity-50"
                        title="Aprobar"
                      >
                        {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Aprobar</span>
                      </button>
                      <button
                        disabled={busy === p.id}
                        onClick={() => rejectProfile(p)}
                        className="flex h-8 items-center gap-1 rounded-lg px-3 border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Rechazar"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Rechazar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === p.id && (
                  <div className="border-t border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
                    {p.bio && (
                      <div>
                        <div className="text-[11px] uppercase text-white/40 mb-1">Descripcion</div>
                        <p className="text-sm text-white/70 line-clamp-3">{p.bio}</p>
                      </div>
                    )}
                    {p.address && (
                      <div>
                        <div className="text-[11px] uppercase text-white/40 mb-1">Direccion</div>
                        <p className="text-sm text-white/70">{p.address}</p>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] uppercase text-white/40 mb-1">Telefono de verificacion</div>
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
                          placeholder={p.phone || "Ingresar telefono..."}
                          value={phoneInputs[p.id] || ""}
                          onChange={(e) => setPhoneInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <a
                          href={`tel:${phoneInputs[p.id] || p.phone || ""}`}
                          className="flex h-9 items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/15 px-3 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/25 transition"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Llamar
                        </a>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-white/40 mb-1">Verificacion facial</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => sendLink(p)}
                          disabled={sendingLink === p.id}
                          className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          {sendingLink === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Enviar link por WhatsApp
                        </button>
                        {links[p.id] && (
                          <button
                            onClick={() => navigator.clipboard?.writeText(links[p.id].url)}
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition hover:bg-white/10"
                            title={links[p.id].url}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar enlace
                          </button>
                        )}
                      </div>
                      {links[p.id] && !links[p.id].sent && (
                        <p className="mt-1.5 text-[11px] text-amber-300">
                          No se pudo enviar por WhatsApp
                          {links[p.id].error === "INVALID_PHONE"
                            ? " (el número del perfil no es válido)"
                            : ""}
                          . Copia el enlace y envíaselo tú.
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-white/30">
                        El enlace es personal, vence en 48 horas y solo sirve una vez.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Link href={`/profesional/${p.id}`} target="_blank" className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition">
                        <Eye className="h-3.5 w-3.5" />
                        Ver perfil completo
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-xs text-white/40">Pagina {page + 1} de {totalPages}</div>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30">
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {tab === "face" && (
        <div className="mt-4">
          {/* Filtro por estado de la verificación */}
          <div className="flex flex-wrap gap-2">
            {(["SUBMITTED", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFaceStatus(st)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  faceStatus === st
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {st === "SUBMITTED"
                  ? "Por revisar"
                  : st === "PENDING"
                    ? "Enlace enviado"
                    : st === "APPROVED"
                      ? "Aprobadas"
                      : "Rechazadas"}
              </button>
            ))}
          </div>

          {loadingFace ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
            </div>
          ) : faceItems.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
              No hay verificaciones en este estado.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {faceItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={item.user.avatarUrl}
                      alt={item.user.displayName || item.user.username}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {item.user.displayName || item.user.username}
                        </span>
                        {item.user.isVerified && (
                          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            <ShieldCheck className="h-2.5 w-2.5" /> Verificada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/40">
                        @{item.user.username}
                        {item.user.city ? ` · ${item.user.city}` : ""}
                        {item.submittedAt
                          ? ` · envió ${new Date(item.submittedAt).toLocaleDateString("es-CL")}`
                          : item.sentAt
                            ? ` · enlace enviado ${new Date(item.sentAt).toLocaleDateString("es-CL")}`
                            : ""}
                      </p>
                    </div>
                    <Link
                      href={`/profesional/${item.user.id}`}
                      target="_blank"
                      className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition hover:bg-white/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Perfil
                    </Link>
                  </div>

                  {item.status === "PENDING" && (
                    <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
                      Enlace enviado{item.sentTo ? ` al +${item.sentTo}` : ""}, todavía sin fotos.
                      Vence el {new Date(item.expiresAt).toLocaleDateString("es-CL")}.
                    </p>
                  )}

                  {item.shots.length > 0 && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {/* Lo que envió por el enlace */}
                      <div>
                        <div className="mb-1.5 text-[11px] uppercase text-white/40">
                          Verificación ({item.shots.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.shots.map((shot) => (
                            <a
                              key={shot.id}
                              href={resolveMediaUrl(shot.url) ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative"
                            >
                              <img
                                src={resolveMediaUrl(shot.url) ?? undefined}
                                alt={shot.pose}
                                className="h-28 w-28 rounded-xl border border-fuchsia-400/30 object-cover"
                              />
                              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/85">
                                {POSE_LABEL[shot.pose] || shot.pose}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Lo que subió al perfil, para comparar */}
                      <div>
                        <div className="mb-1.5 text-[11px] uppercase text-white/40">
                          Fotos del perfil
                        </div>
                        {item.user.profileMedia.length === 0 ? (
                          <p className="text-xs text-white/35">Este perfil no tiene fotos.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {item.user.profileMedia.map((m) => (
                              <a
                                key={m.id}
                                href={resolveMediaUrl(m.url) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={resolveMediaUrl(m.url) ?? undefined}
                                  alt=""
                                  className="h-28 w-28 rounded-xl border border-white/10 object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {item.status === "SUBMITTED" && (
                    <div className="mt-4 space-y-2">
                      <input
                        value={rejectReasons[item.id] ?? ""}
                        onChange={(e) =>
                          setRejectReasons((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Motivo si rechazas (se lo enviamos a ella)"
                        className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none transition placeholder:text-white/25 focus:border-fuchsia-500/30"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewFace(item, "reject")}
                          disabled={busy === item.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rechazar
                        </button>
                        <button
                          onClick={() => reviewFace(item, "approve")}
                          disabled={busy === item.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          {busy === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Aprobar y publicar
                        </button>
                      </div>
                    </div>
                  )}

                  {item.status === "REJECTED" && item.rejectReason && (
                    <p className="mt-3 text-[11px] text-white/40">Motivo: “{item.rejectReason}”</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
