"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, API_URL, isAuthError, resolveMediaUrl } from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Image as ImageIcon,
  MapPin,
  Paperclip,
  Phone,
  Send,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hotel,
  DollarSign,
} from "lucide-react";

function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

type Message = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
};

type ChatUser = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  profileType: string;
  city: string | null;
  phone?: string | null;
};

type ServiceRequest = {
  id: string;
  status: string;
  requestedDate?: string | null;
  requestedTime?: string | null;
  agreedLocation?: string | null;
  clientComment?: string | null;
  professionalPriceClp?: number | null;
  professionalDurationM?: number | null;
  professionalComment?: string | null;
  contactUnlocked?: boolean;
  client?: { id: string; displayName?: string | null; username: string; phone?: string | null };
  professional?: { id: string; displayName?: string | null; username: string; phone?: string | null };
};

type MotelBooking = {
  id: string;
  status: string;
  durationType: string;
  startAt?: string | null;
  note?: string | null;
  priceClp?: number | null;
  basePriceClp?: number | null;
  discountClp?: number | null;
  confirmationCode?: string | null;
  roomName?: string | null;
  establishmentAddress?: string | null;
  establishmentCity?: string | null;
};

type MeResponse = {
  user: { id: string; displayName: string | null; username: string; profileType: string | null } | null;
};

function statusLabel(status: string) {
  if (status === "PENDIENTE_APROBACION") return "Pendiente";
  if (status === "APROBADO") return "Propuesta enviada";
  if (status === "ACTIVO") return "Confirmada";
  if (status === "FINALIZADO") return "Finalizado";
  if (status === "RECHAZADO") return "Rechazada";
  if (status === "CANCELADO_CLIENTE") return "Cancelada";
  return status.toLowerCase();
}

function statusColor(status: string) {
  if (status === "ACTIVO") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (status === "APROBADO") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (status === "PENDIENTE_APROBACION") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (status === "FINALIZADO") return "text-white/50 bg-white/5 border-white/10";
  if (status === "RECHAZADO" || status === "CANCELADO_CLIENTE") return "text-red-400 bg-red-500/10 border-red-500/20";
  return "text-white/50 bg-white/5 border-white/10";
}

function profileLabel(type: string) {
  if (type === "PROFESSIONAL") return "Experiencia";
  if (type === "SHOP") return "Tienda";
  if (type === "ESTABLISHMENT") return "Lugar";
  return "Perfil";
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "/chats";
  const userId = String(params.userId || "");

  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ChatUser | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRequest, setActiveRequest] = useState<ServiceRequest | null>(null);
  const [activeBooking, setActiveBooking] = useState<MotelBooking | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [requestLocation, setRequestLocation] = useState("");
  const [requestComment, setRequestComment] = useState("");
  const today = new Date();
  const minRequestDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [proposalPrice, setProposalPrice] = useState("");
  const [proposalDuration, setProposalDuration] = useState("60");
  const [proposalComment, setProposalComment] = useState("");
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [lastRealtimeAt, setLastRealtimeAt] = useState(0);
  const fallbackStepsMs = [2000, 5000, 10000, 20000] as const;
  const fallbackStepRef = useRef(0);
  const fallbackInFlightRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  function scrollToBottom(smooth = true) {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }

  useEffect(() => {
    scrollToBottom(false);
  }, [loading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  async function loadServiceState(profile: MeResponse["user"] | null) {
    if (!profile) {
      setActiveRequest(null);
      return;
    }

    if (profile.profileType === "CLIENT") {
      const res = await apiFetch<{ services: ServiceRequest[] }>("/services/active");
      const match = res.services.find((service) => service.professional?.id === userId);
      setActiveRequest(match || null);
      return;
    }

    if (profile.profileType === "PROFESSIONAL") {
      const res = await apiFetch<{ request: ServiceRequest | null }>(`/services/requests/with/${userId}`);
      setActiveRequest(res.request || null);
      return;
    }

    setActiveRequest(null);
  }

  async function loadBookingState(profile: MeResponse["user"] | null) {
    if (!profile || !["CLIENT", "ESTABLISHMENT"].includes(String(profile.profileType || "").toUpperCase())) {
      setActiveBooking(null);
      return;
    }
    try {
      const res = await apiFetch<{ booking: MotelBooking | null }>(`/motel/bookings/with/${userId}`);
      setActiveBooking(res.booking || null);
    } catch {
      setActiveBooking(null);
    }
  }

  async function load() {
    const [meResp, msgResp] = await Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<{ messages: Message[]; other: ChatUser }>(`/messages/${userId}`)
    ]);
    setMe(meResp.user);
    setMessages(msgResp.messages);
    setOther(msgResp.other);
    await Promise.all([loadServiceState(meResp.user), loadBookingState(meResp.user)]);
  }

  useEffect(() => {
    load()
      .catch((e: any) => {
        if (isAuthError(e)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (e?.status === 403) {
          setError("No puedes iniciar chat con este perfil. Suscríbete o espera a que habilite mensajes.");
        } else {
          setError(e?.message || "Error");
        }
      })
      .finally(() => setLoading(false));
  }, [pathname, router, userId]);

  useEffect(() => {
    const draft = searchParams.get("draft");
    if (draft && !body) setBody(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function refreshConversationSilently() {
    try {
      const msgResp = await apiFetch<{ messages: Message[]; other: ChatUser }>(`/messages/${userId}`);
      setMessages(msgResp.messages);
      setOther(msgResp.other);
      await Promise.all([loadServiceState(me), loadBookingState(me)]);
    } catch {
      // silent polling
    }
  }

  async function applyBookingAction(action: "ACCEPT" | "REJECT" | "CONFIRM" | "CANCEL" | "FINISH") {
    if (!activeBooking) return;
    setBookingBusy(true);
    try {
      const payload: Record<string, any> = { action };
      if (action === "REJECT") {
        payload.rejectReason = "OTRO";
        payload.rejectNote = "No disponible";
      }
      const res = await apiFetch<{ booking: MotelBooking }>(`/motel/bookings/${activeBooking.id}/action`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setActiveBooking(res.booking || null);
      await refreshConversationSilently();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la reserva");
    } finally {
      setBookingBusy(false);
    }
  }

  useEffect(() => {
    const disconnect = connectRealtime((event) => {
      if (["connected", "hello", "ping", "message", "service_request"].includes(event.type)) {
        fallbackStepRef.current = 0;
        setLastRealtimeAt(Date.now());
      }
      if (["message", "service_request", "booking:new", "booking:update"].includes(event.type)) {
        refreshConversationSilently();
      }
    });

    return () => disconnect();
  }, [userId, me?.profileType]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      timer = setTimeout(tick, delayMs);
    };

    const tick = () => {
      if (cancelled) return;

      const realtimeRecentlyActive = Date.now() - lastRealtimeAt < 6000;
      if (realtimeRecentlyActive) {
        fallbackStepRef.current = 0;
        schedule(fallbackStepsMs[0]);
        return;
      }

      if (fallbackInFlightRef.current) {
        const currentDelay = fallbackStepsMs[Math.min(fallbackStepRef.current, fallbackStepsMs.length - 1)];
        schedule(currentDelay);
        return;
      }

      fallbackInFlightRef.current = true;
      refreshConversationSilently()
        .finally(() => {
          fallbackInFlightRef.current = false;
          fallbackStepRef.current = Math.min(fallbackStepRef.current + 1, fallbackStepsMs.length - 1);
          const nextDelay = fallbackStepsMs[fallbackStepRef.current];
          schedule(nextDelay);
        });
    };

    schedule(fallbackStepsMs[Math.min(fallbackStepRef.current, fallbackStepsMs.length - 1)]);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, me?.profileType, lastRealtimeAt]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !attachment) return;
    try {
      if (attachment) {
        const form = new FormData();
        form.append("file", attachment);
        const res = await fetch(`${API_URL}/messages/${userId}/attachment`, {
          method: "POST",
          credentials: "include",
          body: form
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`ATTACHMENT_FAILED ${res.status}: ${t}`);
        }
        const payload = (await res.json()) as { message: Message };
        setMessages((prev) => [...prev, payload.message]);
        setAttachment(null);
        setAttachmentPreview(null);
      }
      if (body.trim()) {
        const msg = await apiFetch<{ message: Message }>(`/messages/${userId}`, {
          method: "POST",
          body: JSON.stringify({ body })
        });
        setMessages((prev) => [...prev, msg.message]);
        setBody("");
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar el mensaje");
    }
  }

  async function submitServiceRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestDate || !requestTime || !requestLocation.trim()) {
      setError("Debes completar fecha, hora y ubicación acordada.");
      return;
    }
    if (requestDate < minRequestDate) {
      setError("La fecha de la solicitud debe ser desde hoy en adelante.");
      return;
    }
    setRequesting(true);
    try {
      const res = await apiFetch<{ request: ServiceRequest }>("/services/request", {
        method: "POST",
        body: JSON.stringify({
          professionalId: userId,
          date: requestDate,
          time: requestTime,
          location: requestLocation,
          comment: requestComment
        })
      });
      setActiveRequest(res.request || null);
      setRequestModalOpen(false);
      setRequestDate("");
      setRequestTime("");
      setRequestLocation("");
      setRequestComment("");
    } catch (e: any) {
      setError(e?.message || "No se pudo solicitar el servicio");
    } finally {
      setRequesting(false);
    }
  }

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRequest) return;
    setProposalSubmitting(true);
    try {
      const res = await apiFetch<{ service: ServiceRequest }>(`/services/${activeRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          priceClp: Number(proposalPrice),
          durationMinutes: Number(proposalDuration),
          professionalComment: proposalComment
        })
      });
      setActiveRequest(res.service || null);
      setProposalPrice("");
      setProposalDuration("60");
      setProposalComment("");
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar la propuesta");
    } finally {
      setProposalSubmitting(false);
    }
  }

  async function rejectRequest() {
    if (!activeRequest) return;
    try {
      const res = await apiFetch<{ service: ServiceRequest }>(`/services/${activeRequest.id}/reject`, { method: "POST" });
      setActiveRequest(res.service || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo rechazar la solicitud");
    }
  }

  async function confirmProposal() {
    if (!activeRequest) return;
    try {
      const res = await apiFetch<{ service: ServiceRequest }>(`/services/${activeRequest.id}/client-confirm`, { method: "POST" });
      setActiveRequest(res.service || null);
      await loadServiceState(me);
    } catch (e: any) {
      setError(e?.message || "No se pudo confirmar la solicitud");
    }
  }

  async function cancelProposal() {
    if (!activeRequest) return;
    try {
      const res = await apiFetch<{ service: ServiceRequest }>(`/services/${activeRequest.id}/client-cancel`, { method: "POST" });
      setActiveRequest(res.service || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo cancelar la solicitud");
    }
  }

  async function finishService() {
    if (!activeRequest) return;
    try {
      const res = await apiFetch<{ service: ServiceRequest }>(`/services/${activeRequest.id}/finish`, { method: "POST" });
      setActiveRequest(res.service || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo finalizar el servicio");
    }
  }

  const contactPhone = useMemo(() => {
    if (!activeRequest) return null;
    if (!(activeRequest.status === "ACTIVO" || activeRequest.status === "FINALIZADO")) return null;
    if (me?.profileType === "CLIENT") return activeRequest.professional?.phone || null;
    if (me?.profileType === "PROFESSIONAL") return activeRequest.client?.phone || null;
    return null;
  }, [activeRequest, me?.profileType]);

  const professionalWhatsAppLink = useMemo(() => {
    if (me?.profileType !== "CLIENT") return null;
    const professionalPhone = activeRequest?.professional?.phone;
    if (!professionalPhone) return null;
    const normalizedPhone = normalizePhoneForWhatsApp(professionalPhone);
    if (!normalizedPhone) return null;
    return `https://wa.me/${normalizedPhone}`;
  }, [activeRequest?.professional?.phone, me?.profileType]);

  const canCreateRequest = me?.profileType === "CLIENT" && other?.profileType === "PROFESSIONAL" && !activeRequest;
  const waitingProfessional = me?.profileType === "CLIENT" && activeRequest?.status === "PENDIENTE_APROBACION";
  const canConfirmProposal = me?.profileType === "CLIENT" && activeRequest?.status === "APROBADO";
  const canReviewPendingRequest = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "PENDIENTE_APROBACION";
  const waitingClientConfirm = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "APROBADO";
  const canFinishService = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "ACTIVO";
  const isMotelOwnerChat = String(me?.profileType || "").toUpperCase() === "ESTABLISHMENT";
  const isClientChat = String(me?.profileType || "").toUpperCase() === "CLIENT";
  const hasMotelBooking = Boolean(activeBooking);
  const bookingMapsLink = activeBooking ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([activeBooking.establishmentAddress || "", activeBooking.establishmentCity || ""].join(" ").trim() || "motel")}` : "";

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    for (const m of messages) {
      const d = new Date(m.createdAt).toDateString();
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: m.createdAt, messages: [m] });
      } else {
        groups[groups.length - 1].messages.push(m);
      }
    }
    return groups;
  }, [messages]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="mx-auto flex h-[70vh] w-full max-w-3xl flex-col">
        <div className="flex items-center gap-3 p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
              <div className={`h-12 animate-pulse rounded-2xl bg-white/[0.06] ${i % 2 === 0 ? "w-2/5" : "w-3/5"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3 p-4">
          <Link href="/chat" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-white/70">Volver</span>
        </div>
        <div className="mx-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-xl md:h-[80vh]">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <Link
          href="/chat"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <Avatar src={other?.avatarUrl} alt={other?.username} size={40} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {other?.displayName || other?.username || "Chat"}
            </span>
            {other && (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                {profileLabel(other.profileType)}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-white/40">
            @{other?.username}{other?.city ? ` · ${other.city}` : ""}
          </p>
        </div>

        {/* Request button or status */}
        <div className="flex shrink-0 items-center gap-2">
          {canCreateRequest && (
            <button
              onClick={() => setRequestModalOpen(true)}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2 text-xs font-semibold transition hover:brightness-110"
              disabled={requesting}
            >
              Solicitar
            </button>
          )}
          {activeRequest && (
            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusColor(activeRequest.status)}`}>
              {statusLabel(activeRequest.status)}
            </span>
          )}
        </div>
      </div>

      {/* ── Service request / booking cards ── */}
      {(hasMotelBooking || activeRequest) && (
        <div className="shrink-0 space-y-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          {/* Motel booking card */}
          {hasMotelBooking && (
            <div className="rounded-xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/[0.08] to-violet-500/[0.05] p-3">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-fuchsia-400" />
                <span className="text-xs font-semibold text-fuchsia-300">Reserva motel/hotel</span>
              </div>
              <div className="mt-2 grid gap-1 text-[11px] text-white/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Habitación:</span> {activeBooking?.roomName || "Habitación"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Tramo:</span> {activeBooking?.durationType || "3H"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Inicio:</span> {activeBooking?.startAt ? new Date(activeBooking.startAt).toLocaleString("es-CL") : "por confirmar"}
                </div>
                {activeBooking?.basePriceClp && activeBooking.basePriceClp > Number(activeBooking.priceClp || 0) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/40">Base:</span> <span className="line-through">${Number(activeBooking.basePriceClp).toLocaleString("es-CL")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-white/40" />
                  <span className="font-medium text-white/80">${Number(activeBooking?.priceClp || 0).toLocaleString("es-CL")}</span>
                  {Number(activeBooking?.discountClp || 0) > 0 && (
                    <span className="text-emerald-400">(-${Number(activeBooking?.discountClp || 0).toLocaleString("es-CL")})</span>
                  )}
                </div>
                {activeBooking?.confirmationCode && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/40">Código:</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/90">{activeBooking.confirmationCode}</span>
                  </div>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {isMotelOwnerChat && activeBooking?.status === "PENDIENTE" && (
                  <>
                    <button className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110" disabled={bookingBusy} onClick={() => applyBookingAction("ACCEPT")}>{bookingBusy ? "..." : "Aceptar"}</button>
                    <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10" disabled={bookingBusy} onClick={() => applyBookingAction("REJECT")}>{bookingBusy ? "..." : "Rechazar"}</button>
                  </>
                )}
                {isClientChat && activeBooking?.status === "ACEPTADA" && (
                  <button className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110" disabled={bookingBusy} onClick={() => applyBookingAction("CONFIRM")}>{bookingBusy ? "..." : "Confirmar"}</button>
                )}
                {isClientChat && ["PENDIENTE", "ACEPTADA", "CONFIRMADA"].includes(String(activeBooking?.status || "")) && (
                  <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10" disabled={bookingBusy} onClick={() => applyBookingAction("CANCEL")}>{bookingBusy ? "..." : "Cancelar"}</button>
                )}
                {isMotelOwnerChat && activeBooking?.status === "CONFIRMADA" && (
                  <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10" disabled={bookingBusy} onClick={() => applyBookingAction("FINISH")}>{bookingBusy ? "..." : "Finalizar"}</button>
                )}
                {activeBooking?.status === "CONFIRMADA" && (
                  <a href={bookingMapsLink} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10">
                    <MapPin className="mr-1 inline h-3 w-3" />Maps
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Service request card */}
          {activeRequest && (
            <div className={`rounded-xl border p-3 ${statusColor(activeRequest.status)}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Solicitud de servicio</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(activeRequest.status)}`}>
                  {statusLabel(activeRequest.status)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-white/60">
                  <Calendar className="h-3 w-3 text-white/40" />
                  {activeRequest.requestedDate || "-"}
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <Clock className="h-3 w-3 text-white/40" />
                  {activeRequest.requestedTime || "-"}
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-white/60">
                  <MapPin className="h-3 w-3 shrink-0 text-white/40" />
                  <span className="truncate">{activeRequest.agreedLocation || "-"}</span>
                </div>
                {activeRequest.clientComment && (
                  <div className="col-span-2 text-white/50">"{activeRequest.clientComment}"</div>
                )}
                {activeRequest.professionalPriceClp != null && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <DollarSign className="h-3 w-3 text-white/40" />
                    ${Number(activeRequest.professionalPriceClp).toLocaleString("es-CL")}
                  </div>
                )}
                {activeRequest.professionalDurationM != null && (
                  <div className="text-white/60">{activeRequest.professionalDurationM} min</div>
                )}
                {activeRequest.professionalComment && (
                  <div className="col-span-2 text-white/50">Nota: "{activeRequest.professionalComment}"</div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {canConfirmProposal && (
                  <>
                    <button onClick={confirmProposal} className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110">
                      <CheckCircle2 className="h-3 w-3" /> Confirmar
                    </button>
                    <button onClick={cancelProposal} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10">Cancelar</button>
                  </>
                )}
                {canFinishService && (
                  <button onClick={finishService} className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110">
                    <CheckCircle2 className="h-3 w-3" /> Servicio terminado
                  </button>
                )}
              </div>

              {waitingProfessional && (
                <p className="mt-2 text-[11px] text-white/40">Pendiente de revisión por la profesional.</p>
              )}
              {waitingClientConfirm && (
                <p className="mt-2 text-[11px] text-white/40">Propuesta enviada. Esperando confirmación del cliente.</p>
              )}

              {/* Contact phone */}
              {contactPhone && (
                <div className="mt-2 flex items-center gap-2">
                  <Phone className="h-3 w-3 text-emerald-400" />
                  <span className="text-[11px] text-emerald-300">{contactPhone}</span>
                  {professionalWhatsAppLink && (
                    <a
                      href={professionalWhatsAppLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 transition hover:bg-emerald-500/30"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
                        <path d="M19.05 4.91A9.82 9.82 0 0 0 12.06 2a9.93 9.93 0 0 0-8.61 14.89L2 22l5.26-1.38A10 10 0 0 0 12.04 22h.01A9.94 9.94 0 0 0 22 12.08a9.8 9.8 0 0 0-2.95-7.17Zm-7 .99a8.12 8.12 0 0 1 8.11 8.1 8.13 8.13 0 0 1-8.11 8.11 8.28 8.28 0 0 1-4.13-1.13l-.3-.18-3.12.82.83-3.04-.2-.31a8.12 8.12 0 0 1 6.92-12.37Zm4.45 9.95c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.79-.2-.47-.4-.41-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.15 1.52.09.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.03.14-1.14-.06-.11-.22-.17-.46-.29Z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
              {!contactPhone && activeRequest.status === "APROBADO" && (
                <p className="mt-2 text-[11px] text-amber-400/70">El teléfono se libera al confirmar la propuesta.</p>
              )}
            </div>
          )}

          {/* Professional review form */}
          {canReviewPendingRequest && (
            <form onSubmit={submitProposal} className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
              <div className="mb-2 text-xs font-semibold text-violet-300">Responder solicitud</div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1 text-[11px] text-white/50">
                  Valor (CLP)
                  <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20" inputMode="numeric" value={proposalPrice} onChange={(e) => setProposalPrice(e.target.value)} placeholder="Ej: 50000" />
                </label>
                <label className="grid gap-1 text-[11px] text-white/50">
                  Duración
                  <select className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20" value={proposalDuration} onChange={(e) => setProposalDuration(e.target.value)} style={{ colorScheme: "dark" }}>
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                    <option value="120">120 min</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 grid gap-1 text-[11px] text-white/50">
                Nota (opcional)
                <textarea className="min-h-[3rem] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20" value={proposalComment} onChange={(e) => setProposalComment(e.target.value)} placeholder="Info adicional" />
              </label>
              <div className="mt-2 flex gap-1.5">
                <button className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110" disabled={proposalSubmitting}>
                  <CheckCircle2 className="h-3 w-3" /> {proposalSubmitting ? "Enviando..." : "Aceptar y enviar"}
                </button>
                <button type="button" onClick={rejectRequest} className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10">
                  <XCircle className="h-3 w-3" /> Rechazar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
        {!messages.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
              <Send className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-xs text-white/40">Inicia la conversación</p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="my-4 flex items-center justify-center">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] text-white/35">
                    {formatDate(group.date)}
                  </span>
                </div>

                {group.messages.map((m, idx) => {
                  const isMine = m.fromId === me?.id;
                  const isImage = m.body.startsWith("ATTACHMENT_IMAGE:");
                  const imageUrl = isImage ? resolveMediaUrl(m.body.replace("ATTACHMENT_IMAGE:", "")) : null;
                  const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                  const sameAuthor = prevMsg?.fromId === m.fromId;

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"} ${sameAuthor ? "mt-0.5" : "mt-2"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          isMine
                            ? "rounded-br-md bg-gradient-to-br from-fuchsia-600/80 to-violet-600/80 text-white"
                            : "rounded-bl-md border border-white/[0.08] bg-white/[0.06] text-white/85"
                        }`}
                      >
                        {isImage && imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Adjunto"
                            className="max-w-[240px] rounded-xl"
                            loading="lazy"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        )}
                        <div className={`mt-0.5 text-right text-[10px] ${isMine ? "text-white/50" : "text-white/30"}`}>
                          {formatTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Attachment preview ── */}
      {attachmentPreview && (
        <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] px-4 py-2">
          <div className="flex items-center gap-3">
            <img src={attachmentPreview} alt="Adjunto" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/60">{attachment?.name}</p>
              <p className="text-[10px] text-white/35">{attachment?.size ? `${(attachment.size / 1024).toFixed(0)} KB` : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => { setAttachment(null); setAttachmentPreview(null); }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <form onSubmit={send} className="flex shrink-0 items-end gap-2 border-t border-white/[0.08] bg-white/[0.03] px-3 py-3">
        <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70">
          <Paperclip className="h-4.5 w-4.5" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setAttachment(file);
              if (!file) {
                setAttachmentPreview(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setAttachmentPreview(String(reader.result || ""));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <input
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-fuchsia-500/20"
          placeholder="Escribe un mensaje..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="submit"
          disabled={!body.trim() && !attachment}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white transition hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* ── Request modal ── */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#1a0e2e] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Solicitar servicio</h2>
                <p className="mt-1 text-xs text-white/50">Completa los datos para coordinar.</p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitServiceRequest} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-[11px] text-white/50">
                  <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Fecha</div>
                  <input type="date" className="input" value={requestDate} min={minRequestDate} onChange={(e) => setRequestDate(e.target.value)} required />
                </label>
                <label className="grid gap-1 text-[11px] text-white/50">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Hora</div>
                  <input type="time" className="input" value={requestTime} onChange={(e) => setRequestTime(e.target.value)} required />
                </label>
              </div>

              <label className="grid gap-1 text-[11px] text-white/50">
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Ubicación acordada</div>
                <input className="input" value={requestLocation} onChange={(e) => setRequestLocation(e.target.value)} placeholder="Ej: Metro Los Leones, Providencia" required />
              </label>

              <label className="grid gap-1 text-[11px] text-white/50">
                Comentario adicional (opcional)
                <textarea className="input min-h-[3.5rem]" value={requestComment} onChange={(e) => setRequestComment(e.target.value)} placeholder="Detalles para coordinar" />
              </label>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[11px] text-white/50">
                <div className="mb-2 font-medium text-white/60">Accesos rápidos</div>
                <div className="flex flex-wrap gap-1.5">
                  <Link href="/establecimientos" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] transition hover:bg-white/10">Moteles / lugares</Link>
                  <Link href="/sexshops" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] transition hover:bg-white/10">Servicios</Link>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRequestModalOpen(false)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white/80 transition hover:bg-white/10">
                  Cancelar
                </button>
                <button className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-xs font-semibold transition hover:brightness-110" disabled={requesting}>
                  {requesting ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
