"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  apiFetch,
  API_URL,
  isAuthError,
  resolveMediaUrl,
} from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  MapPin,
  Paperclip,
  Send,
  X,
  AlertCircle,
  Hotel,
  DollarSign,
  Zap,
} from "lucide-react";

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

/** Pregunta rápida de la profesional (la respuesta llega como mensaje). */
type QuickReplyTopic = {
  key: string;
  label: string;
  question: string;
};

type ConversationResponse = {
  messages: Message[];
  other: ChatUser;
  quickReplies?: QuickReplyTopic[];
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
  user: {
    id: string;
    displayName: string | null;
    username: string;
    profileType: string | null;
  } | null;
};

function profileLabel(type: string) {
  if (type === "PROFESSIONAL") return "Experiencia";
  if (type === "SHOP") return "Tienda";
  if (type === "ESTABLISHMENT") return "Lugar";
  return "Perfil";
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
  const [quickTopics, setQuickTopics] = useState<QuickReplyTopic[]>([]);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  /* "Escribiendo…" de la otra persona: hasta cuándo mostrarlo. Llega por el
     canal en tiempo real (y lo fija también la respuesta rápida pendiente). */
  const [typingUntil, setTypingUntil] = useState(0);
  const lastTypingSentRef = useRef(0);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeBooking, setActiveBooking] = useState<MotelBooking | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [lastRealtimeAt, setLastRealtimeAt] = useState(0);
  const fallbackStepsMs = [2000, 5000, 10000, 20000] as const;
  const fallbackStepRef = useRef(0);
  const fallbackInFlightRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  function scrollToBottom(smooth = true) {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }

  // Use useLayoutEffect to scroll before paint on initial load (prevents flash)
  useLayoutEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  async function loadBookingState(profile: MeResponse["user"] | null) {
    if (
      !profile ||
      !["CLIENT", "ESTABLISHMENT"].includes(
        String(profile.profileType || "").toUpperCase(),
      )
    ) {
      setActiveBooking(null);
      return;
    }
    try {
      const res = await apiFetch<{ booking: MotelBooking | null }>(
        `/motel/bookings/with/${userId}`,
      );
      setActiveBooking(res.booking || null);
    } catch {
      setActiveBooking(null);
    }
  }

  async function load() {
    const [meResp, msgResp] = await Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<ConversationResponse>(`/messages/${userId}`),
    ]);
    setMe(meResp.user);
    setMessages(msgResp.messages);
    setOther(msgResp.other);
    setQuickTopics(msgResp.quickReplies || []);
    await loadBookingState(meResp.user);
  }

  useEffect(() => {
    load()
      .catch((e: any) => {
        if (isAuthError(e)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (e?.status === 403) {
          setError(
            "No puedes iniciar chat con este perfil. Suscríbete o espera a que habilite mensajes.",
          );
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
      const msgResp = await apiFetch<ConversationResponse>(
        `/messages/${userId}`,
      );
      setMessages(msgResp.messages);
      setOther(msgResp.other);
      setQuickTopics(msgResp.quickReplies || []);
      await loadBookingState(me);
    } catch {
      // silent polling
    }
  }

  async function applyBookingAction(
    action: "ACCEPT" | "REJECT" | "CONFIRM" | "CANCEL" | "FINISH",
  ) {
    if (!activeBooking) return;
    setBookingBusy(true);
    try {
      const payload: Record<string, any> = { action };
      if (action === "REJECT") {
        payload.rejectReason = "OTRO";
        payload.rejectNote = "No disponible";
      }
      const res = await apiFetch<{ booking: MotelBooking }>(
        `/motel/bookings/${activeBooking.id}/action`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setActiveBooking(res.booking || null);
      await refreshConversationSilently();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la reserva");
    } finally {
      setBookingBusy(false);
    }
  }

  // Se apaga solo al vencer, o cuando llega un mensaje suyo.
  useEffect(() => {
    if (!typingUntil) return;
    const t = setTimeout(() => setTypingUntil(0), Math.max(0, typingUntil - Date.now()));
    return () => clearTimeout(t);
  }, [typingUntil]);

  const lastMessageFromId = messages[messages.length - 1]?.fromId;
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (lastMessageFromId === userId) setTypingUntil(0);
  }, [lastMessageId, lastMessageFromId, userId]);

  const otherTyping = typingUntil > Date.now();

  useEffect(() => {
    if (otherTyping) scrollToBottom();
  }, [otherTyping]);

  /** Avisa al otro que estoy escribiendo (como mucho cada 3 segundos). */
  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    apiFetch(`/messages/${userId}/typing`, { method: "POST" }).catch(() => {});
  }

  useEffect(() => {
    const disconnect = connectRealtime((event) => {
      if (event.type === "typing" && event.data?.fromId === userId) {
        setTypingUntil(Date.now() + Math.min(Number(event.data?.ms) || 5000, 10000));
        return;
      }
      if (
        ["connected", "hello", "ping", "message"].includes(
          event.type,
        )
      ) {
        fallbackStepRef.current = 0;
        setLastRealtimeAt(Date.now());
      }
      if (
        [
          "message",
          "booking:new",
          "booking:update",
        ].includes(event.type)
      ) {
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
        const currentDelay =
          fallbackStepsMs[
            Math.min(fallbackStepRef.current, fallbackStepsMs.length - 1)
          ];
        schedule(currentDelay);
        return;
      }

      fallbackInFlightRef.current = true;
      refreshConversationSilently().finally(() => {
        fallbackInFlightRef.current = false;
        fallbackStepRef.current = Math.min(
          fallbackStepRef.current + 1,
          fallbackStepsMs.length - 1,
        );
        const nextDelay = fallbackStepsMs[fallbackStepRef.current];
        schedule(nextDelay);
      });
    };

    schedule(
      fallbackStepsMs[
        Math.min(fallbackStepRef.current, fallbackStepsMs.length - 1)
      ],
    );

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
          body: form,
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
        const msg = await apiFetch<{ message: Message }>(
          `/messages/${userId}`,
          {
            method: "POST",
            body: JSON.stringify({ body }),
          },
        );
        setMessages((prev) => [...prev, msg.message]);
        setBody("");
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar el mensaje");
    }
  }

  // El cliente toca "Tarifa", "Servicios"...: queda su pregunta en el chat y,
  // tras unos segundos de "escribiendo…", la respuesta que dejó la profesional.
  async function askQuick(topic: QuickReplyTopic) {
    if (quickBusy) return;
    setQuickBusy(topic.key);
    let waitMs = 0;
    try {
      const res = await apiFetch<{ messages: Message[]; replyInMs?: number }>(
        `/messages/${userId}/quick-reply`,
        {
          method: "POST",
          body: JSON.stringify({ topic: topic.key }),
        },
      );
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...prev, ...res.messages.filter((m) => !known.has(m.id))];
      });
      waitMs = Math.min(Number(res.replyInMs) || 0, 10000);
      if (waitMs) setTypingUntil(Date.now() + waitMs + 1500);
    } catch (e: any) {
      setError(e?.body?.message || e?.message || "No se pudo enviar la pregunta");
    } finally {
      // Los botones quedan en pausa hasta que llega la respuesta; si el
      // tiempo real no la trae, se recarga la conversación.
      setTimeout(() => {
        setQuickBusy(null);
        if (waitMs) refreshConversationSilently();
      }, waitMs ? waitMs + 700 : 0);
    }
  }

  const isMotelOwnerChat =
    String(me?.profileType || "").toUpperCase() === "ESTABLISHMENT";
  const isClientChat = String(me?.profileType || "").toUpperCase() === "CLIENT";
  const hasMotelBooking = Boolean(activeBooking);

  const bookingMapsLink = activeBooking
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([activeBooking.establishmentAddress || "", activeBooking.establishmentCity || ""].join(" ").trim() || "motel")}`
    : "";

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
      <div className="mx-auto flex h-[70vh] w-full max-w-3xl flex-col px-4 md:px-0">
        <div className="flex items-center gap-3 p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          </div>
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
              <div
                className={`h-12 animate-pulse rounded-2xl bg-white/10 ${i % 2 === 0 ? "w-2/5" : "w-3/5"}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 md:px-0">
        <div className="flex items-center gap-3 p-4">
          <Link
            href="/chat"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
          >
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
    /* En el teléfono la conversación ocupa la pantalla completa bajo la
       cabecera: sin bordes redondeados ni márgenes, como cualquier app de
       mensajería. En escritorio vuelve a ser la tarjeta centrada. */
    <div className="flex h-[calc(100dvh-76px)] w-full flex-col overflow-hidden bg-white/[0.02] md:mx-auto md:h-[calc(100vh-160px)] md:max-w-3xl md:rounded-3xl md:border md:border-white/10 md:bg-white/5 md:shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:backdrop-blur-2xl">
      {/* ── Header ── */}
      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/15 to-transparent" />
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
            {otherTyping ? (
              <span className="font-medium text-fuchsia-300">escribiendo…</span>
            ) : (
              <>@{other?.username}</>
            )}
            {!otherTyping && other?.city ? ` · ${other.city}` : ""}
          </p>
        </div>

      </div>

      {/* ── Booking card ── */}
      {hasMotelBooking && (
        <div className="shrink-0 space-y-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          {/* Motel booking card */}
          {hasMotelBooking && (
            <div className="rounded-xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/[0.08] to-violet-500/[0.05] p-3">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-fuchsia-400" />
                <span className="text-xs font-semibold text-fuchsia-300">
                  Reserva motel/hotel
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-[11px] text-white/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Habitación:</span>{" "}
                  {activeBooking?.roomName || "Habitación"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Tramo:</span>{" "}
                  {activeBooking?.durationType || "3H"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Inicio:</span>{" "}
                  {activeBooking?.startAt
                    ? new Date(activeBooking.startAt).toLocaleString("es-CL")
                    : "por confirmar"}
                </div>
                {activeBooking?.basePriceClp &&
                  activeBooking.basePriceClp >
                    Number(activeBooking.priceClp || 0) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40">Base:</span>{" "}
                      <span className="line-through">
                        $
                        {Number(activeBooking.basePriceClp).toLocaleString(
                          "es-CL",
                        )}
                      </span>
                    </div>
                  )}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-white/40" />
                  <span className="font-medium text-white/80">
                    $
                    {Number(activeBooking?.priceClp || 0).toLocaleString(
                      "es-CL",
                    )}
                  </span>
                  {Number(activeBooking?.discountClp || 0) > 0 && (
                    <span className="text-emerald-400">
                      (-$
                      {Number(activeBooking?.discountClp || 0).toLocaleString(
                        "es-CL",
                      )}
                      )
                    </span>
                  )}
                </div>
                {activeBooking?.confirmationCode && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/40">Código:</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/90">
                      {activeBooking.confirmationCode}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {isMotelOwnerChat && activeBooking?.status === "PENDIENTE" && (
                  <>
                    <button
                      className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110"
                      disabled={bookingBusy}
                      onClick={() => applyBookingAction("ACCEPT")}
                    >
                      {bookingBusy ? "..." : "Aceptar"}
                    </button>
                    <button
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10"
                      disabled={bookingBusy}
                      onClick={() => applyBookingAction("REJECT")}
                    >
                      {bookingBusy ? "..." : "Rechazar"}
                    </button>
                  </>
                )}
                {isClientChat && activeBooking?.status === "ACEPTADA" && (
                  <button
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110"
                    disabled={bookingBusy}
                    onClick={() => applyBookingAction("CONFIRM")}
                  >
                    {bookingBusy ? "..." : "Confirmar"}
                  </button>
                )}
                {isClientChat &&
                  ["PENDIENTE", "ACEPTADA", "CONFIRMADA"].includes(
                    String(activeBooking?.status || ""),
                  ) && (
                    <button
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10"
                      disabled={bookingBusy}
                      onClick={() => applyBookingAction("CANCEL")}
                    >
                      {bookingBusy ? "..." : "Cancelar"}
                    </button>
                  )}
                {isMotelOwnerChat && activeBooking?.status === "CONFIRMADA" && (
                  <button
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10"
                    disabled={bookingBusy}
                    onClick={() => applyBookingAction("FINISH")}
                  >
                    {bookingBusy ? "..." : "Finalizar"}
                  </button>
                )}
                {activeBooking?.status === "CONFIRMADA" && (
                  <a
                    href={bookingMapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/10"
                  >
                    <MapPin className="mr-1 inline h-3 w-3" />
                    Maps
                  </a>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Messages ── */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
      >
        {!messages.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
              <Send className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-xs text-white/40">
              {quickTopics.length
                ? "Toca una pregunta para ver la respuesta al instante, o escribe tu mensaje."
                : "Inicia la conversación"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="my-4 flex items-center justify-center">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/35">
                    {formatDate(group.date)}
                  </span>
                </div>

                {group.messages.map((m, idx) => {
                  const isMine = m.fromId === me?.id;
                  const isImage = m.body.startsWith("ATTACHMENT_IMAGE:");
                  const imageUrl = isImage
                    ? resolveMediaUrl(m.body.replace("ATTACHMENT_IMAGE:", ""))
                    : null;
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
                            : "rounded-bl-md border border-white/10 bg-white/10 text-white/85"
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
                          <div className="whitespace-pre-wrap break-words">
                            {m.body}
                          </div>
                        )}
                        <div
                          className={`mt-0.5 text-right text-[10px] ${isMine ? "text-white/50" : "text-white/30"}`}
                        >
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
        {/* La otra persona está escribiendo */}
        {otherTyping && (
          <div className="mt-2 flex justify-start" aria-live="polite" aria-label="Escribiendo">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/10 px-3.5 py-3">
              {[0, 160, 320].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-white/60"
                  style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Attachment preview ── */}
      {attachmentPreview && (
        <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-4 py-2">
          <div className="flex items-center gap-3">
            <img
              src={attachmentPreview}
              alt="Adjunto"
              className="h-14 w-14 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/60">
                {attachment?.name}
              </p>
              <p className="text-[10px] text-white/35">
                {attachment?.size
                  ? `${(attachment.size / 1024).toFixed(0)} KB`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                setAttachmentPreview(null);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Preguntas rápidas (tarifa, servicios...) ── */}
      {quickTopics.length > 0 && other && me?.id !== other.id && (
        <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-3 pt-2.5">
          <p className="mb-1.5 flex items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-white/35">
            <Zap className="h-3 w-3 text-fuchsia-300/70" />
            Pregunta rápida
          </p>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickTopics.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => askQuick(t)}
                disabled={Boolean(quickBusy)}
                className="shrink-0 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-3.5 py-1.5 text-xs font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <form
        onSubmit={send}
        /* El hueco de abajo deja pasar la barra de navegación fija del móvil:
           sin él, el campo quedaba escondido detrás de ella. */
        className="flex shrink-0 items-end gap-2 border-t border-white/10 bg-white/5 px-3 pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-3"
      >
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
              reader.onload = () =>
                setAttachmentPreview(String(reader.result || ""));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <input
          /* 16px: por debajo de ese tamaño Safari en iPhone hace zoom al
             enfocar el campo y deja la página descuadrada. */
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white placeholder-white/35 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-fuchsia-500/20 md:text-sm"
          placeholder="Escribe un mensaje..."
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (e.target.value.trim()) notifyTyping();
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() && !attachment}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white transition hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

    </div>
  );
}
