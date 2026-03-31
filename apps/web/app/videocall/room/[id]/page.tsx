"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";
import { connectRealtime } from "../../../../lib/realtime";
import useMe from "../../../../hooks/useMe";
import { getLivekitToken } from "../../../../lib/livekit";
import { Room, RoomEvent, type RemoteParticipant, Track } from "livekit-client";
import {
  Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Clock, User,
  Maximize, Minimize, Volume2, VolumeX, Send, MessageCircle,
  Loader2, Wifi, WifiOff, AlertCircle,
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

type RtcState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export default function VideocallRoomPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const myId = me?.user?.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "connecting" | "connected" | "ended">("loading");
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [connectingElapsed, setConnectingElapsed] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");
  const [rtcState, setRtcState] = useState<RtcState>("disconnected");

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteAudioOn, setRemoteAudioOn] = useState(true);
  const [remoteNeedsInteraction, setRemoteNeedsInteraction] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hasLocalStream, setHasLocalStream] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioEls = useRef<HTMLMediaElement[]>([]);
  const timerRef = useRef<any>(null);
  const connectingTimerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const mediaInitializedRef = useRef(false);
  const joinSentRef = useRef(false);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=client")
      .then((res) => {
        const found = res.bookings.find((b) => b.id === bookingId);
        if (found) { setBooking(found); return; }
        return apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=professional").then((r2) => {
          const found2 = r2.bookings.find((b) => b.id === bookingId);
          if (found2) setBooking(found2);
          else setError("Reserva no encontrada");
        });
      })
      .catch(() => setError("Error al cargar la reserva"));
  }, [bookingId]);

  const isProfessional = booking ? myId === booking.professionalId : false;
  const remotePerson = booking ? (isProfessional ? booking.client : booking.professional) : null;

  const roomOpen = booking
    ? Date.now() >= new Date(booking.scheduledAt).getTime() - 5 * 60 * 1000
    : false;

  useEffect(() => {
    mediaInitializedRef.current = false;
    joinSentRef.current = false;
  }, [bookingId]);

  const cleanupRoom = useCallback(async () => {
    for (const el of remoteAudioEls.current) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    remoteAudioEls.current = [];
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      await roomRef.current.disconnect(true);
      roomRef.current = null;
    }
  }, []);

  // Use refs to avoid stale closures in connectRoom callbacks
  const bookingRef = useRef(booking);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const attachRemoteVideo = useCallback((participant: RemoteParticipant) => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    for (const pub of participant.trackPublications.values()) {
      if (!pub.isSubscribed || !pub.track) continue;
      if (pub.track.kind === Track.Kind.Video) {
        pub.track.attach(videoEl);
      } else if (pub.track.kind === Track.Kind.Audio) {
        const audioEl = pub.track.attach();
        audioEl.volume = 1;
        remoteAudioEls.current.push(audioEl);
      }
    }
  }, []);

  const connectRoom = useCallback(async () => {
    const b = bookingRef.current;
    if (!b?.roomId) return;

    setStatus("connecting");
    setRtcState("connecting");
    clearInterval(connectingTimerRef.current);
    setConnectingElapsed(0);
    connectingTimerRef.current = setInterval(() => setConnectingElapsed((e) => e + 1), 1000);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === "connected") {
          setRtcState("connected");
          setStatus("connected");
          clearInterval(connectingTimerRef.current);
          setConnectingElapsed(0);
        }
        if (state === "connecting") setRtcState("connecting");
        if (state === "reconnecting") {
          setRtcState("reconnecting");
          setStatus("connecting");
        }
        if (state === "disconnected") {
          setRtcState("disconnected");
          if (statusRef.current !== "ended") setStatus("ended");
        }
      })
      .on(RoomEvent.Reconnected, () => {
        setRtcState("connected");
        setStatus("connected");
      })
      .on(RoomEvent.Reconnecting, () => {
        setRtcState("reconnecting");
        setStatus("connecting");
      })
      .on(RoomEvent.TrackSubscribed, async (track) => {
        if (track.kind === Track.Kind.Video) {
          const tryAttach = async () => {
            const videoEl = remoteVideoRef.current;
            if (videoEl) {
              track.attach(videoEl);
              videoEl.muted = true;
              try {
                await videoEl.play();
                setRemoteNeedsInteraction(false);
              } catch {
                setRemoteNeedsInteraction(true);
              }
              setStatus("connected");
            } else {
              requestAnimationFrame(() => tryAttach());
            }
          };
          tryAttach();
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach();
          audioEl.volume = 1;
          remoteAudioEls.current.push(audioEl);
          setRemoteAudioOn(true);
          try {
            await audioEl.play();
          } catch {
            setRemoteNeedsInteraction(true);
          }
        }
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        attachRemoteVideo(participant);
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

    try {
      const tokenRes = await getLivekitToken({
        kind: "videocall",
        bookingId: b.id,
        roomName: `videocall:${b.roomId}`,
      });
      await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });
      await room.localParticipant.enableCameraAndMicrophone();
      setHasLocalStream(true);
      if (localVideoRef.current) {
        const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPub?.track && cameraPub.track.kind === Track.Kind.Video) {
          cameraPub.track.attach(localVideoRef.current);
        }
      }
    } catch (err) {
      setRtcState("error");
      setStatus("waiting");
      setError(err instanceof Error ? err.message : "No se pudo conectar la videollamada");
      clearInterval(connectingTimerRef.current);
    }
  }, [attachRemoteVideo]);

  useEffect(() => {
    if (!booking || !myId || !roomOpen) return;
    if (!mediaInitializedRef.current) {
      mediaInitializedRef.current = true;
      setMediaError("");
      setStatus("waiting");
    }
    if (!joinSentRef.current) {
      joinSentRef.current = true;
      apiFetch(`/videocall/${bookingId}/join`, { method: "POST" }).catch(() => {});
    }
  }, [booking, myId, roomOpen, bookingId]);

  useEffect(() => {
    if (!myId || !booking) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;
      if (!data) return;
      if (data.bookingId && data.bookingId !== bookingId) return;

      if (event.type === "videocall:chat" && data.bookingId === bookingId && data.fromUserId) {
        setChatMessages((prev) => [...prev, {
          id: `${data.createdAt || Date.now()}-${data.fromUserId || "unknown"}`,
          bookingId: data.bookingId, fromUserId: data.fromUserId,
          senderName: data.senderName || "Usuario", message: data.message || "",
          createdAt: data.createdAt || new Date().toISOString(),
        }]);
      }

      if (event.type === "videocall:started" && data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
        if (status === "waiting") await connectRoom();
      }

      if (event.type === "videocall:completed" && data.bookingId === bookingId) {
        setStatus("ended");
        clearInterval(timerRef.current);
        clearInterval(connectingTimerRef.current);
        cleanupRoom().catch(() => {});
      }

      if (event.type === "videocall:user_joined" && data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
      }
    });

    return cleanup;
  }, [myId, booking, bookingId, status, connectRoom, cleanupRoom]);

  const startCall = async () => {
    if (!booking || !isProfessional) return;
    setStatus("connecting");
    try {
      await apiFetch(`/videocall/${bookingId}/start`, { method: "POST" });
      await connectRoom();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al iniciar");
      setStatus("waiting");
    }
  };

  const endCall = async () => {
    await cleanupRoom();
    clearInterval(timerRef.current);
    clearInterval(connectingTimerRef.current);
    setStatus("ended");
    try { await apiFetch(`/videocall/${bookingId}/complete`, { method: "POST" }); } catch {}
  };

  const toggleMic = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    const enabled = !micOn;
    participant.setMicrophoneEnabled(enabled).catch(() => {
      setMediaError("No se pudo cambiar el micrófono");
    });
    setMicOn(enabled);
  };

  const toggleCam = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    const enabled = !camOn;
    participant.setCameraEnabled(enabled).catch(() => {
      setMediaError("No se pudo cambiar la cámara");
    });
    setCamOn(enabled);
  };

  const toggleRemoteAudio = async () => {
    const newMuted = remoteAudioOn;
    for (const el of remoteAudioEls.current) {
      el.muted = newMuted;
      if (!newMuted) {
        try { await el.play(); } catch { /* autoplay blocked */ }
      }
    }
    setRemoteAudioOn(!newMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) { document.exitFullscreen(); setFullscreen(false); }
    else { containerRef.current.requestFullscreen(); setFullscreen(true); }
  };

  useEffect(() => {
    return () => {
      cleanupRoom().catch(() => {});
      clearInterval(timerRef.current);
      clearInterval(connectingTimerRef.current);
    };
  }, [cleanupRoom]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (status !== "connected" || !booking) return;

    const scheduledMs = new Date(booking.scheduledAt).getTime();
    const maxMs = booking.durationMinutes * 60 * 1000;

    const tick = () => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - scheduledMs);
      const remainingMs = Math.max(0, maxMs - elapsedMs);
      setTimeLeft(Math.ceil(remainingMs / 1000));

      if (remainingMs <= 0) {
        clearInterval(timerRef.current);
        endCall();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [status, booking]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || !bookingId) return;
    setChatError(""); setSendingChat(true);
    try {
      await apiFetch(`/videocall/${bookingId}/chat`, { method: "POST", body: JSON.stringify({ message }) });
      setChatInput("");
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally { setSendingChat(false); }
  };

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const elapsed = booking && timeLeft !== null ? booking.durationMinutes * 60 - timeLeft : 0;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white">
        <div className="text-center max-w-sm px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push("/videocall")} className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium transition hover:bg-white/15">Volver</button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b14] text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm text-white/40">Cargando videollamada...</p>
      </div>
    );
  }

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
            Se abre {minsUntil > 0 ? `en ${minsUntil} min` : "en breve"}.
          </p>
          <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              {remotePerson?.avatarUrl ? (
                <img src={resolveMediaUrl(remotePerson.avatarUrl) ?? undefined} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><User className="h-5 w-5 text-white/30" /></div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold">{remotePerson?.displayName || remotePerson?.username}</p>
                <p className="text-[11px] text-white/40">
                  {scheduled.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })} {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · {booking.durationMinutes} min
                </p>
              </div>
            </div>
          </div>
          <button onClick={() => router.push("/videocall")} className="text-sm text-violet-400 hover:text-violet-300">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a0b14] px-4 py-3">
        <div className="flex items-center gap-3">
          {remotePerson?.avatarUrl ? (
            <img src={resolveMediaUrl(remotePerson.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><User className="h-4 w-4 text-white/30" /></div>
          )}
          <div>
            <p className="text-sm font-semibold">{remotePerson?.displayName || remotePerson?.username}</p>
            <div className="flex items-center gap-1.5">
              {status === "waiting" && <><div className="h-1.5 w-1.5 rounded-full bg-amber-400" /><p className="text-[10px] text-amber-300/70">Esperando...</p></>}
              {status === "connecting" && <><Loader2 className="h-3 w-3 animate-spin text-amber-400" /><p className="text-[10px] text-amber-300/70">{rtcState === "reconnecting" ? "Reconectando" : "Conectando"}... {connectingElapsed > 0 ? formatTime(connectingElapsed) : ""}</p></>}
              {status === "connected" && <><Wifi className="h-3 w-3 text-emerald-400" /><p className="text-[10px] text-emerald-300/70">En llamada</p></>}
              {status === "ended" && <><WifiOff className="h-3 w-3 text-white/30" /><p className="text-[10px] text-white/30">Finalizada</p></>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === "connected" && timeLeft !== null && (
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono ${timeLeft < 60 ? "border-red-500/30 bg-red-500/20" : "border-emerald-500/30 bg-emerald-500/20"}`}>
              <Clock className="h-3 w-3" />
              <span className={timeLeft < 60 ? "text-red-300" : "text-emerald-300"}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
          {status === "connecting" && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-[10px] font-medium text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              {rtcState === "reconnecting" ? "Reconectando" : "Conectando"}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-gray-950 to-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain bg-black ${status !== "connected" ? "hidden" : ""}`}
          style={{ transform: "translateZ(0)" }}
        />

        {status === "connected" && remoteNeedsInteraction && (
          <button onClick={async () => {
            for (const el of remoteAudioEls.current) {
              el.muted = false;
              try { await el.play(); } catch { /* ignore */ }
            }
            const videoEl = remoteVideoRef.current;
            if (videoEl) {
              try { await videoEl.play(); } catch { /* ignore */ }
            }
            setRemoteAudioOn(true);
            setRemoteNeedsInteraction(false);
          }} className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
            Toca para activar audio
          </button>
        )}

        {status !== "connected" && (
          <div className="text-center px-6">
            {status === "loading" && (
              <div>
                <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-violet-400/50" />
                <p className="text-sm text-white/40">Preparando cámara y micrófono...</p>
              </div>
            )}
            {status === "waiting" && isProfessional && (booking.status === "PENDING" || booking.status === "CONFIRMED") && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <VideoIcon className="h-10 w-10 text-emerald-400" />
                </div>
                <p className="mb-2 text-sm font-medium">Listo para iniciar</p>
                <p className="mb-5 text-xs text-white/40">La otra persona recibirá una notificación</p>
                <button onClick={startCall} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3.5 text-sm font-semibold shadow-lg shadow-emerald-500/20 transition hover:opacity-90">
                  Iniciar Llamada
                </button>
              </div>
            )}
            {status === "waiting" && !isProfessional && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/15 animate-pulse">
                  <VideoIcon className="h-10 w-10 text-violet-400" />
                </div>
                <p className="text-sm text-white/50">Esperando al profesional...</p>
                <p className="mt-1 text-[10px] text-white/25">La llamada iniciará cuando se conecte</p>
              </div>
            )}
            {status === "waiting" && mediaError && (
              <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left">
                <p className="text-sm text-red-300">{mediaError}</p>
              </div>
            )}
            {status === "connecting" && (
              <div>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/15">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
                </div>
                <p className="text-sm font-medium text-white/70">Estableciendo conexión...</p>
                <p className="mt-1 text-[10px] text-white/30">
                  {connectingElapsed > 0 && `${formatTime(connectingElapsed)} · `}
                  El tiempo empieza a las {booking ? new Date(booking.scheduledAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
            )}
            {status === "ended" && (
              <div>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                  <PhoneOff className="h-8 w-8 text-white/30" />
                </div>
                <p className="mb-2 text-lg font-semibold text-white/50">Llamada finalizada</p>
                <p className="mb-5 text-sm text-white/30">Duración efectiva: {formatTime(elapsed)}</p>
                <button onClick={() => router.push("/videocall")} className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium transition hover:bg-white/15">
                  Volver
                </button>
              </div>
            )}
          </div>
        )}

        <button onClick={() => setChatOpen((v) => !v)} className={`absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border transition ${chatOpen ? "bg-violet-600 border-violet-400/30" : "bg-[#0a0b14]/85 border-white/15"} text-white`}>
          <MessageCircle className="h-4 w-4" />
        </button>

        <div className={`${chatOpen ? "flex" : "hidden"} absolute inset-x-3 bottom-20 z-20 h-[50%] flex-col rounded-2xl border border-white/10 bg-[#0a0b14]/90 p-3 backdrop-blur sm:inset-auto sm:right-4 sm:top-20 sm:bottom-auto sm:h-[55%] sm:w-[320px]`}>
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-sm font-semibold text-white/90">
            <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Chat</div>
            <button onClick={() => setChatOpen(false)} className="text-xs text-white/60">Cerrar</button>
          </div>

          <div ref={chatListRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
            {chatMessages.length === 0 && <p className="text-xs text-white/40">Escribe un mensaje.</p>}
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
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }} maxLength={500} placeholder="Escribe..." className="h-9 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/35" />
            <button onClick={sendChat} disabled={sendingChat || !chatInput.trim()} className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {status !== "ended" && hasLocalStream && (
          <div className="absolute bottom-4 right-4 h-28 w-20 overflow-hidden rounded-xl border-2 border-white/20 shadow-xl sm:h-32 sm:w-24">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <VideoOff className="h-5 w-5 text-white/30" />
              </div>
            )}
          </div>
        )}
      </div>

      {status !== "ended" && (
        <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] bg-[#0a0b14] px-4 py-4">
          {hasLocalStream && (
            <>
              <button onClick={toggleMic} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/80 text-white"}`}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button onClick={toggleCam} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/80 text-white"}`}>
                {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </>
          )}
          <button onClick={toggleRemoteAudio} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${remoteAudioOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-amber-500/80 text-white"}`}>
            {remoteAudioOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button onClick={toggleFullscreen} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition">
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          {(status === "connected" || status === "connecting") && (
            <button onClick={endCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 transition shadow-lg shadow-red-500/30">
              <PhoneOff className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
