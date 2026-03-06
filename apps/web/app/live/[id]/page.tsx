"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { connectRealtime } from "../../../lib/realtime";
import { WebRTCPeer, getLocalMedia } from "../../../lib/webrtc";
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
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, WebRTCPeer>>(new Map());

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

  // Host: start camera when page loads
  useEffect(() => {
    if (!isHost || !stream?.isActive) return;
    (async () => {
      try {
        const media = await getLocalMedia({ video: true, audio: true });
        localStreamRef.current = media;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
        }
        setVideoReady(true);
      } catch {
        // Camera access denied — still show page
      }
    })();
  }, [isHost, stream?.isActive]);

  // Join stream
  const handleJoin = useCallback(async () => {
    try {
      await apiFetch(`/live/${id}/join`, { method: "POST" });
      setJoined(true);
    } catch {}
  }, [id]);

  // Leave on unmount
  useEffect(() => {
    return () => {
      if (joined) {
        apiFetch(`/live/${id}/leave`, { method: "POST" }).catch(() => {});
      }
      // Cleanup all peers
      for (const peer of peersRef.current.values()) {
        peer.close();
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [joined, id]);

  // SSE for live chat + WebRTC signaling
  useEffect(() => {
    if (!myId || (!joined && !isHost)) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;

      // Chat messages
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
        for (const peer of peersRef.current.values()) peer.close();
        peersRef.current.clear();
      }

      if (event.type === "live:viewer_joined" && data?.streamId === id) {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }

      if (event.type === "live:viewer_left" && data?.streamId === id) {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }

      // WebRTC signaling
      if (!data?.fromUserId) return;
      if (data.streamId && data.streamId !== id) return;

      // Host receives offer from viewer (shouldn't happen in our flow)
      // Viewer receives offer from host
      if (event.type === "signal:offer" && !isHost) {
        // Viewer: create peer, handle offer from host
        const peer = new WebRTCPeer(data.fromUserId, {
          onRemoteStream: (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            setVideoReady(true);
          },
        }, { streamId: id });

        peersRef.current.set(data.fromUserId, peer);
        await peer.handleOffer(data.sdp);
      }

      // Host receives answer from viewer
      if (event.type === "signal:answer" && isHost) {
        const peer = peersRef.current.get(data.fromUserId);
        if (peer) {
          await peer.handleAnswer(data.sdp);
        }
      }

      if (event.type === "signal:ice") {
        const peer = peersRef.current.get(data.fromUserId);
        if (peer) {
          await peer.handleIceCandidate(data.candidate);
        }
      }

      // Host: when a viewer joins, send them an offer with the local stream
      if (event.type === "live:viewer_joined" && isHost && data?.streamId === id && localStreamRef.current) {
        // We need the viewer's userId — but the event doesn't include it directly.
        // The viewer will request the stream by sending a signal:offer to the host.
        // Actually, let's use a different approach: the viewer sends a "request" via
        // a POST, and the host initiates the offer.
      }
    });

    return cleanup;
  }, [myId, joined, isHost, id]);

  // Viewer: after joining, request stream from host by sending a signal offer
  useEffect(() => {
    if (!joined || isHost || !stream?.host.id || !myId) return;

    // Request the host to send us their stream
    // We create a peer and send an offer; host will answer
    const requestStream = async () => {
      const peer = new WebRTCPeer(stream.host.id, {
        onRemoteStream: (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          setVideoReady(true);
        },
      }, { streamId: id });

      // Add a receive-only transceiver so the host knows we want video
      peer.pc.addTransceiver("video", { direction: "recvonly" });
      peer.pc.addTransceiver("audio", { direction: "recvonly" });

      peersRef.current.set(stream.host.id, peer);
      await peer.createOffer();
    };

    requestStream();
  }, [joined, isHost, stream?.host.id, myId, id]);

  // Host: when receiving an offer from a viewer, add local tracks and answer
  useEffect(() => {
    if (!isHost || !myId) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;
      if (event.type !== "signal:offer" || !data?.fromUserId) return;
      if (data.streamId && data.streamId !== id) return;

      // Host: create peer for this viewer, add local stream, handle their offer
      const viewerId = data.fromUserId;
      const existingPeer = peersRef.current.get(viewerId);
      if (existingPeer) existingPeer.close();

      const peer = new WebRTCPeer(viewerId, {}, { streamId: id });

      if (localStreamRef.current) {
        peer.addStream(localStreamRef.current);
      }

      peersRef.current.set(viewerId, peer);
      await peer.handleOffer(data.sdp);
    });

    return cleanup;
  }, [isHost, myId, id]);

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
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const endStream = async () => {
    for (const peer of peersRef.current.values()) peer.close();
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    await apiFetch(`/live/${id}/end`, { method: "POST" }).catch(() => {});
    router.push("/");
  };

  // Age gate
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
      {/* Stream header */}
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
          <button onClick={() => router.push("/")} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stream area */}
      <div className="relative flex flex-1 flex-col lg:flex-row">
        {/* Video area */}
        <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-fuchsia-950/30 to-violet-950/30">
          {/* Host: show local video */}
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

          {/* Viewer: show remote video from host */}
          {!isHost && joined && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${!videoReady ? "hidden" : ""}`}
            />
          )}

          {/* Fallback states */}
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
              <div className="text-center">
                <Radio className="mx-auto mb-3 h-12 w-12 animate-pulse text-fuchsia-400/30" />
                <p className="text-xs text-white/30">Conectando video...</p>
              </div>
            </div>
          )}

          {!stream.isActive && (
            <div className="text-center">
              <p className="text-lg font-semibold text-white/40">Live finalizado</p>
              <button onClick={() => router.push("/")} className="mt-3 text-sm text-fuchsia-400 underline">Volver al inicio</button>
            </div>
          )}

          {/* Host controls overlay */}
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

        {/* Chat panel */}
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
