"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Lock,
  Send,
  X,
} from "lucide-react";
import { apiFetch, API_URL, resolveMediaUrl } from "../../../../lib/api";
import { connectRealtime } from "../../../../lib/realtime";
import useMe from "../../../../hooks/useMe";

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
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

export default function UmateChatPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { me } = useMe();
  const myId = me?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ChatUser | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load messages
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    apiFetch<{ messages: Message[]; other: ChatUser }>(`/messages/${userId}`)
      .then((res) => {
        if (res) {
          setMessages(res.messages || []);
          setOther(res.other || null);
        }
      })
      .catch((err) => {
        if (err?.message?.includes("CHAT_NOT_ALLOWED") || err?.status === 403) {
          setError("CHAT_NOT_ALLOWED");
        } else {
          setError("ERROR");
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // Realtime
  useEffect(() => {
    if (!myId) return;
    const disconnect = connectRealtime((event) => {
      if (event.type === "message" && event.data?.message) {
        const msg = event.data.message as Message;
        if (msg.fromId === userId || msg.toId === userId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark as read
          if (msg.fromId === userId) {
            apiFetch(`/messages/${userId}`, { method: "GET" }).catch(() => {});
          }
        }
      }
    });
    return disconnect;
  }, [myId, userId]);

  // Auto-scroll on new messages
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (sending) return;

    if (attachment) {
      setSending(true);
      const form = new FormData();
      form.append("file", attachment);
      try {
        const res = await fetch(`${API_URL.replace(/\/$/, "")}/messages/${userId}/attachment`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = await res.json();
        if (data?.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch { /* silent */ }
      setAttachment(null);
      setAttachmentPreview(null);
      setSending(false);
      return;
    }

    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody("");
    try {
      const res = await apiFetch<{ message: Message }>(`/messages/${userId}`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch { /* silent */ }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    const reader = new FileReader();
    reader.onload = () => setAttachmentPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Group messages by date
  const messagesByDate: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const last = messagesByDate[messagesByDate.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      messagesByDate.push({ date: dateKey, messages: [msg] });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
      </div>
    );
  }

  if (error === "CHAT_NOT_ALLOWED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="rounded-2xl bg-white/[0.04] p-6 backdrop-blur-sm">
          <Lock className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-4 text-center text-sm font-semibold text-white/60">
            Necesitas una suscripción activa para enviar mensajes a esta creadora.
          </p>
          <Link
            href="/umate/plans"
            className="mt-4 block rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] py-2.5 text-center text-sm font-bold text-white"
          >
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-white/40">Error al cargar el chat.</p>
        <button onClick={() => router.back()} className="text-sm text-[#00aff0]">Volver</button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px-80px)] flex-col lg:h-[calc(100vh-56px)]">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-3">
        <button onClick={() => router.push("/umate/messages")} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.06] hover:text-white/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other && (
          <Link href={`/umate/profile/${other.username}`} className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
              {other.avatarUrl ? (
                <img src={resolveMediaUrl(other.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">
                  {(other.displayName || other.username || "?")[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white/90">{other.displayName || other.username}</p>
              <p className="text-[11px] text-white/30">@{other.username}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-white/30">Aún no hay mensajes.</p>
            <p className="mt-1 text-xs text-white/20">Escribe el primer mensaje.</p>
          </div>
        )}

        {messagesByDate.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center justify-center py-2">
              <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-white/25">
                {formatDateSeparator(group.messages[0].createdAt)}
              </span>
            </div>

            <div className="space-y-1">
              {group.messages.map((msg) => {
                const isMine = msg.fromId === myId;
                const isImage = msg.body.startsWith("ATTACHMENT_IMAGE:");
                const imageUrl = isImage ? msg.body.replace("ATTACHMENT_IMAGE:", "") : null;

                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isMine
                          ? "bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white"
                          : "bg-white/[0.06] text-white/80"
                      }`}
                    >
                      {isImage && imageUrl ? (
                        <img
                          src={resolveMediaUrl(imageUrl) || imageUrl}
                          alt=""
                          className="max-w-full rounded-xl"
                          style={{ maxHeight: 300 }}
                        />
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                      )}
                      <p className={`mt-1 text-[10px] ${isMine ? "text-white/50" : "text-white/20"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Attachment preview */}
      {attachmentPreview && (
        <div className="border-t border-white/[0.04] px-4 py-2">
          <div className="relative inline-block">
            <img src={attachmentPreview} alt="" className="h-20 rounded-xl" />
            <button
              onClick={() => { setAttachment(null); setAttachmentPreview(null); }}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white/50"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#00aff0]/30 focus:bg-white/[0.06]"
            maxLength={2000}
          />
          <button
            onClick={handleSend}
            disabled={sending || (!body.trim() && !attachment)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-[0_2px_12px_rgba(0,175,240,0.25)] transition disabled:opacity-30"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
