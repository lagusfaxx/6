"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type Conversation = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isCreator: boolean;
  lastMessage: { body: string; createdAt: string; fromId: string } | null;
  unreadCount: number;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Ahora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("es-CL", { weekday: "short" });
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function messagePreview(body: string) {
  if (body.startsWith("ATTACHMENT_IMAGE:")) return "📷 Imagen";
  return body.length > 60 ? body.slice(0, 60) + "…" : body;
}

export default function UmateMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<{ conversations: Conversation[] }>("/umate/messages/conversations")
      .then((res) => setConversations(res?.conversations || []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          c.displayName.toLowerCase().includes(search.toLowerCase()) ||
          c.username.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[600px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Mensajes</h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#00aff0]/30 focus:bg-white/[0.06]"
          />
        </div>

        {/* Conversations */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
            <p className="text-xs text-white/30">Cargando conversaciones...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00aff0]/[0.08]">
              <MessageCircle className="h-7 w-7 text-[#00aff0]/60" />
            </div>
            <p className="text-sm font-semibold text-white/50">
              {search ? "Sin resultados" : "No tienes conversaciones"}
            </p>
            <p className="mt-1.5 text-xs text-white/30">
              {search
                ? "Intenta con otro nombre"
                : "Suscríbete a una creadora para enviarle mensajes."}
            </p>
            {!search && (
              <Link
                href="/umate/explore"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)]"
              >
                Explorar creadoras
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((conv) => (
              <Link
                key={conv.userId}
                href={`/umate/messages/${conv.userId}`}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-white/[0.04]"
              >
                {/* Avatar */}
                <div className="relative h-12 w-12 shrink-0">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
                    {conv.avatarUrl ? (
                      <img src={resolveMediaUrl(conv.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg font-bold text-white/40">
                        {(conv.displayName || "?")[0]}
                      </div>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#00aff0] px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(0,175,240,0.6)]">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm font-semibold ${conv.unreadCount > 0 ? "text-white" : "text-white/80"}`}>
                      {conv.displayName}
                    </p>
                    {conv.lastMessage && (
                      <span className="shrink-0 text-[10px] text-white/25">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {conv.isCreator && (
                      <span className="shrink-0 rounded bg-[#00aff0]/10 px-1 py-0.5 text-[9px] font-bold text-[#00aff0]/70">
                        Creadora
                      </span>
                    )}
                    <p className={`truncate text-xs ${conv.unreadCount > 0 ? "text-white/60 font-medium" : "text-white/30"}`}>
                      {conv.lastMessage ? messagePreview(conv.lastMessage.body) : "Inicia una conversación"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
