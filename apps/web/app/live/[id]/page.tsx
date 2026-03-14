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
  Camera, Coins, Lock, Eye, Sparkles, Gift, Settings, Plus, Trash2,
  Clock, DollarSign, Maximize2, Minimize2, ChevronDown, ChevronUp,
} from "lucide-react";

/* ── Types ── */

type TipOption = {
  id: string;
  label: string;
  price: number;
  emoji: string | null;
};

type PrivateShowInfo = {
  id: string;
  buyerId: string;
  price: number;
  isActive: boolean;
};

type Stream = {
  id: string;
  title: string | null;
  isActive: boolean;
  viewerCount: number;
  maxViewers: number;
  privateShowPrice: number | null;
  totalTipsEarned: number;
  startedAt: string;
  host: { id: string; displayName: string; username: string; avatarUrl: string | null };
  messages: ChatMsg[];
  tipOptions?: TipOption[];
  privateShows?: PrivateShowInfo[];
};

type ChatMsg = {
  id: string;
  userId: string;
  userName?: string;
  message: string;
  createdAt: string;
  isTip?: boolean;
  tipAmount?: number;
  tipEmoji?: string | null;
};

type TipToast = {
  id: string;
  senderName: string;
  amount: number;
  message: string | null;
  optionLabel: string | null;
  optionEmoji: string | null;
};

type RtcState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

/* ── Tip Sound ── */
function playTipSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

/* ── Elapsed timer helper ── */
function useElapsed(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}

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

  // Tips
  const [tipOptions, setTipOptions] = useState<TipOption[]>([]);
  const [showTipPanel, setShowTipPanel] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [sendingTip, setSendingTip] = useState(false);
  const [tipToasts, setTipToasts] = useState<TipToast[]>([]);
  const [myBalance, setMyBalance] = useState<number | null>(null);

  // Private Show
  const [privateShow, setPrivateShow] = useState<PrivateShowInfo | null>(null);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateShowPrice, setPrivateShowPrice] = useState("");
  const [buyingPrivateShow, setBuyingPrivateShow] = useState(false);

  // Host panel
  const [hostPanelTab, setHostPanelTab] = useState<"chat" | "config" | "tips">("chat");
  const [newTipLabel, setNewTipLabel] = useState("");
  const [newTipPrice, setNewTipPrice] = useState("");
  const [newTipEmoji, setNewTipEmoji] = useState("");
  const [addingTipOption, setAddingTipOption] = useState(false);
  const [editPrivatePrice, setEditPrivatePrice] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Viewer: expanded video mode
  const [isExpanded, setIsExpanded] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);

  const myId = me?.user?.id;
  const elapsed = useElapsed(stream?.startedAt);

  // ── Load stream data ──
  useEffect(() => {
    apiFetch<{ stream: Stream }>(`/live/${id}`)
      .then((r) => {
        setStream(r.stream);
        setMessages(r.stream.messages?.reverse() || []);
        if (r.stream.tipOptions) setTipOptions(r.stream.tipOptions);
        const activeShow = r.stream.privateShows?.find((s) => s.isActive);
        if (activeShow) setPrivateShow(activeShow);
        if (r.stream.privateShowPrice) setEditPrivatePrice(String(r.stream.privateShowPrice));
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router]);

  // ── Load wallet balance ──
  useEffect(() => {
    if (!myId) return;
    apiFetch<{ balance: number }>("/wallet").then((r) => setMyBalance(r.balance)).catch(() => {});
  }, [myId]);

  const isHost = stream ? myId === stream.host.id : false;

  // ── Private show blur logic ──
  const isPrivateActive = Boolean(privateShow?.isActive);
  const amIBuyer = privateShow?.buyerId === myId;
  const shouldBlur = isPrivateActive && !isHost && !amIBuyer;

  // ── Host media init ──
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

  const isMobilePWA = typeof window !== "undefined" && (
    (window.matchMedia("(display-mode: standalone)").matches) ||
    ((window.navigator as any).standalone === true)
  );

  useEffect(() => {
    if (!isHost || !stream?.isActive) return;
    if (isMobilePWA) {
      setNeedsManualPermission(true);
      return;
    }
    initHostMedia();
  }, [isHost, stream?.isActive, initHostMedia, isMobilePWA]);

  // ── LiveKit connection ──
  const cleanupRoom = useCallback(async () => {
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      await roomRef.current.disconnect(true);
      roomRef.current = null;
    }
  }, []);

  const streamIdRef = useRef<string | null>(null);
  const streamActiveRef = useRef(false);
  useEffect(() => {
    streamIdRef.current = stream?.id ?? null;
    streamActiveRef.current = stream?.isActive ?? false;
  }, [stream?.id, stream?.isActive]);

  const isHostRef = useRef(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  const attachRemoteTrack = useCallback((room: Room) => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.isSubscribed && pub.track && pub.track.kind === Track.Kind.Video) {
          pub.track.attach(videoEl);
          setVideoReady(true);
          return;
        }
      }
    }
  }, []);

  const connectToLivekit = useCallback(async () => {
    const sId = streamIdRef.current;
    if (!sId || !myId || !streamActiveRef.current) return;

    setRtcError("");
    setRtcState("connecting");

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.Reconnecting, () => setRtcState("reconnecting"))
      .on(RoomEvent.Reconnected, () => setRtcState("connected"))
      .on(RoomEvent.Disconnected, () => {
        setRtcState("disconnected");
        if (!isHostRef.current) setVideoReady(false);
      })
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === "connected") setRtcState("connected");
        if (state === "connecting") setRtcState("connecting");
        if (state === "reconnecting") setRtcState("reconnecting");
        if (state === "disconnected") setRtcState("disconnected");
      })
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (!isHostRef.current && track.kind === Track.Kind.Video) {
          const tryAttach = () => {
            const videoEl = remoteVideoRef.current;
            if (videoEl) {
              track.attach(videoEl);
              setVideoReady(true);
            } else {
              requestAnimationFrame(tryAttach);
            }
          };
          tryAttach();
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); })
      .on(RoomEvent.ParticipantConnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: prev.viewerCount + 1 } : prev);
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: Math.max(0, prev.viewerCount - 1) } : prev);
      });

    try {
      const tokenRes = await getLivekitToken({ kind: "live", streamId: sId, roomName: `live:${sId}` });
      await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });

      if (isHostRef.current) {
        const localStream = localStreamRef.current;
        if (localStream) {
          for (const track of localStream.getTracks()) {
            await room.localParticipant.publishTrack(track, {
              simulcast: false,
              source: track.kind === "video" ? Track.Source.Camera : Track.Source.Microphone,
            });
          }
        } else {
          await room.localParticipant.enableCameraAndMicrophone();
        }
      } else {
        attachRemoteTrack(room);
      }
      setRtcState("connected");
    } catch (error) {
      setRtcState("error");
      setRtcError(error instanceof Error ? error.message : "No se pudo conectar al Live.");
      setVideoReady(false);
    }
  }, [attachRemoteTrack, myId]);

  const handleJoin = useCallback(async () => {
    try {
      await apiFetch(`/live/${id}/join`, { method: "POST" });
      setJoined(true);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!myId || !stream?.isActive) return;
    if (!isHost && !joined) return;
    if (isHost && !videoReady) return;
    connectToLivekit();
    return () => { cleanupRoom().catch(() => {}); };
  }, [myId, stream?.isActive, joined, isHost, videoReady, connectToLivekit, cleanupRoom]);

  useEffect(() => {
    return () => {
      if (joined) apiFetch(`/live/${id}/leave`, { method: "POST" }).catch(() => {});
      cleanupRoom().catch(() => {});
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [joined, id, cleanupRoom]);

  // ── SSE realtime events ──
  useEffect(() => {
    if (!myId || (!joined && !isHost)) return;

    const cleanup = connectRealtime(async (event) => {
      const data = event.data;
      if (!data || data.streamId !== id) return;

      if (event.type === "live:chat") {
        if (data.userId === myId) return;
        setMessages((prev) => [...prev, {
          id: data.messageId,
          userId: data.userId,
          userName: data.userName,
          message: data.message,
          createdAt: data.createdAt,
        }]);
      }

      if (event.type === "live:tip") {
        playTipSound();
        setMessages((prev) => [...prev, {
          id: `tip-${data.tipId}`,
          userId: data.senderId,
          userName: data.senderName,
          message: data.optionLabel
            ? `${data.optionEmoji || "🎁"} ${data.optionLabel} — ${data.amount} tokens${data.message ? ` "${data.message}"` : ""}`
            : `💰 Envió ${data.amount} tokens${data.message ? ` "${data.message}"` : ""}`,
          createdAt: data.createdAt,
          isTip: true,
          tipAmount: data.amount,
          tipEmoji: data.optionEmoji,
        }]);
        setTipToasts((prev) => [...prev, {
          id: data.tipId,
          senderName: data.senderName,
          amount: data.amount,
          message: data.message,
          optionLabel: data.optionLabel,
          optionEmoji: data.optionEmoji,
        }]);
        setTimeout(() => {
          setTipToasts((prev) => prev.filter((t) => t.id !== data.tipId));
        }, 4000);
        // Update total tips for host
        setStream((s) => s ? { ...s, totalTipsEarned: (s.totalTipsEarned || 0) + data.amount } : s);
      }

      if (event.type === "live:private_show_started") {
        setPrivateShow({ id: data.showId, buyerId: data.buyerId, price: data.price, isActive: true });
        setMessages((prev) => [...prev, {
          id: `private-${data.showId}`,
          userId: "system",
          userName: "Sistema",
          message: `🔒 Show Privado activado por ${data.buyerName} — ${data.price} tokens`,
          createdAt: new Date().toISOString(),
          isTip: true,
          tipAmount: data.price,
        }]);
        playTipSound();
      }

      if (event.type === "live:private_show_ended") {
        setPrivateShow(null);
        setMessages((prev) => [...prev, {
          id: `private-end-${data.showId}`,
          userId: "system",
          userName: "Sistema",
          message: "🔓 Show Privado finalizado — Transmisión pública",
          createdAt: new Date().toISOString(),
        }]);
      }

      if (event.type === "live:ended") {
        setStream((s) => s ? { ...s, isActive: false } : null);
        cleanupRoom().catch(() => {});
      }

      if (event.type === "live:viewer_joined") {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }

      if (event.type === "live:viewer_left") {
        setStream((s) => s ? { ...s, viewerCount: data.viewerCount } : null);
      }

      if (event.type === "live:tip_option_added") {
        setTipOptions((prev) => [...prev, data.option]);
      }

      if (event.type === "live:tip_option_removed") {
        setTipOptions((prev) => prev.filter((o) => o.id !== data.optionId));
      }

      if (event.type === "live:config_updated") {
        setStream((s) => s ? { ...s, title: data.title, privateShowPrice: data.privateShowPrice, maxViewers: data.maxViewers } : null);
      }
    });

    return cleanup;
  }, [myId, joined, isHost, id, cleanupRoom]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Chat ──
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, {
      id: `local-${Date.now()}`,
      userId: myId || "",
      userName: "Tú",
      message: msg,
      createdAt: new Date().toISOString(),
    }]);
    try {
      await apiFetch(`/live/${id}/chat`, { method: "POST", body: JSON.stringify({ message: msg }) });
    } catch {}
  };

  // ── Tips ──
  const sendTip = async (amount: number, optionId?: string) => {
    if (sendingTip || amount < 1) return;
    setSendingTip(true);
    try {
      const res = await apiFetch<{ tip: any; newBalance: number }>(`/live/${id}/tip`, {
        method: "POST",
        body: JSON.stringify({ amount, message: tipMessage.trim() || null, optionId: optionId || null }),
      });
      setMyBalance(res.newBalance);
      setTipMessage("");
      setCustomTipAmount("");
      setShowTipPanel(false);
    } catch (e: any) {
      const errMsg = e?.body?.error || e?.message || "Error";
      alert(errMsg);
    } finally {
      setSendingTip(false);
    }
  };

  // ── Private Show ──
  const buyPrivateShow = async () => {
    const price = stream?.privateShowPrice || parseInt(privateShowPrice, 10);
    if (!price || price < 1 || buyingPrivateShow) return;
    setBuyingPrivateShow(true);
    try {
      const res = await apiFetch<{ show: any; newBalance: number }>(`/live/${id}/private-show`, {
        method: "POST",
        body: JSON.stringify({ price }),
      });
      setMyBalance(res.newBalance);
      setShowPrivateModal(false);
      setPrivateShowPrice("");
    } catch (e: any) {
      alert(e?.body?.error || "Error al comprar show privado");
    } finally {
      setBuyingPrivateShow(false);
    }
  };

  const endPrivateShow = async () => {
    try {
      await apiFetch(`/live/${id}/private-show/end`, { method: "POST" });
    } catch {}
  };

  // ── Host controls ──
  const toggleMic = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    participant.setMicrophoneEnabled(!micOn).catch(() => {});
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    participant.setCameraEnabled(!camOn).catch(() => {});
    setCamOn(!camOn);
  };

  const endStream = async () => {
    await cleanupRoom();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    await apiFetch(`/live/${id}/end`, { method: "POST" }).catch(() => {});
    router.push("/");
  };

  // ── Host: add tip option on-the-fly ──
  const addTipOption = async () => {
    if (!newTipLabel.trim() || !newTipPrice || addingTipOption) return;
    setAddingTipOption(true);
    try {
      const res = await apiFetch<{ option: TipOption }>(`/live/${id}/tip-options/add`, {
        method: "POST",
        body: JSON.stringify({ label: newTipLabel.trim(), price: parseInt(newTipPrice, 10), emoji: newTipEmoji.trim() || null }),
      });
      setTipOptions((prev) => [...prev, res.option]);
      setNewTipLabel("");
      setNewTipPrice("");
      setNewTipEmoji("");
    } catch (e: any) {
      alert(e?.body?.error || "Error");
    } finally {
      setAddingTipOption(false);
    }
  };

  const removeTipOption = async (optionId: string) => {
    try {
      await apiFetch(`/live/${id}/tip-options/${optionId}`, { method: "DELETE" });
      setTipOptions((prev) => prev.filter((o) => o.id !== optionId));
    } catch {}
  };

  // ── Host: save stream config ──
  const saveStreamConfig = async () => {
    setSavingConfig(true);
    try {
      const price = parseInt(editPrivatePrice, 10);
      await apiFetch(`/live/${id}/config`, {
        method: "PUT",
        body: JSON.stringify({ privateShowPrice: price > 0 ? price : null }),
      });
      setStream((s) => s ? { ...s, privateShowPrice: price > 0 ? price : null } : s);
    } catch {}
    setSavingConfig(false);
  };

  useEffect(() => {
    if (!isHost || !stream?.isActive) return;
    const endLiveBestEffort = () => {
      const url = `${getApiBase().replace(/\/$/, "")}/live/${id}/end`;
      if (navigator.sendBeacon) { navigator.sendBeacon(url); return; }
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

  // ── Age gate ──
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
          <button onClick={() => router.push("/")} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50">Volver</button>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/30">Cargando...</div>;
  if (!stream) return <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/30">Stream no encontrado</div>;

  /* ═══════════════════════════════════════════════
     HOST VIEW — Professional Control Panel
     ═══════════════════════════════════════════════ */
  if (isHost) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0b14] text-white">
        {/* ── Host Top Bar ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30">
              <Radio className="h-5 w-5 text-fuchsia-300" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Panel de Transmisión</h1>
              <p className="text-[10px] text-white/40">{stream.title || "Sin título"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stream.isActive && (
              <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                EN VIVO
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" /> {elapsed}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          {/* ── Video Preview (smaller for host) ── */}
          <div className="relative flex aspect-video max-h-[40vh] items-center justify-center bg-black lg:max-h-none lg:flex-1">
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              className={`h-full w-full object-cover ${!videoReady ? "hidden" : ""}`}
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Camera permission button */}
            {stream.isActive && !videoReady && needsManualPermission && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="mx-auto max-w-xs space-y-4">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-fuchsia-500/20">
                      <Camera className="h-10 w-10 text-fuchsia-400" />
                    </div>
                    <p className="text-sm font-semibold text-white/80">Iniciar cámara y micrófono</p>
                    <button onClick={initHostMedia} className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-4 text-base font-semibold text-white active:scale-95 transition-transform">
                      Activar cámara y micrófono
                    </button>
                    {mediaError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3"><p className="text-[11px] text-red-300">{mediaError}</p></div>}
                  </div>
                </div>
              </div>
            )}

            {stream.isActive && !videoReady && !needsManualPermission && (
              <div className="text-center px-6">
                <Radio className="mx-auto mb-3 h-12 w-12 animate-pulse text-fuchsia-400/30" />
                <p className="text-xs text-white/30">Conectando video...</p>
                {rtcError && <p className="mt-2 text-xs text-red-300">{rtcError}</p>}
              </div>
            )}

            {!stream.isActive && (
              <div className="text-center">
                <p className="text-lg font-semibold text-white/40">Live finalizado</p>
                <button onClick={() => router.push("/")} className="mt-3 text-sm text-fuchsia-400 underline">Volver al inicio</button>
              </div>
            )}

            {/* ── Tip toasts ── */}
            <div className="pointer-events-none absolute left-4 top-4 z-30 space-y-2">
              <AnimatePresence>
                {tipToasts.map((toast) => (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, x: -40, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.8 }}
                    className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-black/70 px-4 py-2.5 backdrop-blur-sm"
                  >
                    <span className="text-lg">{toast.optionEmoji || "💰"}</span>
                    <div>
                      <p className="text-xs font-bold text-amber-300">
                        {toast.senderName} envió {toast.amount} tokens
                      </p>
                      {toast.optionLabel && <p className="text-[10px] text-white/60">{toast.optionLabel}</p>}
                      {toast.message && <p className="text-[10px] text-white/50 italic">&quot;{toast.message}&quot;</p>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* ── Host media controls overlay ── */}
            {stream.isActive && videoReady && (
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
                <button onClick={toggleMic} className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${micOn ? "bg-white/20 text-white backdrop-blur" : "bg-red-500/90 text-white"}`}>
                  {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button onClick={toggleCam} className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${camOn ? "bg-white/20 text-white backdrop-blur" : "bg-red-500/90 text-white"}`}>
                  {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
              </div>
            )}
          </div>

          {/* ── Host Sidebar Panel ── */}
          <div className="flex w-full flex-col border-t border-white/[0.06] lg:w-96 lg:border-l lg:border-t-0">
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-px border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex flex-col items-center py-3">
                <div className="flex items-center gap-1 text-lg font-bold text-fuchsia-300">
                  <Users className="h-4 w-4" /> {stream.viewerCount}
                </div>
                <span className="text-[9px] text-white/30">Espectadores</span>
              </div>
              <div className="flex flex-col items-center py-3">
                <div className="flex items-center gap-1 text-lg font-bold text-amber-300">
                  <Coins className="h-4 w-4" /> {stream.totalTipsEarned || 0}
                </div>
                <span className="text-[9px] text-white/30">Tokens recibidos</span>
              </div>
              <div className="flex flex-col items-center py-3">
                <div className="flex items-center gap-1 text-lg font-bold text-emerald-300">
                  <Clock className="h-4 w-4" /> {elapsed}
                </div>
                <span className="text-[9px] text-white/30">Duración</span>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-white/[0.06]">
              {(["chat", "tips", "config"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setHostPanelTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold transition ${
                    hostPanelTab === tab
                      ? "border-b-2 border-fuchsia-500 text-fuchsia-300"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab === "chat" ? "Chat" : tab === "tips" ? "Tipos de Propina" : "Configuración"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* ── CHAT TAB ── */}
              {hostPanelTab === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin" style={{ maxHeight: "50vh" }}>
                    {messages.length === 0 && (
                      <p className="py-8 text-center text-xs text-white/20">Sin mensajes aún</p>
                    )}
                    <AnimatePresence initial={false}>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mb-2 rounded-xl px-3 py-1.5 ${
                            msg.isTip
                              ? "border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10"
                              : msg.userId === myId
                                ? "bg-fuchsia-500/10"
                                : ""
                          }`}
                        >
                          <span className={`text-[11px] font-semibold ${
                            msg.isTip ? "text-amber-300" : msg.userId === myId ? "text-fuchsia-300" : "text-violet-300"
                          }`}>
                            {msg.userId === myId ? "Tú" : msg.userName || "Anónimo"}
                          </span>
                          <span className="text-[11px] text-white/60">: </span>
                          <span className={`text-[11px] ${msg.isTip ? "text-amber-200/80 font-medium" : "text-white/70"}`}>
                            {msg.message}
                          </span>
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
                      maxLength={300}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                    />
                    <button onClick={sendChat} disabled={!chatInput.trim()} className="rounded-xl bg-fuchsia-600 px-3 py-2.5 transition hover:bg-fuchsia-500 disabled:opacity-30">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}

              {/* ── TIPS TAB — manage custom tip options ── */}
              {hostPanelTab === "tips" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-white/60">Tus tipos de propina</h3>
                    <p className="mb-3 text-[10px] text-white/30">Los espectadores verán estas opciones y podrán enviarte tokens por cada una.</p>
                  </div>

                  {/* Existing tip options */}
                  {tipOptions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
                      <Gift className="mx-auto mb-2 h-8 w-8 text-white/15" />
                      <p className="text-[11px] text-white/30">No tienes tipos de propina configurados.</p>
                      <p className="text-[10px] text-white/20">Agrega opciones personalizadas abajo.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {tipOptions.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                        <span className="text-xl">{opt.emoji || "🎁"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/80 truncate">{opt.label}</p>
                          <p className="text-[10px] text-amber-300">{opt.price} tokens</p>
                        </div>
                        <button
                          onClick={() => removeTipOption(opt.id)}
                          className="rounded-lg p-2 text-white/30 transition hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add new tip option */}
                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-fuchsia-300">Agregar tipo de propina</h4>
                    <div className="flex gap-2">
                      <input
                        value={newTipEmoji}
                        onChange={(e) => setNewTipEmoji(e.target.value)}
                        placeholder="🎁"
                        maxLength={4}
                        className="w-12 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-center text-sm outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                      />
                      <input
                        value={newTipLabel}
                        onChange={(e) => setNewTipLabel(e.target.value)}
                        placeholder="Ej: Bailo para ti"
                        maxLength={50}
                        className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={newTipPrice}
                          onChange={(e) => setNewTipPrice(e.target.value)}
                          placeholder="Precio en tokens"
                          min="1"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                        />
                      </div>
                      <button
                        onClick={addTipOption}
                        disabled={addingTipOption || !newTipLabel.trim() || !newTipPrice}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-600 px-4 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {addingTipOption ? "..." : "Agregar"}
                      </button>
                    </div>
                    <p className="text-[9px] text-white/25">Ejemplos: &quot;20 tokens - Bailo&quot;, &quot;50 tokens - Canción dedicada&quot;, &quot;100 tokens - Show especial&quot;</p>
                  </div>
                </div>
              )}

              {/* ── CONFIG TAB ── */}
              {hostPanelTab === "config" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {/* Private show price */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-300" />
                      <h4 className="text-xs font-semibold text-amber-300">Precio Show Privado</h4>
                    </div>
                    <p className="text-[10px] text-white/40">
                      Define cuántos tokens cuesta un show privado. Si lo dejas vacío, el cliente define el monto.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editPrivatePrice}
                        onChange={(e) => setEditPrivatePrice(e.target.value)}
                        placeholder="Ej: 200"
                        min="1"
                        className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs outline-none placeholder:text-white/25 focus:border-amber-500/30"
                      />
                      <button
                        onClick={saveStreamConfig}
                        disabled={savingConfig}
                        className="rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                      >
                        {savingConfig ? "..." : "Guardar"}
                      </button>
                    </div>
                    {stream.privateShowPrice && (
                      <p className="text-[10px] text-amber-300/60">Precio actual: {stream.privateShowPrice} tokens</p>
                    )}
                  </div>

                  {/* Private show control */}
                  {isPrivateActive && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-amber-300" />
                          <span className="text-xs font-semibold text-amber-300">Show Privado Activo</span>
                        </div>
                        <button
                          onClick={endPrivateShow}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-amber-500"
                        >
                          <Eye className="h-3 w-3" /> Finalizar Privado
                        </button>
                      </div>
                    </div>
                  )}

                  {/* End stream */}
                  {stream.isActive && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-red-300">Finalizar Transmisión</h4>
                      <p className="text-[10px] text-white/40">
                        Esto terminará la transmisión para todos los espectadores.
                      </p>
                      <button
                        onClick={endStream}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                      >
                        <X className="h-4 w-4" />
                        Finalizar Live
                      </button>
                    </div>
                  )}

                  {/* Stream info */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-white/50">Info del Stream</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="text-white/30">Máx. espectadores:</div>
                      <div className="text-white/60">{stream.maxViewers}</div>
                      <div className="text-white/30">Iniciado:</div>
                      <div className="text-white/60">{new Date(stream.startedAt).toLocaleTimeString()}</div>
                      <div className="text-white/30">Estado RTC:</div>
                      <div className={`font-mono ${rtcState === "connected" ? "text-emerald-400" : rtcState === "error" ? "text-red-400" : "text-amber-400"}`}>
                        {rtcState}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     VIEWER VIEW — with expandable video + transparent overlay
     ═══════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* ── Viewer Header (hides in expanded mode) ── */}
      {!isExpanded && (
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
          <div className="flex items-center gap-2">
            {stream.isActive && (
              <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                LIVE
              </div>
            )}
            {isPrivateActive && (
              <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">
                <Lock className="h-3 w-3" />
                PRIVADO
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-white/40">
              <Users className="h-3.5 w-3.5" /> {stream.viewerCount}
            </div>
            {myBalance !== null && (
              <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                <Coins className="h-3 w-3" /> {myBalance}
              </div>
            )}
            <button onClick={() => router.push("/")} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className={`relative flex flex-1 ${isExpanded ? "flex-col" : "flex-col lg:flex-row"}`}>
        {/* ── Video Area ── */}
        <div className={`relative flex items-center justify-center bg-gradient-to-br from-fuchsia-950/30 to-violet-950/30 ${
          isExpanded ? "fixed inset-0 z-40" : "flex-1 aspect-video lg:aspect-auto"
        }`}>
          {/* Remote video */}
          {joined && (
            <video
              ref={remoteVideoRef}
              autoPlay playsInline
              className={`h-full w-full object-contain transition-all duration-500 ${!videoReady ? "hidden" : ""} ${shouldBlur ? "blur-xl scale-105" : ""}`}
            />
          )}

          {/* Private show blur overlay */}
          {shouldBlur && videoReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="text-center px-6">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20">
                  <Lock className="h-10 w-10 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-white">Show Privado en curso</p>
                <p className="mt-2 text-sm text-white/50">
                  Este contenido es exclusivo. Compra tu propio show privado cuando termine.
                </p>
              </div>
            </div>
          )}

          {/* Join button */}
          {stream.isActive && !videoReady && !joined && (
            <div className="text-center">
              <Radio className="mx-auto mb-3 h-16 w-16 animate-pulse text-fuchsia-400/40" />
              <p className="text-sm text-white/30">Transmisión en vivo</p>
              <button onClick={handleJoin} className="mt-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold active:scale-95 transition-transform">
                Unirse al Live
              </button>
            </div>
          )}

          {/* Viewer connecting state */}
          {stream.isActive && !videoReady && joined && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-6">
                <Radio className="mx-auto mb-3 h-12 w-12 animate-pulse text-fuchsia-400/30" />
                <p className="text-xs text-white/30">Conectando al live...</p>
                {rtcError && <p className="mt-2 text-xs text-red-300">{rtcError}</p>}
              </div>
            </div>
          )}

          {/* Stream ended */}
          {!stream.isActive && (
            <div className="text-center">
              <p className="text-lg font-semibold text-white/40">Live finalizado</p>
              <button onClick={() => router.push("/")} className="mt-3 text-sm text-fuchsia-400 underline">Volver al inicio</button>
            </div>
          )}

          {/* ── Tip toasts ── */}
          <div className="pointer-events-none absolute left-4 top-4 z-30 space-y-2">
            <AnimatePresence>
              {tipToasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, x: -40, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.8 }}
                  className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-black/70 px-4 py-2.5 backdrop-blur-sm"
                >
                  <span className="text-lg">{toast.optionEmoji || "💰"}</span>
                  <div>
                    <p className="text-xs font-bold text-amber-300">
                      {toast.senderName} envió {toast.amount} tokens
                    </p>
                    {toast.optionLabel && <p className="text-[10px] text-white/60">{toast.optionLabel}</p>}
                    {toast.message && <p className="text-[10px] text-white/50 italic">&quot;{toast.message}&quot;</p>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* ── Expand/Minimize button ── */}
          {joined && videoReady && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          {/* ── Expanded mode: transparent chat overlay ── */}
          {isExpanded && joined && (
            <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col" style={{ maxHeight: "60%" }}>
              {/* Transparent gradient fade */}
              <div className="h-8 bg-gradient-to-b from-transparent to-black/40" />

              {/* Transparent chat + controls */}
              <div className="flex flex-col bg-black/40 backdrop-blur-sm">
                {/* Top controls bar in expanded */}
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2">
                    {stream.host.avatarUrl ? (
                      <img src={resolveMediaUrl(stream.host.avatarUrl) ?? undefined} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">{(stream.host.displayName || "?")[0]}</div>
                    )}
                    <span className="text-xs font-semibold text-white/80">{stream.host.displayName || stream.host.username}</span>
                    <div className="flex items-center gap-1 text-[10px] text-white/40">
                      <Users className="h-3 w-3" /> {stream.viewerCount}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {myBalance !== null && (
                      <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Coins className="h-3 w-3" /> {myBalance}
                      </div>
                    )}
                    {stream.isActive && (
                      <>
                        <button
                          onClick={() => setShowPrivateModal(true)}
                          className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                        >
                          <Lock className="h-3 w-3" /> Privado
                        </button>
                        <button
                          onClick={() => setShowTipPanel(!showTipPanel)}
                          className="flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
                        >
                          <Gift className="h-3 w-3" /> Propina
                        </button>
                      </>
                    )}
                    <button onClick={() => router.push("/")} className="rounded-lg p-1 text-white/40 hover:text-white/60">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Tip options in expanded mode */}
                <AnimatePresence>
                  {showTipPanel && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-2 space-y-2">
                        {tipOptions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {tipOptions.map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => sendTip(opt.price, opt.id)}
                                disabled={sendingTip}
                                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-semibold transition hover:border-fuchsia-500/30 disabled:opacity-40"
                              >
                                <span>{opt.emoji || "🎁"}</span>
                                <span className="text-white/80">{opt.label}</span>
                                <span className="text-amber-300">{opt.price}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          {[5, 10, 25, 50, 100].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => sendTip(amt)}
                              disabled={sendingTip}
                              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat messages (transparent, scrollable) */}
                <div className="max-h-[25vh] overflow-y-auto px-4 py-1 scrollbar-thin">
                  {messages.slice(-20).map((msg) => (
                    <div key={msg.id} className="mb-1">
                      <span className={`text-[11px] font-semibold ${
                        msg.isTip ? "text-amber-300" : msg.userId === myId ? "text-fuchsia-300" : "text-violet-300"
                      }`}>
                        {msg.userId === myId ? "Tú" : msg.userName || "Anónimo"}
                      </span>
                      <span className="text-[11px] text-white/50">: </span>
                      <span className={`text-[11px] ${msg.isTip ? "text-amber-200/80" : "text-white/60"}`}>
                        {msg.message}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input (transparent) */}
                <div className="flex gap-2 px-4 pb-4 pt-1">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Escribe un mensaje..."
                    maxLength={300}
                    className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-fuchsia-500/30 backdrop-blur"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim()} className="rounded-full bg-fuchsia-600/80 px-3 py-2 backdrop-blur transition hover:bg-fuchsia-500 disabled:opacity-30">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Chat + Tips (normal mode only) ── */}
        {!isExpanded && (joined || isHost) && (
          <div className="flex w-full flex-col border-t border-white/[0.06] bg-[#0a0b14] lg:w-80 lg:border-l lg:border-t-0">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="text-xs font-semibold text-white/50">Chat en vivo</span>
              {stream.isActive && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowPrivateModal(true)}
                    className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <Lock className="h-3 w-3" /> {stream.privateShowPrice ? `Privado ${stream.privateShowPrice}tk` : "Privado"}
                  </button>
                  <button
                    onClick={() => setShowTipPanel(!showTipPanel)}
                    className="flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
                  >
                    <Gift className="h-3 w-3" /> Propina
                  </button>
                </div>
              )}
            </div>

            {/* Tip panel (expandable) */}
            <AnimatePresence>
              {showTipPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/[0.06]"
                >
                  <div className="p-3 space-y-3">
                    {/* Quick tip options from the host */}
                    {tipOptions.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {tipOptions.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => sendTip(opt.price, opt.id)}
                            disabled={sendingTip}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 disabled:opacity-40"
                          >
                            <span className="text-lg">{opt.emoji || "🎁"}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-white/80">{opt.label}</p>
                              <p className="text-[10px] text-amber-300">{opt.price} tokens</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom amount */}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={customTipAmount}
                        onChange={(e) => setCustomTipAmount(e.target.value)}
                        placeholder="Cantidad"
                        min="1"
                        className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                      />
                      <input
                        value={tipMessage}
                        onChange={(e) => setTipMessage(e.target.value)}
                        placeholder="Mensaje (opcional)"
                        maxLength={200}
                        className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                      />
                    </div>
                    <button
                      onClick={() => sendTip(parseInt(customTipAmount, 10) || 0)}
                      disabled={sendingTip || !customTipAmount || parseInt(customTipAmount, 10) < 1}
                      className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-xs font-semibold text-white transition disabled:opacity-40"
                    >
                      {sendingTip ? "Enviando..." : `Enviar ${customTipAmount || "0"} tokens`}
                    </button>

                    {/* Quick amounts */}
                    <div className="flex gap-2">
                      {[5, 10, 25, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => sendTip(amt)}
                          disabled={sendingTip}
                          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin" style={{ maxHeight: "50vh" }}>
              {messages.length === 0 && (
                <p className="py-8 text-center text-xs text-white/20">Sin mensajes aún</p>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-2 rounded-xl px-3 py-1.5 ${
                      msg.isTip
                        ? "border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10"
                        : msg.userId === myId
                          ? "bg-fuchsia-500/10"
                          : ""
                    }`}
                  >
                    <span className={`text-[11px] font-semibold ${
                      msg.isTip ? "text-amber-300" : msg.userId === myId ? "text-fuchsia-300" : "text-violet-300"
                    }`}>
                      {msg.userId === myId ? "Tú" : msg.userName || "Anónimo"}
                    </span>
                    <span className="text-[11px] text-white/60">: </span>
                    <span className={`text-[11px] ${msg.isTip ? "text-amber-200/80 font-medium" : "text-white/70"}`}>
                      {msg.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex gap-2 border-t border-white/[0.06] p-3">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Escribe un mensaje..."
                maxLength={300}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
              />
              <button onClick={sendChat} disabled={!chatInput.trim()} className="rounded-xl bg-fuchsia-600 px-3 py-2.5 transition hover:bg-fuchsia-500 disabled:opacity-30">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Private Show Purchase Modal ── */}
      <AnimatePresence>
        {showPrivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPrivateModal(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#12131f] p-6 shadow-2xl sm:rounded-3xl"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30">
                  <Sparkles className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Show Privado</h3>
                  <p className="text-xs text-white/40">Contenido exclusivo solo para ti</p>
                </div>
              </div>

              <p className="mb-4 text-xs text-white/50">
                Al activar el show privado, los demás espectadores verán la transmisión con blur.
                Solo tú podrás ver el contenido en HD.
              </p>

              {stream.privateShowPrice ? (
                /* Host has a fixed price */
                <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-center">
                  <p className="text-sm text-white/60">Precio del show privado</p>
                  <p className="mt-1 text-2xl font-bold text-amber-300">{stream.privateShowPrice} tokens</p>
                  {myBalance !== null && (
                    <p className="mt-1 text-[10px] text-white/30">Tu saldo: {myBalance} tokens</p>
                  )}
                </div>
              ) : (
                /* No fixed price, buyer chooses */
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs text-white/50">Cantidad de tokens</label>
                  <input
                    type="number"
                    value={privateShowPrice}
                    onChange={(e) => setPrivateShowPrice(e.target.value)}
                    placeholder="Ej: 100"
                    min="1"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-amber-500/30"
                  />
                  {myBalance !== null && (
                    <p className="mt-1.5 text-[10px] text-white/30">Tu saldo: {myBalance} tokens</p>
                  )}
                </div>
              )}

              <button
                onClick={buyPrivateShow}
                disabled={buyingPrivateShow || (!stream.privateShowPrice && (!privateShowPrice || parseInt(privateShowPrice, 10) < 1))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              >
                <Lock className="h-4 w-4" />
                {buyingPrivateShow ? "Procesando..." : `Comprar Show Privado — ${stream.privateShowPrice || privateShowPrice || "0"} tokens`}
              </button>

              <button
                onClick={() => setShowPrivateModal(false)}
                className="mt-3 w-full py-2 text-center text-xs text-white/40 hover:text-white/60"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
