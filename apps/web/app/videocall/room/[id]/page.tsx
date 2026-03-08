"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";
import { connectRealtime } from "../../../../lib/realtime";
import { WebRTCPeer, getLocalMedia } from "../../../../lib/webrtc";
import useMe from "../../../../hooks/useMe";
import {
  Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Clock, User,
  Maximize, Minimize, Volume2, VolumeX, Send, MessageCircle,
} from "lucide-react";

type ChatMessage = {
  id: string;
  bookingId: string;
  fromUserId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

type Booking = {
  id: string;
  clientId: string;
  professionalId: string;
  scheduledAt: string;
  durationMinutes: number;
  totalTokens: number;
  status: string;
  roomId: string | null;
  startedAt: string | null;
  clientJoinedAt: string | null;
  professionalJoinedAt: string | null;
  client: { id: string; displayName: string; username: string; avatarUrl: string | null };
  professional: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

export default function VideocallRoomPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const myId = me?.user?.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "connecting" | "connected" | "ended">("loading");
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  // Media controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteAudioOn, setRemoteAudioOn] = useState(false);
  const [remoteNeedsInteraction, setRemoteNeedsInteraction] = useState(false);
  const [chatOpenMobile, setChatOpenMobile] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const mediaInitializedRef = useRef(false);
  const joinSentRef = useRef(false);

  // Load booking
  useEffect(() => {
    apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=client")
      .then((res) => {
        const found = res.bookings.find((b) => b.id === bookingId);
        if (found) { setBooking(found); return; }
        // Try as professional
        return apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=professional").then((r2) => {
          const found2 = r2.bookings.find((b) => b.id === bookingId);
          if (found2) setBooking(found2);
          else setError("Reserva no encontrada");
        });
      })
      .catch(() => setError("Error al cargar la reserva"));
  }, [bookingId]);

  // Determine roles
  const isProfessional = booking ? myId === booking.professionalId : false;
  const remoteUserId = booking ? (isProfessional ? booking.clientId : booking.professionalId) : null;
  const remotePerson = booking ? (isProfessional ? booking.client : booking.professional) : null;

  // Check if the room is open (5 minutes before scheduled time)
  const roomOpen = booking
    ? Date.now() >= new Date(booking.scheduledAt).getTime() - 5 * 60 * 1000
    : false;

  useEffect(() => {
    mediaInitializedRef.current = false;
    joinSentRef.current = false;
  }, [bookingId]);

  // Initialize media and wait for call
  const initMedia = useCallback(async () => {
    try {
      setMediaError("");
      const stream = await getLocalMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      const mediaErr = err instanceof DOMException ? err : null;
      const details = mediaErr?.message ? ` (${mediaErr.message})` : "";

      if (mediaErr?.name === "NotAllowedError") {
        setMediaError(
          "Permisos de cámara o micrófono bloqueados. Si estás en incógnito o en iPhone PWA, cierra y abre la sala y acepta el permiso al aparecer el popup.",
        );
      } else if (mediaErr?.name === "NotReadableError") {
        setMediaError(
          "No se puede abrir cámara o micrófono porque otro proceso/dispositivo los está usando. Cierra Zoom/Meet/Instagram y reintenta." + details,
        );
      } else if (mediaErr?.name === "OverconstrainedError") {
        setMediaError(
          "Tu dispositivo no soporta la configuración solicitada de cámara/micrófono. Intenta nuevamente para usar un modo compatible." + details,
        );
      } else if (mediaErr?.name === "NotFoundError") {
        setMediaError(
          "No encontramos cámara o micrófono disponibles en este equipo. Verifica que estén conectados y habilitados." + details,
        );
      } else {
        setMediaError(
          "No se pudo acceder a cámara y/o micrófono. Verifica permisos del navegador y que no estén en uso por otra app." + details,
        );
      }
    }
    // Always transition to waiting so the room UI renders (even if media failed)
    setStatus("waiting");
  }, []);

  useEffect(() => {
    if (!booking || !myId || !roomOpen) return;

    if (!mediaInitializedRef.current) {
      mediaInitializedRef.current = true;
      initMedia();
    }

    if (!joinSentRef.current) {
      joinSentRef.current = true;
      // Track that this user joined the room (only once to avoid 429 loops)
      apiFetch(`/videocall/${bookingId}/join`, { method: "POST" }).catch(() => {});
    }
  }, [booking, myId, roomOpen, initMedia, bookingId]);

  // Create peer connection
  const createPeer = useCallback(() => {
    if (!remoteUserId || !localStreamRef.current) return null;

    peerRef.current?.close();

    const peer = new WebRTCPeer(remoteUserId, {
      onRemoteStream: async (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          // Start muted to satisfy mobile autoplay policies; user can unmute manually.
          remoteVideoRef.current.muted = true;
          setRemoteAudioOn(false);
          try {
            await remoteVideoRef.current.play();
            setRemoteNeedsInteraction(false);
          } catch {
            setRemoteNeedsInteraction(true);
          }
        }
        setStatus("connected");
        // Start timer
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      },
      onConnectionState: (state) => {
        if (state === "disconnected" || state === "failed" || state === "closed") {
          setStatus("ended");
          clearInterval(timerRef.current);
        }
      },
    }, { bookingId });

    peer.addStream(localStreamRef.current);
    peerRef.current = peer;
    return peer;
  }, [remoteUserId, bookingId]);

  // Listen for signaling via SSE
  useEffect(() => {
    if (!myId || !booking || !remoteUserId) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;
      if (!data) return;
      if (data.bookingId && data.bookingId !== bookingId) return;

      if (event.type === "signal:offer") {
        if (data.fromUserId !== remoteUserId) return;
        // I'm the callee — create peer, handle offer
        setStatus("connecting");
        const peer = createPeer();
        if (peer) {
          await peer.handleOffer(data.sdp);
        }
      }

      if (event.type === "signal:answer") {
        if (data.fromUserId !== remoteUserId) return;
        // I'm the caller — set remote description
        if (peerRef.current) {
          await peerRef.current.handleAnswer(data.sdp);
        }
      }

      if (event.type === "signal:ice") {
        if (data.fromUserId !== remoteUserId) return;
        if (peerRef.current) {
          await peerRef.current.handleIceCandidate(data.candidate);
        }
      }

      if (event.type === "videocall:chat" && data.bookingId === bookingId && data.fromUserId) {
        const msg: ChatMessage = {
          id: `${data.createdAt || Date.now()}-${data.fromUserId || "unknown"}`,
          bookingId: data.bookingId,
          fromUserId: data.fromUserId,
          senderName: data.senderName || "Usuario",
          message: data.message || "",
          createdAt: data.createdAt || new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, msg]);
      }

      // If the other side started the videocall via API
      if (event.type === "videocall:started" && data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
      }

      if (event.type === "videocall:completed" && data.bookingId === bookingId) {
        setStatus("ended");
        clearInterval(timerRef.current);
      }

      if (event.type === "videocall:user_joined" && data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);

        // If I'm the professional and already waiting/connecting, re-send offer.
        // This covers the case where the first offer was sent before the other side opened the room.
        if (isProfessional && (status === "waiting" || status === "connecting")) {
          const peer = createPeer();
          if (peer) {
            setStatus("connecting");
            await peer.createOffer();
          }
        }
      }
    });

    return cleanup;
  }, [myId, booking, remoteUserId, bookingId, createPeer, isProfessional, status]);

  // Professional: start call and send offer
  const startCall = async () => {
    if (!booking || !isProfessional) return;
    setStatus("connecting");

    // Notify server that call started
    try {
      await apiFetch(`/videocall/${bookingId}/start`, { method: "POST" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al iniciar";
      setError(message);
      return;
    }

    const peer = createPeer();
    if (peer) {
      await peer.createOffer();
    }
  };

  // End call
  const endCall = async () => {
    peerRef.current?.close();
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("ended");

    try {
      await apiFetch(`/videocall/${bookingId}/complete`, { method: "POST" });
    } catch {}
  };

  // Toggle mic
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // Toggle camera
  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  };

  // Toggle remote audio
  const toggleRemoteAudio = async () => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
    setRemoteAudioOn(!remoteVideoRef.current.muted);
    try {
      await remoteVideoRef.current.play();
      setRemoteNeedsInteraction(false);
    } catch {
      setRemoteNeedsInteraction(true);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.close();
      clearInterval(timerRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || !bookingId) return;

    setChatError("");
    setSendingChat(true);
    try {
      await apiFetch(`/videocall/${bookingId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setChatInput("");
    } catch (e: unknown) {
      const messageText = e instanceof Error ? e.message : "No se pudo enviar el mensaje";
      setChatError(messageText);
    } finally {
      setSendingChat(false);
    }
  };

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const maxSeconds = booking ? booking.durationMinutes * 60 : 0;
  const timeLeft = maxSeconds - elapsed;

  // Auto-end when time runs out
  useEffect(() => {
    if (status === "connected" && timeLeft <= 0 && booking) {
      endCall();
    }
  }, [status, timeLeft]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push("/videocall")} className="text-sm text-fuchsia-400 underline">Volver</button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/30">
        Cargando videollamada...
      </div>
    );
  }

  // Room not yet open — show elegant countdown
  if (!roomOpen) {
    const scheduled = new Date(booking.scheduledAt);
    const roomOpensAt = new Date(scheduled.getTime() - 5 * 60 * 1000);
    const msUntil = roomOpensAt.getTime() - Date.now();
    const minsUntil = Math.max(0, Math.ceil(msUntil / 60000));

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b14] text-white px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <Clock className="h-12 w-12 text-violet-300" />
          </div>
          <h2 className="mb-2 text-xl font-bold">Sala en preparación</h2>
          <p className="mb-6 text-sm text-white/50">
            La sala se abrirá {minsUntil > 0 ? `en ${minsUntil} minuto${minsUntil !== 1 ? "s" : ""}` : "en breve"}.
          </p>
          <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              {remotePerson?.avatarUrl ? (
                <img src={resolveMediaUrl(remotePerson.avatarUrl) ?? undefined} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <User className="h-5 w-5 text-white/30" />
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold">{remotePerson?.displayName || remotePerson?.username}</p>
                <p className="text-[11px] text-white/40">
                  {scheduled.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                  {" "}
                  {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {booking.durationMinutes} min
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push("/videocall")}
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            Volver a videollamadas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col bg-black text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a0b14] px-4 py-3">
        <div className="flex items-center gap-3">
          {remotePerson?.avatarUrl ? (
            <img src={resolveMediaUrl(remotePerson.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <User className="h-4 w-4 text-white/30" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{remotePerson?.displayName || remotePerson?.username}</p>
            <p className="text-[10px] text-white/40">
              {status === "waiting" && "Esperando..."}
              {status === "connecting" && "Conectando..."}
              {status === "connected" && "En llamada"}
              {status === "ended" && "Llamada finalizada"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(status === "connected" || status === "connecting") && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-mono">
              <Clock className="h-3 w-3" />
              <span className={timeLeft < 60 ? "text-red-300" : "text-emerald-300"}>
                {formatTime(Math.max(0, timeLeft))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-gray-950 to-black">
        {/* Remote video (full) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`h-full w-full object-cover ${status !== "connected" ? "hidden" : ""}`}
        />

        {status === "connected" && remoteNeedsInteraction && (
          <button
            onClick={toggleRemoteAudio}
            className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-xs font-semibold text-white"
          >
            Toca para activar reproducción
          </button>
        )}

        {/* Placeholder when not connected */}
        {status !== "connected" && (
          <div className="text-center">
            {status === "loading" && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 animate-pulse">
                  <VideoIcon className="h-10 w-10 text-white/30" />
                </div>
                <p className="text-sm text-white/40">Preparando cámara y micrófono...</p>
              </div>
            )}
            {status === "waiting" && isProfessional && (booking.status === "PENDING" || booking.status === "CONFIRMED") && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                  <VideoIcon className="h-10 w-10 text-emerald-400" />
                </div>
                <p className="mb-4 text-sm text-white/50">Listo para iniciar la videollamada</p>
                <button
                  onClick={startCall}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3 text-sm font-semibold"
                >
                  Iniciar Llamada
                </button>
              </div>
            )}
            {status === "waiting" && !isProfessional && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/20 animate-pulse">
                  <VideoIcon className="h-10 w-10 text-violet-400" />
                </div>
                <p className="text-sm text-white/50">Esperando que el profesional inicie la llamada...</p>
              </div>
            )}
            {status === "waiting" && mediaError && (
              <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left">
                <p className="text-sm text-red-300">{mediaError}</p>
                <button
                  onClick={initMedia}
                  className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Reintentar permisos
                </button>
              </div>
            )}
            {status === "connecting" && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 animate-pulse">
                  <VideoIcon className="h-10 w-10 text-amber-400" />
                </div>
                <p className="text-sm text-white/50">Estableciendo conexión WebRTC...</p>
              </div>
            )}
            {status === "ended" && (
              <div>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <PhoneOff className="h-8 w-8 text-white/30" />
                </div>
                <p className="mb-2 text-lg font-semibold text-white/50">Llamada finalizada</p>
                <p className="mb-4 text-sm text-white/30">Duración: {formatTime(elapsed)}</p>
                <button onClick={() => router.push("/videocall")} className="text-sm text-fuchsia-400 underline">
                  Volver a Videollamadas
                </button>
              </div>
            )}
          </div>
        )}

        {/* In-call chat */}
        <button
          onClick={() => setChatOpenMobile((v) => !v)}
          className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#0a0b14]/85 border border-white/15 text-white sm:hidden"
        >
          <MessageCircle className="h-4 w-4" />
        </button>

        <div className={`${chatOpenMobile ? "flex" : "hidden"} absolute inset-x-3 bottom-20 z-20 h-[50%] flex-col rounded-2xl border border-white/10 bg-[#0a0b14]/90 p-3 backdrop-blur sm:inset-auto sm:left-4 sm:top-4 sm:bottom-auto sm:h-[60%] sm:w-[330px] sm:flex`}>
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-sm font-semibold text-white/90">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat de la llamada
            </div>
            <button onClick={() => setChatOpenMobile(false)} className="text-xs text-white/60 sm:hidden">Cerrar</button>
          </div>

          <div ref={chatListRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
            {chatMessages.length === 0 && (
              <p className="text-xs text-white/40">Escribe un mensaje para comunicarte sin micrófono.</p>
            )}
            {chatMessages.map((msg) => {
              const mine = msg.fromUserId === myId;
              return (
                <div key={msg.id} className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${mine ? "ml-auto bg-violet-600/70" : "bg-white/10"}`}>
                  <p className="mb-1 text-[10px] text-white/60">{mine ? "Tú" : msg.senderName}</p>
                  <p className="break-words text-white/90">{msg.message}</p>
                </div>
              );
            })}
          </div>

          {chatError && <p className="mt-1 text-[10px] text-red-300">{chatError}</p>}

          <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendChat();
                }
              }}
              maxLength={500}
              placeholder="Escribe un mensaje..."
              className="h-9 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/35"
            />
            <button
              onClick={sendChat}
              disabled={sendingChat || !chatInput.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Local video (PiP) */}
        {status !== "ended" && (
          <div className="absolute bottom-4 right-4 h-36 w-28 overflow-hidden rounded-2xl border-2 border-white/20 shadow-xl sm:h-48 sm:w-36">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <VideoOff className="h-6 w-6 text-white/30" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {status !== "ended" && (
        <div className="flex items-center justify-center gap-4 border-t border-white/[0.06] bg-[#0a0b14] px-4 py-4">
          <button
            onClick={toggleMic}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/80 text-white"
            }`}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          <button
            onClick={toggleCam}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/80 text-white"
            }`}
          >
            {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          <button
            onClick={toggleRemoteAudio}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              remoteAudioOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-amber-500/80 text-white"
            }`}
          >
            {remoteAudioOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>

          {(status === "connected" || status === "connecting") && (
            <button
              onClick={endCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 transition shadow-lg shadow-red-500/30"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
