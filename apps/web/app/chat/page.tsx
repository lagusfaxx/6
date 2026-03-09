"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Search, ArrowLeft, Sparkles } from "lucide-react";
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
      {/* Header – clean section header, no card */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
        <Link
          href="/cuenta"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Mensajes</h1>
            {totalUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-1.5 text-[10px] font-bold leading-none text-white">
                {totalUnread}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40">
            {conversations.length} conversacion{conversations.length !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {/* Search – integrated into layout */}
      <div className="relative py-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-fuchsia-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-fuchsia-500/20"
          placeholder="Buscar conversación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="divide-y divide-white/[0.04]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 px-3 py-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
              </div>
              <div className="h-3 w-10 rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center text-sm text-red-200">
          {error}
        </div>
      ) : !filtered.length ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 blur-2xl scale-150" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
              <MessageCircle className="h-8 w-8 text-white/30" />
            </div>
          </div>
          <p className="text-sm font-medium text-white/60">
            {search ? "No se encontraron conversaciones" : "Aún no tienes conversaciones"}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {search
              ? "Intenta con otro nombre"
              : "Inicia una conversación desde el perfil de un profesional"}
          </p>
          {!search && (
            <Link
              href="/servicios"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/30 px-4 py-2.5 text-xs text-fuchsia-200 transition hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Explorar servicios
            </Link>
          )}
        </div>
      ) : (
        /* Conversation list – compact rows */
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((c) => {
            const isImage = c.lastMessage.body.startsWith("ATTACHMENT_IMAGE:");
            const preview = isImage ? "Imagen adjunta" : c.lastMessage.body;
            const hasUnread = c.unreadCount > 0;

            return (
              <Link
                key={c.other.id}
                href={`/chat/${c.other.id}`}
                className={`group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${
                  hasUnread
                    ? "bg-fuchsia-500/[0.07]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar src={c.other.avatarUrl} alt={c.other.username} size={44} />
                  {hasUnread && (
                    <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#070816] bg-gradient-to-r from-fuchsia-500 to-violet-500" />
                  )}
                </div>

                {/* Name + preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-[13px] leading-tight ${hasUnread ? "font-semibold text-white" : "font-medium text-white/85"}`}>
                      {c.other.displayName || c.other.username}
                    </span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-medium leading-tight ${profileColor(c.other.profileType)}`}>
                      {profileLabel(c.other.profileType)}
                    </span>
                  </div>
                  <p className={`mt-0.5 truncate text-xs leading-tight ${hasUnread ? "text-white/60" : "text-white/35"}`}>
                    {preview}
                  </p>
                </div>

                {/* Timestamp + badge */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-[11px] ${hasUnread ? "text-fuchsia-400/80" : "text-white/25"}`}>
                    {timeAgo(c.lastMessage.createdAt)}
                  </span>
                  {hasUnread && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-1 text-[9px] font-bold leading-none text-white">
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
