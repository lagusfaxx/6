"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { connectRealtime } from "../lib/realtime";
import { apiFetch } from "../lib/api";
import useMe from "../hooks/useMe";

/* ─── Constants ─── */

const DISMISS_MS = 5000;
const MIN_FAKE_INTERVAL = 8_000;
const MAX_FAKE_INTERVAL = 12_000;
const COOLDOWN_MS = 3_000;
const INITIAL_DELAY_MS = 10_000;
const MAX_QUEUE = 5;

const SUPPRESSED_ROUTES = ["/chat", "/chats", "/login", "/register", "/forgot-password", "/dashboard"];

/* ─── Types ─── */

type Professional = {
  id: string;
  displayName: string;
  username: string;
};

type SocialProofEvent = {
  id: string;
  kind: "message" | "whatsapp";
  displayName: string;
  profileUrl: string;
};

/* ─── Component ─── */

export default function SocialProofToast() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const queueRef = useRef<SocialProofEvent[]>([]);
  const [active, setActive] = useState<SocialProofEvent | null>(null);
  const lastIdRef = useRef("");
  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const professionalsRef = useRef<Professional[]>([]);

  const isSuppressed = SUPPRESSED_ROUTES.some((r) => pathname.startsWith(r));

  // Fetch real professionals on mount
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ profiles: any[] }>("/profiles/discover?sort=featured&limit=40")
      .then((data) => {
        if (cancelled) return;
        const list = (data?.profiles || data || []) as any[];
        professionalsRef.current = list
          .filter((p: any) => p.displayName || p.username)
          .map((p: any) => ({
            id: p.id,
            displayName: p.displayName || p.username,
            username: p.username,
          }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const showNext = useCallback(() => {
    if (!mountedRef.current || busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    setActive(next);

    setTimeout(() => {
      if (!mountedRef.current) return;
      setActive(null);
      setTimeout(() => {
        if (!mountedRef.current) return;
        busyRef.current = false;
        showNext();
      }, COOLDOWN_MS);
    }, DISMISS_MS);
  }, []);

  const enqueue = useCallback((evt: SocialProofEvent) => {
    if (queueRef.current.length >= MAX_QUEUE) return;
    queueRef.current.push(evt);
    // Trigger display if idle and ready
    if (readyRef.current && !busyRef.current) showNext();
  }, [showNext]);

  const handleClick = useCallback(() => {
    if (!active) return;
    const url = active.profileUrl;
    setActive(null);
    router.push(url);
    setTimeout(() => {
      if (!mountedRef.current) return;
      busyRef.current = false;
      showNext();
    }, COOLDOWN_MS);
  }, [active, router, showNext]);

  const dismiss = useCallback(() => {
    setActive(null);
    setTimeout(() => {
      if (!mountedRef.current) return;
      busyRef.current = false;
      showNext();
    }, COOLDOWN_MS);
  }, [showNext]);

  // Initial delay
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      readyRef.current = true;
    }, INITIAL_DELAY_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Listen for real SSE events
  useEffect(() => {
    if (!isAuthed) return;
    const cleanup = connectRealtime(({ type, data }) => {
      if (type === "social_proof" && data?.displayName) {
        enqueue({
          id: `real-${Date.now()}-${Math.random()}`,
          kind: data.kind === "whatsapp" ? "whatsapp" : "message",
          displayName: data.displayName,
          profileUrl: data.profileId ? `/profesional/${data.profileId}` : "/",
        });
      }
    });
    return cleanup;
  }, [isAuthed, enqueue]);

  // Generate fake events using real professionals
  useEffect(() => {
    if (isSuppressed) return;

    let timer: ReturnType<typeof setTimeout>;

    const scheduleFake = () => {
      const delay = MIN_FAKE_INTERVAL + Math.random() * (MAX_FAKE_INTERVAL - MIN_FAKE_INTERVAL);
      timer = setTimeout(() => {
        if (!mountedRef.current) return;
        if (queueRef.current.length >= 3) { scheduleFake(); return; }
        if (document.visibilityState === "hidden") { scheduleFake(); return; }

        const pool = professionalsRef.current;
        if (pool.length === 0) { scheduleFake(); return; }

        // Pick random professional (avoid repeating last)
        let prof: Professional;
        do {
          prof = pool[Math.floor(Math.random() * pool.length)];
        } while (prof.id === lastIdRef.current && pool.length > 1);
        lastIdRef.current = prof.id;

        const kind = Math.random() < 0.6 ? "message" : "whatsapp";
        enqueue({
          id: `fake-${Date.now()}-${Math.random()}`,
          kind: kind as "message" | "whatsapp",
          displayName: prof.displayName,
          profileUrl: `/profesional/${prof.id}`,
        });

        scheduleFake();
      }, delay);
    };

    scheduleFake();
    return () => clearTimeout(timer);
  }, [isSuppressed, enqueue]);

  if (isSuppressed) return null;

  return (
    <>
      {/* Mobile: notification style from top */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+8px)] md:hidden">
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={`m-${active.id}`}
              initial={{ opacity: 0, y: -60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40, transition: { duration: 0.2 } }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              onClick={handleClick}
              className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a2e]/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/25 to-violet-600/25 shadow-[0_0_12px_rgba(217,70,239,0.15)]">
                {active.kind === "whatsapp" ? (
                  <Phone className="h-[18px] w-[18px] text-emerald-400" />
                ) : (
                  <MessageCircle className="h-[18px] w-[18px] text-fuchsia-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-white/40 leading-none mb-0.5">Uzeed</p>
                <p className="text-[13px] leading-snug text-white/80">
                  {active.kind === "whatsapp" ? (
                    <>Alguien contactó a <span className="font-semibold text-fuchsia-300">{active.displayName}</span></>
                  ) : (
                    <>Alguien envió un mensaje a <span className="font-semibold text-fuchsia-300">{active.displayName}</span></>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-white/25">ahora</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: bottom-right */}
      <div className="pointer-events-none fixed inset-x-auto bottom-6 right-6 z-[55] hidden md:flex md:justify-end">
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={`d-${active.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 350 }}
              onClick={handleClick}
              className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e1a]/85 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors hover:border-fuchsia-500/20"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20">
                {active.kind === "whatsapp" ? (
                  <Phone className="h-4 w-4 text-emerald-400" />
                ) : (
                  <MessageCircle className="h-4 w-4 text-fuchsia-400" />
                )}
              </div>
              <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/70">
                {active.kind === "whatsapp" ? (
                  <>Alguien contactó a <span className="font-semibold text-fuchsia-300">{active.displayName}</span> por WhatsApp</>
                ) : (
                  <>Alguien envió un mensaje a <span className="font-semibold text-fuchsia-300">{active.displayName}</span></>
                )}
              </p>
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.04]">
                <motion.div
                  className="h-full bg-gradient-to-r from-fuchsia-500/40 to-violet-500/40"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: DISMISS_MS / 1000, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
