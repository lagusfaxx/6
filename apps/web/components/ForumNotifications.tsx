"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Reply, X, ArrowRight } from "lucide-react";
import { connectRealtime } from "../lib/realtime";
import { apiFetch } from "../lib/api";
import useMe from "../hooks/useMe";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

/** Contextual toast — direct notification for thread participants */
type ContextualToast = {
  id: string;
  kind: "reply";
  threadId: string;
  threadTitle: string;
  author: string;
  timestamp: number;
};

/** Discovery nudge — social micro-notification for non-participants */
type DiscoveryNudge = {
  id: string;
  kind: "new-thread" | "new-activity";
  threadId: string;
  title: string;
  author: string;
  category: string;
  timestamp: number;
};

type ForumNotifCtx = {
  badgeCount: number;
  clearBadge: () => void;
};

const Ctx = createContext<ForumNotifCtx>({ badgeCount: 0, clearBadge: () => {} });
export function useForumNotifications() {
  return useContext(Ctx);
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

const MAX_CONTEXTUAL = 3;
const CONTEXTUAL_DISMISS_MS = 6000;
const DISCOVERY_DISMISS_MS = 5000;

/* ═══════════════════════════════════════════════════════════════════
   Provider
   ═══════════════════════════════════════════════════════════════════ */

export function ForumNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [contextualToasts, setContextualToasts] = useState<ContextualToast[]>([]);
  const [discoveryNudge, setDiscoveryNudge] = useState<DiscoveryNudge | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const seenRef = useRef(new Set<string>());
  const discoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname() || "/";
  const { me, loading: meLoading } = useMe();
  const myId = me?.user?.id;

  // Clear badge when visiting /foro
  useEffect(() => {
    if (pathname.startsWith("/foro")) setBadgeCount(0);
  }, [pathname]);

  const clearBadge = useCallback(() => setBadgeCount(0), []);

  const dismissContextual = useCallback((id: string) => {
    setContextualToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissDiscovery = useCallback(() => {
    setDiscoveryNudge(null);
  }, []);

  const markSeen = useCallback((id: string): boolean => {
    if (seenRef.current.has(id)) return false;
    seenRef.current.add(id);
    if (seenRef.current.size > 200) {
      const arr = Array.from(seenRef.current);
      seenRef.current = new Set(arr.slice(-100));
    }
    return true;
  }, []);

  const addContextual = useCallback(
    (toast: ContextualToast) => {
      if (!markSeen(toast.id)) return;
      setContextualToasts((prev) => [toast, ...prev].slice(0, MAX_CONTEXTUAL));
      setBadgeCount((c) => c + 1);
      setTimeout(() => {
        setContextualToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, CONTEXTUAL_DISMISS_MS);
    },
    [markSeen],
  );

  const showDiscovery = useCallback(
    (nudge: DiscoveryNudge) => {
      if (!markSeen(nudge.id)) return;
      setBadgeCount((c) => c + 1);

      // Clear existing timer
      if (discoveryTimerRef.current) clearTimeout(discoveryTimerRef.current);

      setDiscoveryNudge(nudge);
      discoveryTimerRef.current = setTimeout(() => {
        setDiscoveryNudge(null);
        discoveryTimerRef.current = null;
      }, DISCOVERY_DISMISS_MS);
    },
    [markSeen],
  );

  // ── Real-time SSE for forum events (authenticated users only) ──
  // Guests cannot connect to /realtime/stream (requires auth → 401).
  useEffect(() => {
    if (meLoading || !myId) return; // skip SSE for guests

    const cleanup = connectRealtime((event) => {
      if (event.type === "forum:newThread" && event.data) {
        const d = event.data;
        // Skip own threads for authenticated users
        if (myId && d.author?.id === myId) return;
        showDiscovery({
          id: `thread-${d.id}`,
          kind: "new-thread",
          threadId: d.id,
          title: d.title ?? "Nuevo tema",
          author: d.author?.username ?? "Alguien",
          category: d.category?.name ?? "Foro",
          timestamp: Date.now(),
        });
      }
      if (event.type === "forum:newPost" && event.data) {
        const d = event.data;
        // Skip own posts for authenticated users
        if (myId && d.post?.author?.id === myId) return;
        // Contextual toast only for authenticated thread owners
        if (myId && d.threadAuthorId === myId) {
          addContextual({
            id: `post-${d.post?.id ?? Date.now()}`,
            kind: "reply",
            threadId: d.threadId,
            threadTitle: (d.threadTitle || "tu hilo").slice(0, 60),
            author: d.post?.author?.username ?? "Alguien",
            timestamp: Date.now(),
          });
        } else {
          showDiscovery({
            id: `post-${d.post?.id ?? Date.now()}`,
            kind: "new-activity",
            threadId: d.threadId,
            title: (d.threadTitle || "Conversación activa").slice(0, 60),
            author: d.post?.author?.username ?? "Alguien",
            category: "",
            timestamp: Date.now(),
          });
        }
      }
    });
    return cleanup;
  }, [meLoading, myId, addContextual, showDiscovery]);

  // ── Guest fallback: poll /forum/recent in case SSE doesn't connect ──
  const lastKnownIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // Wait until useMe resolves; only run for guests
    if (meLoading || myId) return;

    let alive = true;

    // Seed initial state without showing nudges
    apiFetch<{ threads: { id: string; title: string; author: string; category: string; lastPostAt: string }[] }>("/forum/recent")
      .then((r) => {
        if (!alive) return;
        lastKnownIdsRef.current = (r.threads ?? []).map((t) => t.id);
      })
      .catch(() => {});

    const interval = setInterval(() => {
      apiFetch<{ threads: { id: string; title: string; author: string; category: string; lastPostAt: string }[] }>("/forum/recent")
        .then((r) => {
          if (!alive) return;
          const threads = r.threads ?? [];
          const prev = lastKnownIdsRef.current;
          // Find threads that weren't in the previous snapshot
          for (const t of threads) {
            if (!prev.includes(t.id)) {
              showDiscovery({
                id: `poll-${t.id}`,
                kind: "new-thread",
                threadId: t.id,
                title: t.title,
                author: t.author,
                category: t.category ?? "Foro",
                timestamp: Date.now(),
              });
              break; // One nudge at a time
            }
          }
          // Detect activity change on existing threads (lastPostAt changed)
          if (threads.length > 0 && prev.includes(threads[0].id)) {
            // Top thread is same but may have new replies — check if it moved to top
            const prevTopIdx = prev.indexOf(threads[0].id);
            if (prevTopIdx > 0) {
              showDiscovery({
                id: `poll-activity-${threads[0].id}-${Date.now()}`,
                kind: "new-activity",
                threadId: threads[0].id,
                title: threads[0].title,
                author: threads[0].author,
                category: threads[0].category ?? "Foro",
                timestamp: Date.now(),
              });
            }
          }
          lastKnownIdsRef.current = threads.map((t) => t.id);
        })
        .catch(() => {});
    }, 60_000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [meLoading, myId, showDiscovery]);

  return (
    <Ctx.Provider value={{ badgeCount, clearBadge }}>
      {children}
      <ContextualToastContainer
        toasts={contextualToasts}
        onDismiss={dismissContextual}
      />
      <DiscoveryNudgeOverlay
        nudge={discoveryNudge}
        onDismiss={dismissDiscovery}
      />
    </Ctx.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   1) Contextual Toasts — direct, for thread participants
   ═══════════════════════════════════════════════════════════════════ */

function ContextualToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ContextualToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-3 top-[80px] z-[70] flex w-[280px] flex-col gap-2 sm:right-4 sm:top-[92px] sm:w-[300px]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="pointer-events-auto"
          >
            <div className="group relative overflow-hidden rounded-xl border border-violet-500/20 bg-[#12131f]/90 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{
                  duration: CONTEXTUAL_DISMISS_MS / 1000,
                  ease: "linear",
                }}
                className="absolute left-0 top-0 h-[2px] w-full origin-left bg-gradient-to-r from-violet-500 to-fuchsia-500"
              />
              <Link
                href={`/foro/thread/${t.threadId}`}
                onClick={() => onDismiss(t.id)}
                className="flex items-start gap-2.5 px-3 py-2.5"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
                  <Reply className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-violet-300">
                    Nueva respuesta
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/80 line-clamp-1">
                    {t.author} respondió en &ldquo;{t.threadTitle}&rdquo;
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-white/25 opacity-0 transition hover:bg-white/10 hover:text-white/60 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2) Discovery Nudge — social micro-notification for non-participants
      Temporary, appears and vanishes. One at a time. Small, elegant.
   ═══════════════════════════════════════════════════════════════════ */

function DiscoveryNudgeOverlay({
  nudge,
  onDismiss,
}: {
  nudge: DiscoveryNudge | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {nudge && (
        <motion.div
          key={nudge.id}
          initial={{ opacity: 0, y: -10, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.25 } }}
          transition={{ type: "spring", damping: 28, stiffness: 400 }}
          className="pointer-events-auto fixed right-3 bottom-20 z-[60] md:bottom-auto md:right-4 md:top-[92px]"
        >
          <Link
            href={`/foro/thread/${nudge.threadId}`}
            onClick={onDismiss}
            className="group flex max-w-[260px] items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#0e0e1a]/70 px-3.5 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-lg transition hover:border-fuchsia-500/20 hover:bg-[#0e0e1a]/85"
          >
            {/* Icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20">
              {nudge.kind === "new-thread" ? (
                <MessageSquare className="h-4 w-4 text-fuchsia-400" />
              ) : (
                <Reply className="h-4 w-4 text-violet-400" />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-white/70 line-clamp-1">
                {nudge.kind === "new-thread" ? (
                  <>
                    <span className="font-semibold text-white/90">
                      {nudge.author}
                    </span>{" "}
                    abrió un nuevo tema
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-white/90">
                      {nudge.author}
                    </span>{" "}
                    comentó en el foro
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-fuchsia-400/60 line-clamp-1 group-hover:text-fuchsia-300/80 transition">
                {nudge.title}
              </p>
            </div>

            <ArrowRight className="h-3 w-3 shrink-0 text-white/20 transition group-hover:text-fuchsia-400 group-hover:translate-x-0.5" />
          </Link>

          {/* Dismiss progress dot */}
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 0 }}
            transition={{ duration: DISCOVERY_DISMISS_MS / 1000, ease: "linear" }}
            className="absolute -left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-fuchsia-500/50"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
