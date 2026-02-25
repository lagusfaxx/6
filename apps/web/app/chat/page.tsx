"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Search, ArrowLeft } from "lucide-react";
import { apiFetch, friendlyErrorMessage, isAuthError } from "../../lib/api";
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

  const load = () => {
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
  };

  useEffect(() => {
    load();
  }, [pathname, router]);

  const filtered = conversations.filter((c) => {
    const target = `${c.other.displayName || ""} ${c.other.username}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/cuenta"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Mensajes</h1>
          <p className="text-xs text-white/50">
            {conversations.length} conversacion{conversations.length !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-white/40 outline-none backdrop-blur-xl transition focus:border-white/20 focus:ring-2 focus:ring-fuchsia-500/20"
          placeholder="Buscar conversación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-white/10" />
                  <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                </div>
                <div className="h-3 w-10 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error}
        </div>
      ) : !filtered.length ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
            <MessageCircle className="h-8 w-8 text-white/40" />
          </div>
          <p className="text-sm font-medium text-white/60">
            {search ? "No se encontraron conversaciones" : "Aún no tienes conversaciones"}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {search
              ? "Intenta con otro nombre"
              : "Inicia una conversación desde el perfil de un profesional"}
          </p>
        </div>
      ) : (
        /* Conversation list */
        <div className="space-y-2">
          {filtered.map((c) => {
            const isImage = c.lastMessage.body.startsWith("ATTACHMENT_IMAGE:");
            const preview = isImage ? "Imagen adjunta" : c.lastMessage.body;
            const hasUnread = c.unreadCount > 0;

            return (
              <Link
                key={c.other.id}
                href={`/chat/${c.other.id}`}
                className={`group flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                  hasUnread
                    ? "border-fuchsia-500/20 bg-fuchsia-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]"
                }`}
              >
                {/* Avatar with online dot */}
                <div className="relative shrink-0">
                  <Avatar src={c.other.avatarUrl} alt={c.other.username} size={48} />
                  {hasUnread && (
                    <div className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0e0e12] bg-fuchsia-500" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm ${hasUnread ? "font-semibold" : "font-medium text-white/90"}`}>
                      {c.other.displayName || c.other.username}
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                      {profileLabel(c.other.profileType)}
                    </span>
                  </div>
                  <p className={`mt-0.5 truncate text-xs ${hasUnread ? "text-white/70" : "text-white/45"}`}>
                    {preview}
                  </p>
                </div>

                {/* Timestamp + badge */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-white/40">
                    {timeAgo(c.lastMessage.createdAt)}
                  </span>
                  {hasUnread && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-1.5 text-[10px] font-bold leading-none">
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
