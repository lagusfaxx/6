"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import { ArrowLeft, MessageSquare, Search, User as UserIcon } from "lucide-react";

type ChatUser = {
  id: string;
  username?: string;
  displayName?: string | null;
  email?: string;
  avatarUrl?: string | null;
  profileType?: string;
  city?: string | null;
};

type Conversation = {
  userA: ChatUser;
  userB: ChatUser;
  messageCount: number;
  lastMessageAt: string;
  lastMessage: { body: string; fromId: string; createdAt: string } | null;
};

type ThreadMessage = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type ThreadData = {
  userA: ChatUser;
  userB: ChatUser;
  messages: ThreadMessage[];
  total: number;
};

const PAGE_SIZE = 30;
const THREAD_PAGE = 200;

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Cliente",
  PROFESSIONAL: "Profesional",
  ESTABLISHMENT: "Establecimiento",
  SHOP: "Tienda",
  CREATOR: "Creador",
  ADMIN: "Admin",
};

function typeLabel(type?: string): string {
  return TYPE_LABELS[(type || "").toUpperCase()] || type || "—";
}

function typeBadgeClass(type?: string): string {
  switch ((type || "").toUpperCase()) {
    case "PROFESSIONAL":
      return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30";
    case "CLIENT":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "ADMIN":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-white/[0.06] text-white/60 border-white/10";
  }
}

function userName(u: ChatUser): string {
  return u.displayName || u.username || u.id.slice(0, 8);
}

function Avatar({ user }: { user: ChatUser }) {
  const src = user.avatarUrl ? resolveMediaUrl(user.avatarUrl) : null;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
      <UserIcon className="h-4 w-4 text-white/40" />
    </div>
  );
}

export default function AdminChatsPage() {
  const [q, setQ] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const [selected, setSelected] = useState<{ a: string; b: string } | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (query: string, nextOffset: number, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await apiFetch<{ conversations: Conversation[]; total: number }>(
        `/admin/chats?${params.toString()}`,
      );
      setConversations((prev) =>
        append ? [...prev, ...(res.conversations || [])] : res.conversations || [],
      );
      setTotal(res.total || 0);
      setOffset(nextOffset);
    } catch {
      if (!append) {
        setConversations([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => load(q, 0, false), 400);
    return () => clearTimeout(t);
  }, [q, load]);

  const openThread = useCallback(async (a: string, b: string) => {
    setSelected({ a, b });
    setThreadLoading(true);
    setThread(null);
    try {
      const res = await apiFetch<ThreadData>(
        `/admin/chats/${a}/${b}?limit=${THREAD_PAGE}`,
      );
      setThread(res);
    } catch {
      setThread(null);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (!selected || !thread) return;
    setThreadLoading(true);
    try {
      const res = await apiFetch<ThreadData>(
        `/admin/chats/${selected.a}/${selected.b}?limit=${THREAD_PAGE}&offset=${thread.messages.length}`,
      );
      setThread((prev) =>
        prev
          ? { ...prev, messages: [...res.messages, ...prev.messages], total: res.total }
          : res,
      );
    } catch {
    } finally {
      setThreadLoading(false);
    }
  }, [selected, thread]);

  useEffect(() => {
    if (thread && !threadLoading) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [thread?.messages.length, threadLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeThread = () => {
    setSelected(null);
    setThread(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-1 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-fuchsia-300" />
          <h1 className="text-2xl font-bold">Moderación de Chats</h1>
        </div>
        <p className="mb-6 text-sm text-white/50">
          Revisa las conversaciones entre clientes y profesionales para detectar mal
          uso de la mensajería. Acceso de solo lectura.
        </p>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* ── Lista de conversaciones ── */}
          <div className={selected ? "hidden lg:block" : ""}>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, usuario o email…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-500/40"
              />
            </div>

            {loading && conversations.length === 0 ? (
              <div className="py-16 text-center text-white/30">Cargando…</div>
            ) : conversations.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-sm text-white/40">
                Sin conversaciones
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((c) => {
                  const isSelected =
                    selected?.a === c.userA.id && selected?.b === c.userB.id;
                  return (
                    <button
                      key={`${c.userA.id}-${c.userB.id}`}
                      onClick={() => openThread(c.userA.id, c.userB.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-fuchsia-500/40 bg-fuchsia-500/10"
                          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <Avatar user={c.userA} />
                          <Avatar user={c.userB} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{userName(c.userA)}</span>
                            <span
                              className={`rounded-full border px-1.5 py-px text-[9px] ${typeBadgeClass(c.userA.profileType)}`}
                            >
                              {typeLabel(c.userA.profileType)}
                            </span>
                            <span className="text-white/30">↔</span>
                            <span className="truncate">{userName(c.userB)}</span>
                            <span
                              className={`rounded-full border px-1.5 py-px text-[9px] ${typeBadgeClass(c.userB.profileType)}`}
                            >
                              {typeLabel(c.userB.profileType)}
                            </span>
                          </div>
                          {c.lastMessage && (
                            <p className="mt-0.5 truncate text-xs text-white/40">
                              {c.lastMessage.body}
                            </p>
                          )}
                          <p className="mt-0.5 text-[10px] text-white/30">
                            {c.messageCount} mensajes ·{" "}
                            {new Date(c.lastMessageAt).toLocaleString("es-CL")}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {conversations.length < total && (
                  <button
                    onClick={() => load(q, offset + PAGE_SIZE, true)}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs text-white/60 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {loading ? "Cargando…" : `Cargar más (${conversations.length} de ${total})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Hilo de la conversación ── */}
          <div className={!selected ? "hidden lg:block" : ""}>
            {!selected ? (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] text-sm text-white/30">
                Selecciona una conversación para ver los mensajes
              </div>
            ) : (
              <div className="flex h-[75vh] flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <div className="flex items-center gap-3 border-b border-white/[0.08] p-3">
                  <button
                    onClick={closeThread}
                    className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] lg:hidden"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {thread ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {[thread.userA, thread.userB].map((u) => (
                        <div key={u.id} className="flex min-w-0 items-center gap-2">
                          <Avatar user={u} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {userName(u)}{" "}
                              <span
                                className={`ml-1 rounded-full border px-1.5 py-px text-[9px] ${typeBadgeClass(u.profileType)}`}
                              >
                                {typeLabel(u.profileType)}
                              </span>
                            </p>
                            <p className="truncate text-[10px] text-white/40">
                              {u.email || u.username}
                              {u.city ? ` · ${u.city}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                      <span className="ml-auto text-[10px] text-white/30">
                        {thread.total} mensajes
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-white/40">Cargando…</span>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {threadLoading && !thread ? (
                    <div className="py-16 text-center text-white/30">Cargando…</div>
                  ) : thread ? (
                    <>
                      {thread.messages.length < thread.total && (
                        <button
                          onClick={loadOlder}
                          disabled={threadLoading}
                          className="mx-auto block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          Cargar mensajes anteriores
                        </button>
                      )}
                      {thread.messages.map((m) => {
                        const fromA = m.fromId === thread.userA.id;
                        const sender = fromA ? thread.userA : thread.userB;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${fromA ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl border px-3 py-2 ${
                                fromA
                                  ? "border-white/[0.08] bg-white/[0.05]"
                                  : "border-fuchsia-500/20 bg-fuchsia-500/10"
                              }`}
                            >
                              <p className="text-[10px] font-medium text-white/50">
                                {userName(sender)}
                              </p>
                              <p className="whitespace-pre-wrap break-words text-sm text-white/90">
                                {m.body}
                              </p>
                              <p className="mt-1 text-right text-[9px] text-white/30">
                                {new Date(m.createdAt).toLocaleString("es-CL")}
                                {m.readAt ? " · leído" : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </>
                  ) : (
                    <div className="py-16 text-center text-sm text-white/40">
                      No se pudo cargar la conversación.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/admin"
          className="mt-6 inline-block text-sm text-fuchsia-300 hover:underline"
        >
          Volver al panel admin
        </Link>
      </div>
    </div>
  );
}
