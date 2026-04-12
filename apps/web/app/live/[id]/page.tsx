"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl, getApiBase } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { connectRealtime } from "../../../lib/realtime";
import { getLocalMedia, ICE_SERVERS, ICE_SERVERS_RELAY, isMobileDevice } from "../../../lib/webrtc";
import { getLivekitToken } from "../../../lib/livekit";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Radio, Users, Send, X, ShieldAlert, Mic, MicOff, VideoIcon, VideoOff,
  Camera, Coins, Lock, Eye, EyeOff, Sparkles, Gift, Settings, Plus, Trash2,
  Clock, DollarSign, Maximize2, Minimize2, ChevronDown, ChevronUp, MessageCircle, LogIn,
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
  const [hasJoinedPrivateShow, setHasJoinedPrivateShow] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
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
  const [showChat, setShowChat] = useState(true);

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
        if (myId) setHasJoinedPrivateShow(Boolean(r.stream.privateShows?.some((s) => s.isActive && s.buyerId === myId)));
        if (r.stream.privateShowPrice) setEditPrivatePrice(String(r.stream.privateShowPrice));
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router, myId]);

  // ── Load wallet balance ──
  useEffect(() => {
    if (!myId) return;
    apiFetch<{ balance: number }>("/wallet").then((r) => setMyBalance(r.balance)).catch(() => {});
  }, [myId]);

  const isHost = stream ? myId === stream.host.id : false;

  // ── Private show blur logic ──
  const isPrivateActive = Boolean(privateShow?.isActive);
  const shouldBlur = isPrivateActive && !isHost && !hasJoinedPrivateShow;

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
    attachedTracksRef.current.clear();
  }, []);

  const streamIdRef = useRef<string | null>(null);
  const streamActiveRef = useRef(false);
  useEffect(() => {
    streamIdRef.current = stream?.id ?? null;
    streamActiveRef.current = stream?.isActive ?? false;
  }, [stream?.id, stream?.isActive]);

  const isHostRef = useRef(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  const attachedTracksRef = useRef<Set<string>>(new Set());

  const attachRemoteTrack = useCallback((room: Room) => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.isSubscribed && pub.track) {
          const trackId = pub.track.sid ?? pub.trackSid;
          if (attachedTracksRef.current.has(trackId)) continue;
          attachedTracksRef.current.add(trackId);
          if (pub.track.kind === Track.Kind.Video) {
            pub.track.attach(videoEl);
            setVideoReady(true);
          } else if (pub.track.kind === Track.Kind.Audio) {
            pub.track.attach();
          }
        }
      }
    }
  }, []);

  const connectAttemptRef = useRef(0);

  const connectToLivekit = useCallback(async (forceRelay = false) => {
    const sId = streamIdRef.current;
    if (!sId || !myId || !streamActiveRef.current) return;

    // Clean up any previous room before reconnecting
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      await roomRef.current.disconnect(true).catch(() => {});
      roomRef.current = null;
      attachedTracksRef.current.clear();
    }

    setRtcError("");
    setRtcState("connecting");

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
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
        if (!isHostRef.current) {
          const trackId = track.sid ?? (track as any).mediaStreamID ?? `${track.kind}-${Date.now()}`;
          if (attachedTracksRef.current.has(trackId)) return;
          attachedTracksRef.current.add(trackId);
          if (track.kind === Track.Kind.Video) {
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
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        const trackId = track.sid ?? (track as any).mediaStreamID ?? `${track.kind}-${Date.now()}`;
        attachedTracksRef.current.delete(trackId);
        track.detach();
      })
      .on(RoomEvent.ParticipantConnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: prev.viewerCount + 1 } : prev);
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        setStream((prev) => prev ? { ...prev, viewerCount: Math.max(0, prev.viewerCount - 1) } : prev);
      });

    const mobile = isMobileDevice();
    const useRelay = forceRelay || (mobile && connectAttemptRef.current > 0);
    const rtcConfig = useRelay ? ICE_SERVERS_RELAY : { iceServers: ICE_SERVERS };

    try {
      const tokenRes = await getLivekitToken({ kind: "live", streamId: sId, roomName: `live:${sId}` });
      await room.connect(tokenRes.url, tokenRes.token, {
        autoSubscribe: true,
        rtcConfig,
      });

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
      connectAttemptRef.current = 0;
    } catch (error) {
      connectAttemptRef.current += 1;

      // On mobile, auto-retry once with relay-only (forces TURN)
      if (mobile && connectAttemptRef.current === 1 && !forceRelay) {
        room.removeAllListeners();
        await room.disconnect(true).catch(() => {});
        roomRef.current = null;
        attachedTracksRef.current.clear();
        connectToLivekit(true);
        return;
      }

      setRtcState("error");
      setRtcError(
        mobile
          ? "No se pudo conectar. Verifica tu conexión a internet e intenta de nuevo."
          : error instanceof Error ? error.message : "No se pudo conectar al Live.",
      );
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

  // ── Auto-reconnect on network change (mobile WiFi ↔ cellular) ──
  useEffect(() => {
    if (!isMobileDevice()) return;
    const shouldReconnect = () => {
      if (!streamActiveRef.current) return;
      const room = roomRef.current;
      const isConnected = room && room.state === "connected";
      if (!isConnected && (rtcState === "error" || rtcState === "disconnected")) {
        connectAttemptRef.current = 0;
        connectToLivekit();
      }
    };
    window.addEventListener("online", shouldReconnect);
    return () => window.removeEventListener("online", shouldReconnect);
  }, [connectToLivekit, rtcState]);

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
            ? `${data.optionLabel} — ${data.amount} tokens${data.message ? ` "${data.message}"` : ""}`
            : `Propina de ${data.amount} tokens${data.message ? ` "${data.message}"` : ""}`,
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
        if (data.buyerId === myId) setHasJoinedPrivateShow(true);
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
        setHasJoinedPrivateShow(false);
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
    const el = chatEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
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
    const price = stream?.privateShowPrice;
    if (!price || price < 1 || buyingPrivateShow) {
      alert("La profesional todavía no configuró el precio del show privado.");
      return;
    }
    setBuyingPrivateShow(true);
    try {
      const res = await apiFetch<{ show: any; newBalance: number }>(`/live/${id}/private-show`, {
        method: "POST",
        body: JSON.stringify({ price }),
      });
      setMyBalance(res.newBalance);
      setHasJoinedPrivateShow(true);
      setShowPrivateModal(false);
    } catch (e: any) {
      alert(e?.body?.error || "Error al unirse al show privado");
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
    const newState = !micOn;
    // Mute/unmute directly on the local MediaStreamTrack (source-level)
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = newState; });
    // Also signal mute state through LiveKit publication
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.track) {
      if (newState) { pub.track.unmute(); } else { pub.track.mute(); }
    }
    setMicOn(newState);
  };

  const toggleCam = () => {
    const newState = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = newState; });
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.track) {
      if (newState) { pub.track.unmute(); } else { pub.track.mute(); }
    }
    setCamOn(newState);
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
      const res = await apiFetch<{ option: TipOption }>("/live/tip-options/add", {
        method: "POST",
        body: JSON.stringify({ label: newTipLabel.trim(), price: parseInt(newTipPrice, 10), emoji: null }),
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
      await apiFetch(`/live/tip-options/${optionId}`, { method: "DELETE" });
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

  // ── Periodic thumbnail capture (host only, every 30s) ──
  useEffect(() => {
    if (!isHost || !stream?.isActive || !videoReady) return;
    const videoEl = localVideoRef.current;
    if (!videoEl) return;

    const captureThumbnail = async () => {
      try {
        if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;
        const canvas = document.createElement("canvas");
        // Small thumbnail: 320px wide, keep aspect ratio
        const scale = 320 / videoEl.videoWidth;
        canvas.width = 320;
        canvas.height = Math.round(videoEl.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        await apiFetch(`/live/${id}/thumbnail`, {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
      } catch {
        // Ignore thumbnail capture errors silently
      }
    };

    // Capture immediately then every 30 seconds
    const timeout = setTimeout(captureThumbnail, 3000);
    const interval = setInterval(captureThumbnail, 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isHost, stream?.isActive, videoReady, id]);

  // ── Age gate ──
  if (!ageConfirmed) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#070816] p-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-fuchsia-500/[0.04] blur-[100px]" />
          <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-violet-500/[0.04] blur-[100px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative max-w-sm overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d0e1a]/90 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/15 to-fuchsia-500/10 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <ShieldAlert className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">Contenido +18</h2>
            <p className="mb-6 text-sm text-white/40 leading-relaxed">Al continuar confirmas que eres mayor de edad y aceptas ver contenido exclusivo para adultos.</p>
            <button
              onClick={() => setAgeConfirmed(true)}
              className="mb-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-[0_8px_24px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Soy mayor de 18 — Continuar
            </button>
            <button onClick={() => router.push("/")} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-3 text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-all">
              Volver
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-dvh items-center justify-center bg-[#070816]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin" />
        <p className="text-xs text-white/30">Conectando al live...</p>
      </div>
    </div>
  );
  if (!stream) return (
    <div className="flex h-dvh items-center justify-center bg-[#070816]">
      <div className="text-center">
        <Radio className="mx-auto mb-3 h-10 w-10 text-white/10" />
        <p className="text-sm font-semibold text-white/40">Stream no encontrado</p>
        <button onClick={() => router.push("/live")} className="mt-3 text-xs text-fuchsia-400 hover:underline">Ver otros streams</button>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     HOST VIEW — Professional Control Panel
     ═══════════════════════════════════════════════ */
  if (isHost) {
    return (
      <div className="flex h-dvh max-h-screen flex-col overflow-hidden bg-[#070816] text-white">
        {/* ── Host Top Bar ── */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#070816]/90 backdrop-blur-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 blur-lg scale-150" />
              <div className="relative flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-fuchsia-600/25 to-rose-600/25 border border-fuchsia-500/20">
                <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-fuchsia-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight">Studio</h1>
              <p className="text-[9px] sm:text-[10px] text-white/30 truncate max-w-[100px] sm:max-w-none">{stream.title || "Sin título"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {stream.isActive && (
              <div className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-500" />
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-red-300">LIVE</span>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] text-white/40">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {elapsed}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* ── Video Preview (smaller for host) ── */}
          <div className="relative flex h-[30vh] sm:h-[35vh] min-h-0 flex-shrink-0 items-center justify-center bg-black lg:h-auto lg:flex-1 lg:flex-shrink overflow-hidden">
            {/* Ambient glow behind video */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-900/20 via-transparent to-violet-900/20" />
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
                {rtcState === "error" ? (
                  <div className="mx-auto max-w-xs space-y-3">
                    <Radio className="mx-auto mb-2 h-12 w-12 text-red-400/50" />
                    <p className="text-xs text-red-300">{rtcError || "Error de conexión"}</p>
                    <button
                      onClick={() => { connectAttemptRef.current = 0; connectToLivekit(); }}
                      className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white active:scale-95 transition-transform"
                    >
                      Reintentar conexión
                    </button>
                  </div>
                ) : (
                  <>
                    <Radio className="mx-auto mb-3 h-12 w-12 animate-pulse text-fuchsia-400/30" />
                    <p className="text-xs text-white/30">Conectando video...</p>
                  </>
                )}
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/25 to-orange-500/20">
                      <Coins className="h-4 w-4 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-300">
                        {toast.senderName} — {toast.amount} tokens
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
          <div className="flex min-h-0 w-full flex-1 flex-col border-t border-white/[0.06] bg-[#070816] lg:w-96 lg:flex-initial lg:border-l lg:border-t-0 overflow-hidden">
            {/* Stats bar */}
            <div className="grid grid-cols-3 border-b border-white/[0.06]">
              <div className="flex flex-col items-center py-2 sm:py-3 border-r border-white/[0.04]">
                <div className="flex items-center gap-1 text-sm sm:text-base font-bold text-fuchsia-300">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60" /> {stream.viewerCount}
                </div>
                <span className="text-[8px] sm:text-[9px] text-white/25 mt-0.5">Viewers</span>
              </div>
              <div className="flex flex-col items-center py-2 sm:py-3 border-r border-white/[0.04]">
                <div className="flex items-center gap-1 text-sm sm:text-base font-bold text-amber-300">
                  <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60" /> {stream.totalTipsEarned || 0}
                </div>
                <span className="text-[8px] sm:text-[9px] text-white/25 mt-0.5">Tokens</span>
              </div>
              <div className="flex flex-col items-center py-2 sm:py-3">
                <div className="flex items-center gap-1 text-sm sm:text-base font-bold text-emerald-300">
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60" /> {elapsed}
                </div>
                <span className="text-[8px] sm:text-[9px] text-white/25 mt-0.5">Tiempo</span>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-white/[0.06] bg-white/[0.01]">
              {(["chat", "tips", "config"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setHostPanelTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold transition-all ${
                    hostPanelTab === tab
                      ? "border-b-2 border-fuchsia-500 text-fuchsia-300 bg-fuchsia-500/[0.04]"
                      : "text-white/35 hover:text-white/55 border-b-2 border-transparent"
                  }`}
                >
                  {tab === "chat" ? "Chat" : tab === "tips" ? "Propinas" : "Config"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* ── CHAT TAB ── */}
              {hostPanelTab === "chat" && (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
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
                  <div className="flex gap-1.5 border-t border-white/[0.06] p-2 sm:p-3" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Escribe..."
                      maxLength={300}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:py-2.5 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                    />
                    <button onClick={sendChat} disabled={!chatInput.trim()} className="rounded-xl bg-fuchsia-600 px-3 py-2 sm:py-2.5 transition hover:bg-fuchsia-500 disabled:opacity-30">
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
                    <input
                      value={newTipLabel}
                      onChange={(e) => setNewTipLabel(e.target.value)}
                      placeholder="Ej: Bailo para ti"
                      maxLength={50}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-500/30"
                    />
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
     VIEWER VIEW — Premium cinematic experience
     ═══════════════════════════════════════════════ */
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-[#070816] text-white">
      {/* ── Viewer Header ── */}
      {!isExpanded && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#070816]/90 backdrop-blur-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0">
              {stream.host.avatarUrl ? (
                <img src={resolveMediaUrl(stream.host.avatarUrl) ?? undefined} alt="" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl object-cover border border-white/10" />
              ) : (
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15 border border-white/10 text-[10px] sm:text-xs font-bold text-fuchsia-300">{(stream.host.displayName || "?")[0]}</div>
              )}
              {stream.isActive && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border-2 border-[#070816] bg-red-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold truncate">{stream.host.displayName || stream.host.username}</p>
              {stream.title && <p className="text-[9px] sm:text-[10px] text-white/30 truncate max-w-[120px] sm:max-w-none">{stream.title}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1.5">
            {stream.isActive && (
              <div className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-1.5 sm:px-2 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-red-300">LIVE</span>
              </div>
            )}
            {isPrivateActive && (
              <div className="hidden sm:flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5">
                <Lock className="h-2.5 w-2.5 text-amber-400" />
                <span className="text-[9px] font-bold text-amber-300">PRIVADO</span>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] text-white/40">
              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {stream.viewerCount}
            </div>
            {myBalance !== null && (
              <div className="flex items-center gap-1 rounded-full border border-amber-500/15 bg-amber-500/[0.06] px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-300">
                <Coins className="h-2.5 w-2.5" /> {myBalance}
              </div>
            )}
            <button onClick={() => router.push("/live")} className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-all">
              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className={`relative flex min-h-0 flex-1 ${isExpanded ? "flex-col" : "flex-col lg:flex-row"}`}>
        {/* ── Video Area ── */}
        <div className={`relative flex items-center justify-center overflow-hidden ${
          isExpanded ? "fixed inset-0 z-[90] h-[100dvh] w-full bg-black" : "h-[40vh] sm:h-[50vh] flex-shrink-0 bg-black lg:h-auto lg:flex-1 lg:flex-shrink"
        }`}>
          {/* Ambient gradient behind video */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-950/30 via-transparent to-violet-950/30" />

          {/* Remote video — muted because audio comes via separate LiveKit audio track */}
          {joined && (
            <video
              ref={remoteVideoRef}
              autoPlay playsInline muted
              className={`h-full w-full object-contain ${!videoReady ? "hidden" : ""} ${shouldBlur ? "blur-2xl scale-110 brightness-50" : ""}`}
            />
          )}

          {/* Private show blur overlay */}
          {shouldBlur && videoReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60" />
              <div className="relative text-center px-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mx-auto mb-5"
                >
                  <div className="relative mx-auto h-20 w-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 blur-xl animate-pulse" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-orange-500/10 backdrop-blur-xl">
                      <Lock className="h-8 w-8 text-amber-400" />
                    </div>
                  </div>
                </motion.div>
                <h3 className="text-lg font-bold">Show Privado</h3>
                <p className="mt-2 text-sm text-white/40 max-w-xs mx-auto leading-relaxed">
                  Contenido exclusivo en curso. Paga para desbloquear el acceso completo.
                </p>
                {stream.privateShowPrice && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-4 py-2">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span className="text-base font-bold text-amber-300">{stream.privateShowPrice} tokens</span>
                  </div>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => setShowPrivateModal(true)}
                    className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.03] hover:shadow-[0_12px_40px_rgba(245,158,11,0.3)] active:scale-[0.97]"
                  >
                    Unirse al show privado
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join button — full cinematic CTA */}
          {stream.isActive && !videoReady && !joined && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-900/20 via-transparent to-violet-900/20" />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative text-center px-8"
              >
                <div className="relative mx-auto mb-6 h-24 w-24">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15 blur-2xl animate-pulse" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.05] backdrop-blur">
                    <Radio className="h-10 w-10 text-fuchsia-400/70" />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-1">{stream.host.displayName || stream.host.username}</h3>
                <p className="text-sm text-white/35 mb-6">Está transmitiendo en vivo</p>
                <button
                  onClick={handleJoin}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-10 py-4 text-base font-bold transition-all hover:scale-[1.03] hover:shadow-[0_16px_48px_rgba(168,85,247,0.35)] active:scale-[0.97]"
                >
                  Unirse al Live
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -left-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: "shimmer 3s ease-in-out infinite" }} />
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-white/25">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {stream.viewerCount} viendo</span>
                  <span className="text-white/10">·</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsed}</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Viewer connecting state */}
          {stream.isActive && !videoReady && joined && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-6">
                {rtcState === "error" ? (
                  <div className="mx-auto max-w-xs space-y-3">
                    <Radio className="mx-auto mb-2 h-10 w-10 text-red-400/50" />
                    <p className="text-xs text-red-300">{rtcError || "Error de conexión"}</p>
                    <button
                      onClick={() => { connectAttemptRef.current = 0; connectToLivekit(); }}
                      className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white active:scale-95 transition-transform"
                    >
                      Reintentar conexión
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin" />
                    <p className="text-xs text-white/30">Conectando al live...</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Stream ended */}
          {!stream.isActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <Radio className="h-7 w-7 text-white/15" />
                </div>
                <p className="text-base font-semibold text-white/50">Transmisión finalizada</p>
                <p className="mt-1 text-xs text-white/25">Gracias por ver</p>
                <button onClick={() => router.push("/live")} className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-xs text-white/50 hover:bg-white/[0.06] transition-all">
                  Ver otros streams
                </button>
              </motion.div>
            </div>
          )}

          {/* ── Tip toasts — dramatic animated ── */}
          <div className="pointer-events-none absolute left-3 top-3 z-30 space-y-2 max-w-[280px] sm:left-4 sm:top-4 sm:max-w-xs">
            <AnimatePresence>
              {tipToasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, x: -60, scale: 0.7 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="flex items-center gap-2.5 rounded-2xl border border-amber-500/25 bg-black/70 px-3.5 py-2.5 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15">
                    <Coins className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-amber-300 truncate">
                      {toast.senderName} — {toast.amount} tk
                    </p>
                    {toast.optionLabel && <p className="text-[10px] text-white/50 truncate">{toast.optionLabel}</p>}
                    {toast.message && <p className="text-[10px] text-white/40 italic truncate">&quot;{toast.message}&quot;</p>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* ── Video overlays: LIVE badge + viewer count + expand ── */}
          {joined && videoReady && !shouldBlur && (
            <>
              {/* Bottom-left: LIVE + viewers (hidden in expanded — shown in overlay top bar) */}
              <div className={`absolute bottom-3 left-3 z-20 flex items-center gap-2 sm:bottom-4 sm:left-4 ${isExpanded ? "hidden" : ""}`}>
                {stream.isActive && (
                  <div className="flex items-center gap-1.5 rounded-full border border-red-500/25 bg-black/60 px-2.5 py-1 backdrop-blur-xl">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[9px] font-bold text-red-300">LIVE</span>
                  </div>
                )}
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-xl text-[10px] text-white/50">
                  <Users className="h-3 w-3" /> {stream.viewerCount}
                </div>
              </div>
              {/* Top-right: expand (only shown when NOT expanded; minimize is in the overlay top bar) */}
              {!isExpanded && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-xl bg-black/50 text-white/50 backdrop-blur-xl transition-all hover:bg-black/70 hover:text-white border border-white/10 sm:right-4 sm:top-4"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          {/* ── Expanded mode: transparent chat overlay (unified PC + mobile) ── */}
          {isExpanded && joined && (
            <div className="pointer-events-none absolute inset-0 z-[95] flex flex-col justify-end">
              {/* Top bar: controls */}
              <div className="pointer-events-auto flex shrink-0 items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
              >
                <div className="flex items-center gap-2">
                  {stream.host.avatarUrl ? (
                    <img src={resolveMediaUrl(stream.host.avatarUrl) ?? undefined} alt="" className="h-7 w-7 rounded-lg object-cover border border-white/20" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 backdrop-blur border border-white/10 text-[10px] font-bold text-fuchsia-300">{(stream.host.displayName || "?")[0]}</div>
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-white/90 drop-shadow">{stream.host.displayName || stream.host.username}</p>
                    <div className="flex items-center gap-2 text-[9px] text-white/50">
                      <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {stream.viewerCount}</span>
                      <span className="text-white/20">·</span>
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {elapsed}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {myBalance !== null && (
                    <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-black/40 backdrop-blur px-2 py-0.5 text-[9px] font-semibold text-amber-300">
                      <Coins className="h-2.5 w-2.5" /> {myBalance}
                    </div>
                  )}
                  <button onClick={() => setShowChat(!showChat)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/40 backdrop-blur text-white/50 hover:bg-black/60 hover:text-white/80 border border-white/10 transition-all" title={showChat ? "Ocultar chat" : "Mostrar chat"}>
                    {showChat ? <EyeOff className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setIsExpanded(false)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/40 backdrop-blur text-white/50 hover:bg-black/60 hover:text-white/80 border border-white/10 transition-all" title="Salir de pantalla completa">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => router.push("/live")} className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/40 backdrop-blur text-white/50 hover:bg-black/60 hover:text-white/80 border border-white/10 transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Spacer — pushes chat to bottom */}
              <div className="flex-1" />

              {/* Transparent chat overlay */}
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-auto flex flex-col w-full sm:max-w-md"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                  >
                    {/* Quick tips */}
                    {stream.isActive && !isHost && (
                      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-thin">
                        {tipOptions.map((opt) => (
                          <button key={opt.id} onClick={() => sendTip(opt.price, opt.id)} disabled={sendingTip} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-black/30 backdrop-blur px-2 py-1 text-[9px] font-semibold transition active:scale-95 disabled:opacity-40">
                            <span className="text-white/70">{opt.label}</span>
                            <span className="text-amber-300">{opt.price}</span>
                          </button>
                        ))}
                        {[10, 25, 50, 100].map((amt) => (
                          <button key={amt} onClick={() => sendTip(amt)} disabled={sendingTip} className="shrink-0 rounded-lg border border-white/15 bg-black/30 backdrop-blur px-2.5 py-1 text-[9px] font-bold text-amber-300 transition hover:bg-amber-500/15 active:scale-95 disabled:opacity-40">
                            {amt} tk
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Chat messages — transparent, bottom-aligned */}
                    <div className="max-h-[30vh] overflow-y-auto px-3 py-1 scrollbar-thin">
                      {messages.slice(-30).map((msg) => (
                        <div key={msg.id} className={`mb-1 ${msg.isTip ? "rounded-lg bg-amber-500/10 px-2 py-0.5" : ""}`}>
                          <span className={`text-[11px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                            msg.isTip ? "text-amber-300" : msg.userId === "system" ? "text-emerald-400" : msg.userId === myId ? "text-fuchsia-300" : "text-violet-300"
                          }`}>
                            {msg.userId === myId ? "Tú" : msg.userName || "Anónimo"}
                          </span>
                          <span className="text-[11px] text-white/30"> </span>
                          <span className={`text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${msg.isTip ? "text-amber-200/90 font-medium" : "text-white/80"}`}>
                            {msg.message}
                          </span>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="flex gap-2 px-3 pt-1">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat()}
                        placeholder="Escribe..."
                        maxLength={300}
                        className="flex-1 rounded-xl border border-white/15 bg-black/30 backdrop-blur px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/30 focus:border-fuchsia-500/30 transition-all"
                      />
                      <button onClick={sendChat} disabled={!chatInput.trim()} className="rounded-xl bg-fuchsia-600/70 backdrop-blur px-3 py-2 transition hover:bg-fuchsia-500/80 disabled:opacity-25">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Sidebar: Tips + Private Show + Chat (normal mode) ── */}
        {!isExpanded && (joined || isHost) && (
          <div className="flex min-h-0 w-full flex-1 flex-col border-t border-white/[0.06] bg-[#070816] lg:w-[360px] lg:flex-initial lg:border-l lg:border-t-0 overflow-hidden">

            {/* ── Private Show Banner ── */}
            {stream.isActive && stream.privateShowPrice && !isHost && (
              <div className={`border-b ${isPrivateActive ? "border-amber-500/20" : "border-white/[0.06]"}`}>
                {isPrivateActive && !hasJoinedPrivateShow ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative overflow-hidden bg-gradient-to-r from-amber-500/[0.12] via-orange-500/[0.08] to-amber-500/[0.12] px-3 py-3"
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -left-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent" style={{ animation: "shimmer 3s ease-in-out infinite" }} />
                    </div>
                    <div className="relative flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/20 border border-amber-500/25">
                        <Lock className="h-5 w-5 text-amber-400 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-300">Show Privado en curso</p>
                        <p className="text-[10px] text-amber-200/50">Desbloquea el contenido exclusivo</p>
                      </div>
                      {myId ? (
                        <button
                          onClick={() => setShowPrivateModal(true)}
                          className="shrink-0 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-[11px] font-bold text-white transition-all hover:scale-[1.03] hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-[0.97]"
                        >
                          {stream.privateShowPrice} tk
                        </button>
                      ) : (
                        <Link
                          href={`/login?next=${encodeURIComponent(`/live/${id}`)}`}
                          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-[11px] font-medium text-amber-300/80 transition-all hover:bg-amber-500/20"
                        >
                          <LogIn className="h-3 w-3" /> Ingresa para acceder
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ) : hasJoinedPrivateShow ? (
                  <div className="flex items-center gap-2 bg-emerald-500/[0.06] px-3 py-2">
                    <Eye className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-300">Tienes acceso al Show Privado</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPrivateModal(true)}
                    className="group mx-2 my-1.5 sm:my-2 flex w-[calc(100%-16px)] items-center gap-2.5 sm:gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_0_20px_rgba(245,158,11,0.08)] transition-all hover:border-amber-400/50 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)] active:scale-[0.98]"
                  >
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-400/25">
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[11px] sm:text-xs font-bold text-white/90">Show Privado</p>
                      <p className="text-[9px] sm:text-[10px] text-amber-200/50">Contenido exclusivo premium</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/20 px-2.5 py-1 sm:px-3 sm:py-1.5">
                      <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300" />
                      <span className="text-[11px] sm:text-xs font-bold text-amber-200">{stream.privateShowPrice} tk</span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* ── Tip Options — Always Visible ── */}
            {stream.isActive && tipOptions.length > 0 && !isHost && (
              <div className="border-b border-white/[0.06] px-2.5 py-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Gift className="h-3 w-3 text-fuchsia-400/60" />
                    <span className="text-[10px] font-semibold text-white/40">Propinas</span>
                  </div>
                  {myId && myBalance !== null && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-300/60">
                      <Coins className="h-2.5 w-2.5" /> {myBalance} tk
                    </div>
                  )}
                </div>
                {myId ? (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {tipOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => sendTip(opt.price, opt.id)}
                        disabled={sendingTip}
                        className="group flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:border-fuchsia-500/25 hover:bg-fuchsia-500/[0.06] active:scale-95 disabled:opacity-40"
                      >
                        <span className="text-[10px] font-medium text-white/60 group-hover:text-white/80 max-w-[72px] truncate">{opt.label}</span>
                        <span className="text-[10px] font-bold text-amber-300">{opt.price} tk</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Link href={`/login?next=${encodeURIComponent(`/live/${id}`)}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-2.5 text-[10px] text-white/35 transition hover:bg-white/[0.04] hover:text-amber-300/70">
                    <LogIn className="h-3 w-3" /> Inicia sesión para enviar propinas
                  </Link>
                )}
              </div>
            )}

            {/* ── Quick Tip Buttons ── */}
            {stream.isActive && !isHost && myId && (
              <div className="border-b border-white/[0.06] px-2.5 py-2.5">
                <div className="flex gap-1.5">
                  {[10, 25, 50, 100, 200].map((amt) => (
                    <button key={amt} onClick={() => sendTip(amt)} disabled={sendingTip} className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 text-[11px] font-bold text-amber-300/80 transition-all hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-300 active:scale-95 disabled:opacity-40">
                      {amt} <span className="text-[9px] font-normal text-white/30">tk</span>
                    </button>
                  ))}
                </div>
                {/* Custom amount toggle */}
                <button
                  onClick={() => setShowTipPanel(!showTipPanel)}
                  className="mt-1.5 w-full text-center text-[10px] text-white/25 hover:text-white/40 transition-colors py-1"
                >
                  {showTipPanel ? "Cerrar" : "Monto personalizado"}
                </button>
                {showTipPanel && (
                  <div className="mt-1 flex gap-1.5">
                    <input type="number" value={customTipAmount} onChange={(e) => setCustomTipAmount(e.target.value)} placeholder="Cantidad" min="1" className="w-20 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] outline-none placeholder:text-white/20 focus:border-amber-500/20" />
                    <input value={tipMessage} onChange={(e) => setTipMessage(e.target.value)} placeholder="Mensaje (opcional)" maxLength={200} className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] outline-none placeholder:text-white/20 focus:border-fuchsia-500/20" />
                    <button onClick={() => sendTip(parseInt(customTipAmount, 10) || 0)} disabled={sendingTip || !customTipAmount || parseInt(customTipAmount, 10) < 1} className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-[11px] font-bold transition-all disabled:opacity-40 hover:shadow-[0_4px_12px_rgba(245,158,11,0.2)] active:scale-95">
                      {sendingTip ? "..." : "Enviar"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Chat Messages ── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
              {messages.length === 0 && (
                <div className="py-10 text-center">
                  <Send className="mx-auto mb-2 h-5 w-5 text-white/10" />
                  <p className="text-[11px] text-white/20">Sé el primero en escribir</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`mb-1.5 rounded-xl px-2.5 py-1.5 ${
                      msg.isTip
                        ? "border border-amber-500/15 bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.05]"
                        : msg.userId === "system"
                          ? "border border-white/[0.06] bg-white/[0.02]"
                          : msg.userId === myId
                            ? "bg-fuchsia-500/[0.06]"
                            : ""
                    }`}
                  >
                    <span className={`text-[11px] font-semibold ${
                      msg.isTip ? "text-amber-300" : msg.userId === "system" ? "text-emerald-400/70" : msg.userId === myId ? "text-fuchsia-300" : "text-violet-300/80"
                    }`}>
                      {msg.userId === myId ? "Tú" : msg.userName || "Anónimo"}
                    </span>
                    <span className="text-[11px] text-white/25"> </span>
                    <span className={`text-[11px] leading-relaxed ${msg.isTip ? "text-amber-200/70 font-medium" : msg.userId === "system" ? "text-white/50" : "text-white/60"}`}>
                      {msg.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* ── Chat Input ── */}
            {myId ? (
              <div className="flex gap-1.5 border-t border-white/[0.06] p-2 sm:p-2.5" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Escribe..."
                  maxLength={300}
                  className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 sm:py-2.5 text-xs outline-none placeholder:text-white/20 focus:border-fuchsia-500/20 transition-all"
                />
                <button onClick={sendChat} disabled={!chatInput.trim()} className="flex h-[34px] w-[34px] sm:h-[38px] sm:w-[38px] shrink-0 items-center justify-center rounded-xl bg-fuchsia-600 transition-all hover:bg-fuchsia-500 disabled:opacity-25">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/live/${id}`)}`}
                className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-white/40 transition-colors hover:bg-white/[0.03] hover:text-fuchsia-300"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Inicia sesión para comentar
              </Link>
            )}
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
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPrivateModal(false); }}
          >
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/[0.08] bg-[#0d0e1a]/95 p-6 shadow-[0_-16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-3xl sm:shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-orange-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Show Privado</h3>
                    <p className="text-[11px] text-white/35">Contenido exclusivo premium</p>
                  </div>
                </div>

                <p className="mb-4 text-xs text-white/40 leading-relaxed">
                  Los demás espectadores verán la transmisión difuminada. Quienes paguen podrán disfrutar el contenido completo en HD.
                </p>

                {stream.privateShowPrice ? (
                  <div className="mb-5 rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.03] p-5 text-center">
                    <p className="text-[11px] text-white/40 mb-1">Precio</p>
                    <p className="text-3xl font-bold text-amber-300">{stream.privateShowPrice}</p>
                    <p className="text-xs text-amber-300/50">tokens</p>
                    {myBalance !== null && (
                      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/30">
                        <Coins className="h-3 w-3" /> Tu saldo: {myBalance} tokens
                        {myBalance < stream.privateShowPrice && <span className="text-red-400/70 ml-1">(insuficiente)</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-5 rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-5 text-center">
                    <p className="text-sm font-semibold text-red-300/80">No disponible</p>
                    <p className="mt-1 text-xs text-white/30">La profesional aún no configuró el precio.</p>
                  </div>
                )}

                <button
                  onClick={buyPrivateShow}
                  disabled={buyingPrivateShow || !stream.privateShowPrice}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3.5 text-sm font-bold transition-all hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(245,158,11,0.25)] disabled:opacity-40 disabled:hover:scale-100 active:scale-[0.98]"
                >
                  <Lock className="h-4 w-4" />
                  {buyingPrivateShow ? "Procesando..." : "Unirse al show privado"}
                </button>

                <button onClick={() => setShowPrivateModal(false)} className="mt-3 w-full py-2 text-center text-xs text-white/30 hover:text-white/50 transition-colors">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
