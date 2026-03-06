"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { connectRealtime } from "../../../lib/realtime";
import {
  Radio, Users, Send, X, AlertTriangle, ShieldAlert,
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ stream: Stream }>(`/live/${id}`)
      .then((r) => {
        setStream(r.stream);
        setMessages(r.stream.messages?.reverse() || []);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router]);

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
    };
  }, [joined, id]);

  // SSE for live chat
  useEffect(() => {
    if (!me?.user?.id || !joined) return;
    const cleanup = connectRealtime((event) => {
      if (event.type === "live:chat" && event.data?.streamId === id) {
        setMessages((prev) => [...prev, {
          id: event.data.messageId,
          userId: event.data.userId,
          userName: event.data.userName,
          message: event.data.message,
          createdAt: event.data.createdAt,
        }]);
      }
      if (event.type === "live:ended" && event.data?.streamId === id) {
        setStream((s) => s ? { ...s, isActive: false } : null);
      }
    });
    return cleanup;
  }, [me?.user?.id, joined, id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    try {
      await apiFetch(`/live/${id}/chat`, { method: "POST", body: JSON.stringify({ message: chatInput.trim() }) });
      // Optimistic: add to local
      setMessages((prev) => [...prev, {
        id: `local-${Date.now()}`,
        userId: me?.user?.id || "",
        userName: "Tú",
        message: chatInput.trim(),
        createdAt: new Date().toISOString(),
      }]);
      setChatInput("");
    } catch {}
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

  const isHost = me?.user?.id === stream.host.id;

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
        {/* Video area placeholder */}
        <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-fuchsia-950/30 to-violet-950/30">
          {stream.isActive ? (
            <div className="text-center">
              <Radio className="mx-auto mb-3 h-16 w-16 animate-pulse text-fuchsia-400/40" />
              <p className="text-sm text-white/30">Transmisión en vivo</p>
              {!joined && !isHost && (
                <button onClick={handleJoin} className="mt-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold">
                  Unirse al Live
                </button>
              )}
              {isHost && (
                <button onClick={async () => { await apiFetch(`/live/${id}/end`, { method: "POST" }); router.push("/"); }} className="mt-4 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold">
                  Finalizar Live
                </button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-semibold text-white/40">Live finalizado</p>
              <button onClick={() => router.push("/")} className="mt-3 text-sm text-fuchsia-400 underline">Volver al inicio</button>
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
