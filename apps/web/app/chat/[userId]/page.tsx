"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, API_URL, isAuthError, resolveMediaUrl } from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import Avatar from "../../../components/Avatar";
import { Paperclip, X } from "lucide-react";

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
  if (status === "PENDIENTE_APROBACION") return "pendiente de revisión";
  if (status === "APROBADO") return "propuesta enviada";
  if (status === "ACTIVO") return "confirmada";
  if (status === "FINALIZADO") return "servicio terminado";
  if (status === "RECHAZADO") return "rechazada";
  if (status === "CANCELADO_CLIENTE") return "cancelada por cliente";
  return status.toLowerCase();
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

  if (loading) return <div className="text-white/70">Cargando chat...</div>;
  if (error) return <div className="text-red-200">{error}</div>;

  const canCreateRequest = me?.profileType === "CLIENT" && !activeRequest;
  const waitingProfessional = me?.profileType === "CLIENT" && activeRequest?.status === "PENDIENTE_APROBACION";
  const canConfirmProposal = me?.profileType === "CLIENT" && activeRequest?.status === "APROBADO";

  const canReviewPendingRequest = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "PENDIENTE_APROBACION";
  const waitingClientConfirm = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "APROBADO";
  const canFinishService = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "ACTIVO";
  const isMotelOwnerChat = String(me?.profileType || "").toUpperCase() === "ESTABLISHMENT";
  const isClientChat = String(me?.profileType || "").toUpperCase() === "CLIENT";
  const hasMotelBooking = Boolean(activeBooking);
  const bookingMapsLink = activeBooking ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([activeBooking.establishmentAddress || "", activeBooking.establishmentCity || ""].join(" ").trim() || "motel")}` : "";

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={other?.avatarUrl} alt={other?.username} size={48} />
            <div>
              <h1 className="text-lg font-semibold">{other?.displayName || other?.username || "Chat"}</h1>
              {other ? (
                <p className="text-xs text-white/60">
                  @{other.username} • {other.profileType === "SHOP" ? "Tienda" : other.profileType === "ESTABLISHMENT" ? "Lugar" : other.profileType === "PROFESSIONAL" ? "Experiencia" : "Perfil"}
                  {other.city ? ` • ${other.city}` : ""}
                </p>
              ) : (
                <p className="text-xs text-white/60">Conversación segura para coordinar.</p>
              )}
            </div>
          </div>

          {canCreateRequest ? (
            <button onClick={() => setRequestModalOpen(true)} className="btn-primary" disabled={requesting}>
              {requesting ? "Solicitando..." : "Solicitar servicio"}
            </button>
          ) : activeRequest ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70">
              Solicitud {statusLabel(activeRequest.status)}
            </span>
          ) : null}
        </div>

        {hasMotelBooking ? (
          <div className="mt-4 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4 text-sm text-white/85">
            <div className="font-medium">Reserva motel/hotel</div>
            <div className="mt-2 grid gap-1 text-xs text-white/70">
              <div><span className="text-white/50">Habitación:</span> {activeBooking?.roomName || "Habitación"}</div>
              <div><span className="text-white/50">Tramo:</span> {activeBooking?.durationType || "3H"}</div>
              <div><span className="text-white/50">Inicio:</span> {activeBooking?.startAt ? new Date(activeBooking.startAt).toLocaleString("es-CL") : "por confirmar"}</div>
              {activeBooking?.basePriceClp && activeBooking.basePriceClp > Number(activeBooking.priceClp || 0) ? <div><span className="text-white/50">Precio base:</span> <span className="line-through">${Number(activeBooking.basePriceClp).toLocaleString("es-CL")}</span></div> : null}
              <div><span className="text-white/50">Monto final:</span> ${Number(activeBooking?.priceClp || 0).toLocaleString("es-CL")}</div>
              {Number(activeBooking?.discountClp || 0) > 0 ? <div><span className="text-white/50">Descuento:</span> -${Number(activeBooking?.discountClp || 0).toLocaleString("es-CL")}</div> : null}
              {activeBooking?.confirmationCode ? <div><span className="text-white/50">Código:</span> <b>{activeBooking.confirmationCode}</b></div> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {isMotelOwnerChat && activeBooking?.status === "PENDIENTE" ? <button className="btn-primary" disabled={bookingBusy} onClick={() => applyBookingAction("ACCEPT")}>{bookingBusy ? "Procesando..." : "Aceptar"}</button> : null}
              {isMotelOwnerChat && activeBooking?.status === "PENDIENTE" ? <button className="btn-secondary" disabled={bookingBusy} onClick={() => applyBookingAction("REJECT")}>{bookingBusy ? "Procesando..." : "Rechazar"}</button> : null}
              {isClientChat && activeBooking?.status === "ACEPTADA" ? <button className="btn-primary" disabled={bookingBusy} onClick={() => applyBookingAction("CONFIRM")}>{bookingBusy ? "Procesando..." : "Confirmar reserva"}</button> : null}
              {isClientChat && ["PENDIENTE", "ACEPTADA", "CONFIRMADA"].includes(String(activeBooking?.status || "")) ? <button className="btn-secondary" disabled={bookingBusy} onClick={() => applyBookingAction("CANCEL")}>{bookingBusy ? "Procesando..." : "Cancelar"}</button> : null}
              {isMotelOwnerChat && activeBooking?.status === "CONFIRMADA" ? <button className="btn-secondary" disabled={bookingBusy} onClick={() => applyBookingAction("FINISH")}>{bookingBusy ? "Procesando..." : "Finalizar"}</button> : null}
              {activeBooking?.status === "CONFIRMADA" ? <a href={bookingMapsLink} target="_blank" rel="noreferrer" className="btn-secondary">Ver en Google Maps</a> : null}
            </div>
          </div>
        ) : null}

        {activeRequest ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="grid gap-1 text-xs text-white/70">
              <div><span className="text-white/50">Fecha:</span> {activeRequest.requestedDate || "-"}</div>
              <div><span className="text-white/50">Hora:</span> {activeRequest.requestedTime || "-"}</div>
              <div><span className="text-white/50">Ubicación acordada:</span> {activeRequest.agreedLocation || "-"}</div>
              {activeRequest.clientComment ? <div><span className="text-white/50">Comentario cliente:</span> {activeRequest.clientComment}</div> : null}
              {activeRequest.professionalPriceClp != null ? <div><span className="text-white/50">Valor:</span> ${Number(activeRequest.professionalPriceClp).toLocaleString("es-CL")} CLP</div> : null}
              {activeRequest.professionalDurationM != null ? <div><span className="text-white/50">Duración:</span> {activeRequest.professionalDurationM} min</div> : null}
              {activeRequest.professionalComment ? <div><span className="text-white/50">Nota profesional:</span> {activeRequest.professionalComment}</div> : null}
            </div>

            {canConfirmProposal ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={confirmProposal} className="btn-primary">Confirmar solicitud</button>
                <button onClick={cancelProposal} className="btn-secondary">Cancelar</button>
              </div>
            ) : null}

            {canFinishService ? (
              <div className="mt-4">
                <button onClick={finishService} className="btn-primary">Servicio terminado</button>
              </div>
            ) : null}

            {waitingProfessional ? <p className="mt-3 text-xs text-white/60">Tu solicitud está pendiente de revisión por la profesional.</p> : null}
            {waitingClientConfirm ? <p className="mt-3 text-xs text-white/60">Propuesta enviada. Esperando confirmación del cliente.</p> : null}

            {contactPhone ? (
              <p className="mt-3 text-xs text-green-300">Contacto liberado: {contactPhone}</p>
            ) : (activeRequest.status === "APROBADO" ? (
              <p className="mt-3 text-xs text-amber-300">El teléfono se libera solo cuando el cliente confirma la propuesta.</p>
            ) : null)}
          </div>
        ) : null}

        {canReviewPendingRequest ? (
          <form onSubmit={submitProposal} className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 grid gap-3">
            <div className="text-sm font-medium">Responder solicitud</div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-white/70">
                Valor (CLP)
                <input className="input" inputMode="numeric" value={proposalPrice} onChange={(e) => setProposalPrice(e.target.value)} placeholder="Ej: 50000" />
              </label>
              <label className="grid gap-1 text-xs text-white/70">
                Duración
                <select className="input" value={proposalDuration} onChange={(e) => setProposalDuration(e.target.value)}>
                  <option value="30">30 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                  <option value="120">120 minutos</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-xs text-white/70">
              Nota adicional (opcional)
              <textarea className="input min-h-20" value={proposalComment} onChange={(e) => setProposalComment(e.target.value)} placeholder="Información adicional para el cliente" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={proposalSubmitting}>{proposalSubmitting ? "Enviando..." : "Aceptar y enviar propuesta"}</button>
              <button type="button" onClick={rejectRequest} className="btn-secondary">Rechazar</button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="card p-6">
        <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-2">
          {messages.map((m) => {
            const isImage = m.body.startsWith("ATTACHMENT_IMAGE:");
            const imageUrl = isImage ? resolveMediaUrl(m.body.replace("ATTACHMENT_IMAGE:", "")) : null;
            return (
              <div
                key={m.id}
                className={`rounded-xl px-4 py-3 text-sm ${m.fromId === me?.id ? "bg-purple-500/20 text-white ml-auto" : "bg-white/5 text-white/80"}`}
              >
                {isImage && imageUrl ? (
                  <img src={imageUrl} alt="Adjunto" className="max-w-[220px] rounded-lg border border-white/10" />
                ) : (
                  <div>{m.body}</div>
                )}
                <div className="mt-1 text-[10px] text-white/40">{new Date(m.createdAt).toLocaleString("es-CL")}</div>
              </div>
            );
          })}
          {!messages.length ? <div className="text-white/50">Aún no hay mensajes.</div> : null}
        </div>

        {attachmentPreview ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <img src={attachmentPreview} alt="Adjunto" className="h-16 w-16 rounded-xl object-cover" />
            <div className="flex-1 text-xs text-white/70">{attachment?.name}</div>
            <button type="button" onClick={() => { setAttachment(null); setAttachmentPreview(null); }} className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <form onSubmit={send} className="mt-4 flex flex-wrap gap-3 items-center">
          <input className="input flex-1" placeholder="Escribe tu mensaje..." value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
            <Paperclip className="h-4 w-4" />
            Adjuntar
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
          <button className="btn-primary">Enviar</button>
        </form>
      </div>

      {requestModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#2a1245] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Solicitar servicio</h2>
                <p className="mt-1 text-xs text-white/60">Completa fecha, hora y ubicación acordada para enviar la solicitud.</p>
              </div>
              <button type="button" onClick={() => setRequestModalOpen(false)} className="rounded-full border border-white/20 p-2 text-white/70 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitServiceRequest} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs text-white/70">
                  Fecha
                  <input type="date" className="input" value={requestDate} min={minRequestDate} aria-label="Fecha de solicitud" onChange={(e) => setRequestDate(e.target.value)} required />
                </label>
                <label className="grid gap-1 text-xs text-white/70">
                  Hora
                  <input type="time" className="input" value={requestTime} onChange={(e) => setRequestTime(e.target.value)} required />
                </label>
              </div>

              <label className="grid gap-1 text-xs text-white/70">
                Ubicación acordada (texto libre)
                <input className="input" value={requestLocation} onChange={(e) => setRequestLocation(e.target.value)} placeholder="Ej: Metro Los Leones, Providencia" required />
              </label>

              <label className="grid gap-1 text-xs text-white/70">
                Comentario adicional (opcional)
                <textarea className="input min-h-20" value={requestComment} onChange={(e) => setRequestComment(e.target.value)} placeholder="Detalles que ayuden a coordinar" />
              </label>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                <div className="font-medium text-white/80">Accesos directos (informativo)</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href="/establecimientos" className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">Moteles / lugares</Link>
                  <Link href="/sexshops" className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">Servicios complementarios</Link>
                </div>
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setRequestModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button className="btn-primary" disabled={requesting}>{requesting ? "Enviando..." : "Enviar solicitud"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
