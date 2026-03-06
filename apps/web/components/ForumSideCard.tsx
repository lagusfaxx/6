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

  useEffect(() => {
    setVisible(threads.length > 0);
  }, [threads]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.2 } }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed right-4 top-[88px] z-40 hidden lg:block md:right-6 xl:right-8"
        >
          <div className="w-[250px] rounded-2xl border border-white/[0.1] bg-[#0e0e1a]/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-600/30 to-violet-600/30">
                <MessageSquare className="h-3 w-3 text-fuchsia-400" />
              </div>
              <span className="text-[11px] font-semibold text-white/70 tracking-wide">Últimos hilos</span>
            </div>

            {/* Thread list */}
            <div className="px-2 py-1.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {threads.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 12, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <Link
                      href={`/foro/thread/${t.id}`}
                      className="group block rounded-lg px-2 py-1.5 transition hover:bg-white/[0.06]"
                    >
                      <p className="text-[12px] font-medium leading-snug text-white/80 line-clamp-1 group-hover:text-fuchsia-300 transition">
                        {t.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/30">
                        <span className="flex items-center gap-0.5 truncate">
                          <User className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{t.author}</span>
                        </span>
                        <span className="text-white/15">·</span>
                        <span className="flex items-center gap-0.5 truncate">
                          <Tag className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{t.category}</span>
                        </span>
                        <span className="ml-auto shrink-0 text-white/25">{timeAgo(t.lastPostAt)}</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Footer link */}
            <div className="border-t border-white/[0.06] px-3.5 py-2">
              <Link
                href="/foro"
                className="group flex items-center justify-center gap-1 text-[10px] font-semibold text-fuchsia-400/70 transition hover:text-fuchsia-300"
              >
                Ver foro
                <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
