"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Search, ArrowLeft, Sparkles, ImageIcon } from "lucide-react";
import { apiFetch, friendlyErrorMessage, isAuthError } from "../../lib/api";
import { connectRealtime } from "../../lib/realtime";
import Avatar from "../../components/Avatar";

type Conversation = {
  other: {
    id: string;
    displayName: string | null;
    username: string;
    avatarUrl: string | null;
    profileType: string;
    city: string | null;
  };
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    fromId: string;
    toId: string;
  };
  unreadCount: number;
};

function profileLabel(type: string) {
  if (type === "PROFESSIONAL") return "Experiencia";
  if (type === "SHOP") return "Tienda";
  if (type === "ESTABLISHMENT") return "Lugar";
  return "Perfil";
}

function profileColor(type: string) {
  if (type === "PROFESSIONAL") return "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20";
  if (type === "SHOP") return "text-violet-300 bg-violet-500/10 border-violet-500/20";
  if (type === "ESTABLISHMENT") return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  return "text-white/40 bg-white/5 border-white/10";
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default function ChatInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname() || "/chats";
  const load = useCallback(() => {
    return apiFetch<{ conversations: Conversation[] }>("/messages/inbox")
      .then((r) => setConversations(r.conversations))
      .catch((e: any) => {
        if (isAuthError(e)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setError(friendlyErrorMessage(e) || "No se pudo cargar los mensajes");
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for real-time new messages to update conversation list
  useEffect(() => {
    const disconnect = connectRealtime((event) => {
      if (event.type === "message" && event.data?.message) {
        const msg = event.data.message;
        const from = event.data.from;

        setConversations((prev) => {
          const otherId = msg.fromId;
          const existing = prev.find((c) => c.other.id === otherId);

          if (existing) {
            // Update existing conversation: new last message, increment unread, move to top
            const updated = prev.map((c) =>
              c.other.id === otherId
                ? {
                    ...c,
                    lastMessage: {
                      id: msg.id,
                      body: msg.body,
                      createdAt: msg.createdAt,
                      fromId: msg.fromId,
                      toId: msg.toId,
                    },
                    unreadCount: c.unreadCount + 1,
                  }
                : c
            );
            // Move updated conversation to top
            const target = updated.find((c) => c.other.id === otherId);
            if (!target) return updated;
            return [target, ...updated.filter((c) => c.other.id !== otherId)];
          }

          if (from) {
            // New conversation from SSE sender info
            const newConv: Conversation = {
              other: {
                id: from.id,
                displayName: from.displayName,
                username: from.username,
                avatarUrl: from.avatarUrl,
                profileType: from.profileType,
                city: from.city,
              },
              lastMessage: {
                id: msg.id,
                body: msg.body,
                createdAt: msg.createdAt,
                fromId: msg.fromId,
                toId: msg.toId,
              },
              unreadCount: 1,
            };
            return [newConv, ...prev];
          }

          // Fallback: re-fetch inbox if we don't have sender info
          load();
          return prev;
        });
      }
    });
    return () => disconnect();
  }, [load]);

  const filtered = conversations.filter((c) => {
    const target = `${c.other.displayName || ""} ${c.other.username}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="relative flex items-center gap-3 pb-4">
        <Link
          href="/cuenta"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 transition-all hover:bg-white/10 hover:text-white hover:border-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/20">
              <MessageCircle className="h-4 w-4 text-fuchsia-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Mensajes</h1>
                {totalUnread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]">
                    {totalUnread}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/35">
                {conversations.length} conversacion{conversations.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent mb-3" />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
        <input
          className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none backdrop-blur-sm transition-all duration-200 focus:border-fuchsia-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-fuchsia-500/15 focus:shadow-[0_0_20px_rgba(168,85,247,0.08)]"
          placeholder="Buscar conversación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3.5 rounded-2xl px-3 py-3.5">
              <div className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2.5">
                <div className="h-3.5 w-1/3 rounded-lg bg-white/[0.06]" />
                <div className="h-3 w-2/3 rounded-lg bg-white/[0.04]" />
              </div>
              <div className="h-3 w-10 rounded-lg bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-center text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      ) : !filtered.length ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 blur-3xl scale-[2]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.06] backdrop-blur-sm shadow-[0_0_40px_rgba(168,85,247,0.08)]">
              <MessageCircle className="h-10 w-10 text-white/20" />
            </div>
          </div>
          <p className="text-sm font-semibold text-white/60">
            {search ? "No se encontraron conversaciones" : "Aún no tienes conversaciones"}
          </p>
          <p className="mt-1.5 max-w-xs text-xs text-white/35 leading-relaxed">
            {search
              ? "Intenta con otro nombre"
              : "Inicia una conversación desde el perfil de un profesional"}
          </p>
          {!search && (
            <Link
              href="/servicios"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(168,85,247,0.25)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Explorar servicios
            </Link>
          )}
        </div>
      ) : (
        /* Conversation list */
        <div className="space-y-0.5">
          {filtered.map((c) => {
            const isImage = c.lastMessage.body.startsWith("ATTACHMENT_IMAGE:");
            const preview = isImage ? "Imagen adjunta" : c.lastMessage.body;
            const hasUnread = c.unreadCount > 0;

            return (
              <Link
                key={c.other.id}
                href={`/chat/${c.other.id}`}
                className={`group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-all duration-200 ${
                  hasUnread
                    ? "bg-gradient-to-r from-fuchsia-500/[0.07] to-violet-500/[0.03] border border-fuchsia-500/[0.08] shadow-[0_0_16px_rgba(168,85,247,0.04)]"
                    : "border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`rounded-full ${hasUnread ? "ring-2 ring-fuchsia-500/30 ring-offset-1 ring-offset-[#070816]" : ""}`}>
                    <Avatar src={c.other.avatarUrl} alt={c.other.username} size={48} />
                  </div>
                  {hasUnread && (
                    <div className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#070816] bg-gradient-to-r from-fuchsia-500 to-violet-500 shadow-[0_0_8px_rgba(217,70,239,0.5)]" />
                  )}
                </div>

                {/* Name + preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-[13px] leading-tight ${hasUnread ? "font-bold text-white" : "font-medium text-white/80"}`}>
                      {c.other.displayName || c.other.username}
                    </span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-medium leading-tight ${profileColor(c.other.profileType)}`}>
                      {profileLabel(c.other.profileType)}
                    </span>
                  </div>
                  <p className={`mt-0.5 flex items-center gap-1 truncate text-xs leading-tight ${hasUnread ? "text-white/55" : "text-white/30"}`}>
                    {isImage && <ImageIcon className="h-3 w-3 shrink-0" />}
                    {preview}
                  </p>
                </div>

                {/* Timestamp + badge */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`text-[11px] ${hasUnread ? "text-fuchsia-400/90 font-medium" : "text-white/20"}`}>
                    {timeAgo(c.lastMessage.createdAt)}
                  </span>
                  {hasUnread && (
                    <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-1.5 text-[9px] font-bold leading-none text-white shadow-[0_0_10px_rgba(217,70,239,0.4)]">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
