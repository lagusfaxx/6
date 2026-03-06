"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ArrowRight, User, Tag } from "lucide-react";
import { apiFetch } from "../lib/api";

type ForumThread = {
  id: string;
  title: string;
  author: string;
  category: string;
  categorySlug: string;
  lastPostAt: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ForumSideCard() {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchThreads = () => {
    apiFetch<{ threads: ForumThread[] }>("/forum/recent")
      .then((r) => {
        const next = (r.threads ?? []).slice(0, 3);
        setThreads(next);
        setVisible(next.length > 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchThreads();
    intervalRef.current = setInterval(fetchThreads, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // When threads become empty, fade out
  useEffect(() => {
    setVisible(threads.length > 0);
  }, [threads]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="hidden lg:block"
        >
          <div className="sticky top-[100px] w-[260px] xl:w-[280px]">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600/25 to-violet-600/25">
                  <MessageSquare className="h-3.5 w-3.5 text-fuchsia-400" />
                </div>
                <span className="text-xs font-semibold text-white/80">Últimos hilos</span>
              </div>

              {/* Thread list */}
              <div className="px-3 py-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {threads.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, x: -16, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: "auto" }}
                      exit={{ opacity: 0, x: 16, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <Link
                        href={`/foro/thread/${t.id}`}
                        className="group block rounded-xl px-2.5 py-2 transition hover:bg-white/[0.05]"
                      >
                        <p className="text-[13px] font-medium leading-snug text-white/85 line-clamp-2 group-hover:text-fuchsia-300 transition">
                          {t.title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/35">
                          <span className="flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" />
                            {t.author}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Tag className="h-2.5 w-2.5" />
                            {t.category}
                          </span>
                          <span className="ml-auto shrink-0">{timeAgo(t.lastPostAt)}</span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Footer link */}
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <Link
                  href="/foro"
                  className="group flex items-center justify-center gap-1.5 text-[11px] font-semibold text-fuchsia-400/80 transition hover:text-fuchsia-300"
                >
                  Ver foro
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
