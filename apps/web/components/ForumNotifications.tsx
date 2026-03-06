"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Reply, X } from "lucide-react";
import { connectRealtime } from "../lib/realtime";

/* ── Types ── */

type ForumToast = {
  id: string;
  kind: "thread" | "reply";
  title: string;
  author: string;
  threadId: string;
  threadTitle: string;
  timestamp: number;
};

type ForumNotifCtx = {
  /** Unread forum event count since last visit to /foro */
  badgeCount: number;
  clearBadge: () => void;
};

const Ctx = createContext<ForumNotifCtx>({ badgeCount: 0, clearBadge: () => {} });

export function useForumNotifications() {
  return useContext(Ctx);
}

/* ── Constants ── */

const MAX_TOASTS = 3;
const DISMISS_MS = 5000;

/* ── Provider ── */

export function ForumNotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ForumToast[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const seenRef = useRef(new Set<string>());
  const pathname = usePathname() || "/";

  // Clear badge when user visits /foro
  useEffect(() => {
    if (pathname.startsWith("/foro")) {
      setBadgeCount(0);
    }
  }, [pathname]);

  const clearBadge = useCallback(() => setBadgeCount(0), []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: ForumToast) => {
    if (seenRef.current.has(toast.id)) return;
    seenRef.current.add(toast.id);
    // Keep set from growing unbounded
    if (seenRef.current.size > 200) {
      const entries = Array.from(seenRef.current);
      seenRef.current = new Set(entries.slice(-100));
    }

    setToasts((prev) => [toast, ...prev].slice(0, MAX_TOASTS));
    setBadgeCount((c) => c + 1);

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, DISMISS_MS);
  }, []);

  // Connect to SSE
  useEffect(() => {
    const cleanup = connectRealtime((event) => {
      if (event.type === "forum:newThread" && event.data) {
        const d = event.data;
        addToast({
          id: `thread-${d.id}`,
          kind: "thread",
          title: d.title ?? "Nuevo tema",
          author: d.author?.username ?? "Alguien",
          threadId: d.id,
          threadTitle: d.title ?? "",
          timestamp: Date.now(),
        });
      }
      if (event.type === "forum:newPost" && event.data) {
        const d = event.data;
        addToast({
          id: `post-${d.post?.id ?? Date.now()}`,
          kind: "reply",
          title: `Respuesta en "${(d.post?.threadTitle || d.threadTitle || "un hilo").slice(0, 50)}"`,
          author: d.post?.author?.username ?? "Alguien",
          threadId: d.threadId,
          threadTitle: d.post?.threadTitle || "",
          timestamp: Date.now(),
        });
      }
    });
    return cleanup;
  }, [addToast]);

  return (
    <Ctx.Provider value={{ badgeCount, clearBadge }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

/* ── Toast Container ── */

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ForumToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-3 top-[80px] z-[70] flex w-[300px] flex-col gap-2 sm:right-4 sm:top-[92px] sm:w-[320px]">
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
            <div className="group relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#12131f]/90 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: DISMISS_MS / 1000, ease: "linear" }}
                className="absolute left-0 top-0 h-[2px] w-full origin-left bg-gradient-to-r from-fuchsia-500 to-violet-500"
              />
              <Link
                href={`/foro/thread/${t.threadId}`}
                onClick={() => onDismiss(t.id)}
                className="flex items-start gap-2.5 px-3 py-2.5"
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.kind === "thread" ? "bg-fuchsia-500/20" : "bg-violet-500/20"}`}>
                  {t.kind === "thread" ? (
                    <MessageSquare className="h-3.5 w-3.5 text-fuchsia-400" />
                  ) : (
                    <Reply className="h-3.5 w-3.5 text-violet-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-snug text-white/90 line-clamp-2">
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    por {t.author}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-white/30 opacity-0 transition hover:bg-white/10 hover:text-white/60 group-hover:opacity-100"
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
