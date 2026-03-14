"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl, getApiBase } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { connectRealtime } from "../../../lib/realtime";
import { getLocalMedia } from "../../../lib/webrtc";
import { getLivekitToken } from "../../../lib/livekit";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Radio, Users, Send, X, ShieldAlert, Mic, MicOff, VideoIcon, VideoOff,
} from "lucide-react";

type Stream = {
  id: string;
  title: string | null;
  isActive: boolean;
  viewerCount: number;
  maxViewers: number;
  startedAt: string;
  host: { id: string; displayName: string; username: string; avatarUrl: string | null };
  messages: ChatMsg[];
};

type ChatMsg = {
  id: string;
  userId: string;
  userName?: string;
  message: string;
  createdAt: string;
};

type RtcState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export default function LiveStreamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [stream, setStream] = useState<Stream | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [needsManualPermission, setNeedsManualPermission] = useState(false);
  const [rtcState, setRtcState] = useState<RtcState>("disconnected");
  const [rtcError, setRtcError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);

  const myId = me?.user?.id;

  useEffect(() => {
    apiFetch<{ stream: Stream }>(`/live/${id}`)
      .then((r) => {
        setStream(r.stream);
        setMessages(r.stream.messages?.reverse() || []);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const isHost = stream ? myId === stream.host.id : false;

  const initHostMedia = useCallback(async () => {
    try {
      setMediaError("");
      setNeedsManualPermission(false);
      const media = await getLocalMedia({ video: true, audio: true });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = media;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
      }
      setVideoReady(true);
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
      setMediaError(
        isDenied
          ? "Permisos de cámara o micrófono denegados. Actívalos en la configuración de tu navegador o app."
          : "No se pudo acceder a cámara y micrófono. Verifica permisos y vuelve a intentar.",
      );
      setNeedsManualPermission(true);
      setVideoReady(false);
    }
  }, []);

  useEffect(() => {
    if (!isHost || !stream?.isActive) return;
    initHostMedia();
  }, [isHost, stream?.isActive, initHostMedia]);

  const cleanupRoom = useCallback(async () => {
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      await roomRef.current.disconnect(true);
      roomRef.current = null;
    }
  }, []);

  const attachRemoteTrack = useCallback((room: Room) => {
    if (!remoteVideoRef.current) return;
    const publication = Array.from(room.remoteParticipants.values())
      .flatMap((participant) => Array.from(participant.trackPublications.values()))
      .find((pub) => pub.isSubscribed && pub.track && pub.track.kind === Track.Kind.Video);

    if (publication?.track && publication.track.kind === Track.Kind.Video) {
      publication.track.attach(remoteVideoRef.current);
      setVideoReady(true);
    }
  }, []);

  const connectToLivekit = useCallback(async () => {
    if (!stream || !myId || !stream.isActive) return;

    setRtcError("");
    setRtcState("connecting");

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.Reconnecting, () => setRtcState("reconnecting"))
      .on(RoomEvent.Reconnected, () => setRtcState("connected"))
      .on(RoomEvent.Disconnected, () => {
        setRtcState("disconnected");
        if (!isHost) setVideoReady(false);
      })
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === "connected") setRtcState("connected");
        if (state === "connecting") setRtcState("connecting");
        if (state === "reconnecting") setRtcState("reconnecting");
        if (state === "disconnected") setRtcState("disconnected");
      })
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (!isHost && remoteVideoRef.current && track.kind === Track.Kind.Video) {
          track.attach(remoteVideoRef.current);
          setVideoReady(true);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      })
      .on(RoomEvent.ParticipantConnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: prev.viewerCount + 1 } : prev);
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: Math.max(0, prev.viewerCount - 1) } : prev);
      });

    try {
      const tokenRes = await getLivekitToken({
        kind: "live",
        streamId: stream.id,
        roomName: `live:${stream.id}`,
      });

      await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });

      if (isHost) {
        await room.localParticipant.enableCameraAndMicrophone();
      } else {
        attachRemoteTrack(room);
      }

      setRtcState("connected");
    } catch (error) {
      setRtcState("error");
      setRtcError(error instanceof Error ? error.message : "No se pudo conectar al Live.");
      setVideoReady(false);
    }
  }, [attachRemoteTrack, isHost, myId, stream]);

  const handleJoin = useCallback(async () => {
    try {
      await apiFetch(`/live/${id}/join`, { method: "POST" });
      setJoined(true);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!myId || !stream?.isActive) return;
    if (!isHost && !joined) return;
    connectToLivekit();

    return () => {
      cleanupRoom().catch(() => {});
    };
  }, [myId, stream?.isActive, joined, isHost, connectToLivekit, cleanupRoom]);

  useEffect(() => {
    return () => {
      if (joined) {
        apiFetch(`/live/${id}/leave`, { method: "POST" }).catch(() => {});
      }
      cleanupRoom().catch(() => {});
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [joined, id, cleanupRoom]);

  useEffect(() => {
    if (!myId || (!joined && !isHost)) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;
      if (event.type === "live:chat" && data?.streamId === id) {
        setMessages((prev) => [...prev, {
          id: data.messageId,
          userId: data.userId,
          userName: data.userName,
          message: data.message,
          createdAt: data.createdAt,
        }]);
      }

      if (event.type === "live:ended" && data?.streamId === id) {
        setStream((s) => s ? { ...s, isActive: false } : null);
        cleanupRoom().catch(() => {});
      }

      if (event.type === "live:viewer_joined" && data?.streamId === id) {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }

      if (event.type === "live:viewer_left" && data?.streamId === id) {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }
    });

    return cleanup;
  }, [myId, joined, isHost, id, cleanupRoom]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    try {
      await apiFetch(`/live/${id}/chat`, { method: "POST", body: JSON.stringify({ message: chatInput.trim() }) });
      setMessages((prev) => [...prev, {
        id: `local-${Date.now()}`,
        userId: myId || "",
        userName: "Tú",
        message: chatInput.trim(),
        createdAt: new Date().toISOString(),
      }]);
      setChatInput("");
    } catch {}
  };

  const toggleMic = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    const enabled = !micOn;
    participant.setMicrophoneEnabled(enabled).catch(() => {});
    setMicOn(enabled);
  };

  const toggleCam = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    const enabled = !camOn;
    participant.setCameraEnabled(enabled).catch(() => {});
    setCamOn(enabled);
  };

  const endStream = async () => {
    await cleanupRoom();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    await apiFetch(`/live/${id}/end`, { method: "POST" }).catch(() => {});
    router.push("/");
  };

  useEffect(() => {
    if (!isHost || !stream?.isActive) return;

    const endLiveBestEffort = () => {
      const url = `${getApiBase().replace(/\/$/, "")}/live/${id}/end`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
        return;
      }
      fetch(url, { method: "POST", keepalive: true, credentials: "include" }).catch(() => {});
    };

    window.addEventListener("beforeunload", endLiveBestEffort);
    window.addEventListener("pagehide", endLiveBestEffort);

    return () => {
      endLiveBestEffort();
      window.removeEventListener("beforeunload", endLiveBestEffort);
      window.removeEventListener("pagehide", endLiveBestEffort);
    };
  }, [id, isHost, stream?.isActive]);

  if (!ageConfirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm rounded-3xl border border-red-500/20 bg-[#12131f] p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-xl font-bold text-white">Contenido para mayores de 18</h2>
          <p className="mb-6 text-sm text-white/50">Al continuar confirmas que eres mayor de edad y aceptas ver contenido para adultos.</p>
          <button onClick={() => setAgeConfirmed(true)} className="mb-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold text-white">
            Soy mayor de 18 años — Continuar
          </button>
          <button onClick={() => router.push("/")} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50">
            Volver
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/30">Cargando...</div>;
  if (!stream) return <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/30">Stream no encontrado</div>;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0a0b14] px-4 py-3">
        <div className="flex items-center gap-3">
          {stream.host.avatarUrl ? (
            <img src={resolveMediaUrl(stream.host.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{(stream.host.displayName || "?")[0]}</div>
          )}
          <div>
            <p className="text-sm font-semibold">{stream.host.displayName || stream.host.username}</p>
            {stream.title && <p className="text-[10px] text-white/40">{stream.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stream.isActive && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              LIVE
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-white/40">
            <Users className="h-3.5 w-3.5" /> {stream.viewerCount}/{stream.maxViewers}
          </div>
          <button onClick={isHost ? endStream : () => router.push("/")} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col lg:flex-row">
        <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-fuchsia-950/30 to-violet-950/30">
          {isHost && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${!videoReady ? "hidden" : ""}`}
              style={{ transform: "scaleX(-1)" }}
            />
          )}

          {!isHost && joined && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${!videoReady ? "hidden" : ""}`}
            />
          )}

          {stream.isActive && !videoReady && !isHost && !joined && (
            <div className="text-center">
              <Radio className="mx-auto mb-3 h-16 w-16 animate-pulse text-fuchsia-400/40" />
              <p className="text-sm text-white/30">Transmisión en vivo</p>
              <button onClick={handleJoin} className="mt-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold">
                Unirse al Live
              </button>
            </div>
          )}

          {stream.isActive && !videoReady && (isHost || joined) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-6">
                {isHost && needsManualPermission ? (
                  <div className="mx-auto max-w-xs space-y-4">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-fuchsia-500/20">
                      <VideoIcon className="h-10 w-10 text-fuchsia-400" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">Activar cámara y micrófono</p>
                    <p className="text-xs text-white/50">Tu navegador necesita que actives los permisos manualmente para iniciar el Live.</p>
                    <button
                      onClick={initHostMedia}
                      className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold text-white"
                    >
                      Activar cámara y micrófono
                    </button>
                    {mediaError && (
                      <p className="text-[11px] text-red-300">{mediaError}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <Radio className="mx-auto mb-3 h-12 w-12 animate-pulse text-fuchsia-400/30" />
                    <p className="text-xs text-white/30">Conectando video...</p>
                    {rtcError && <p className="mt-2 text-xs text-red-300">{rtcError}</p>}
                    {rtcState === "reconnecting" && <p className="mt-1 text-[11px] text-amber-300">Reconectando…</p>}
                    {isHost && mediaError && (
                      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left">
                        <p className="text-xs text-red-300">{mediaError}</p>
                        <button onClick={initHostMedia} className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20">
                          Reintentar permisos
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!stream.isActive && (
            <div className="text-center">
              <p className="text-lg font-semibold text-white/40">Live finalizado</p>
              <button onClick={() => router.push("/")} className="mt-3 text-sm text-fuchsia-400 underline">Volver al inicio</button>
            </div>
          )}

          {isHost && stream.isActive && (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
              <button onClick={toggleMic} className={`flex h-10 w-10 items-center justify-center rounded-full transition ${micOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"}`}>
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button onClick={toggleCam} className={`flex h-10 w-10 items-center justify-center rounded-full transition ${camOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"}`}>
                {camOn ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <button onClick={endStream} className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-500/30">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {(joined || isHost) && (
          <div className="flex w-full flex-col border-t border-white/[0.06] bg-[#0a0b14] lg:w-80 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
              <span className="text-xs font-semibold text-white/50">Chat en vivo</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2" style={{ maxHeight: "50vh" }}>
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                    <span className="text-[11px] font-semibold text-fuchsia-300">{msg.userName || "Anónimo"}: </span>
                    <span className="text-[11px] text-white/70">{msg.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 border-t border-white/[0.06] p-3">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Escribe un mensaje..."
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none"
              />
              <button onClick={sendChat} className="rounded-lg bg-fuchsia-600 p-2"><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
