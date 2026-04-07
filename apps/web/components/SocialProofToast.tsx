"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { connectRealtime } from "../lib/realtime";
import useMe from "../hooks/useMe";

/* ─── Constants ─── */

const DISMISS_MS = 5000;
const MIN_FAKE_INTERVAL = 15_000;
const MAX_FAKE_INTERVAL = 25_000;
const COOLDOWN_MS = 4_000;
const INITIAL_DELAY_MS = 12_000;
const MAX_QUEUE = 5;

const NAMES = [
  "Valentina", "Catalina", "Isidora", "Martina", "Sofía",
  "Florencia", "Agustina", "Antonella", "Fernanda", "Constanza",
  "Javiera", "Camila", "Daniela", "Francisca", "Macarena",
  "Alejandra", "Gabriela", "Natalia", "Carolina", "Andrea",
  "Belén", "Ignacia", "Monserrat", "Renata", "Amanda",
  "Ximena", "Paula", "Bárbara", "Rocío", "Tamara",
  "Josefina", "Pilar", "Victoria", "Emilia", "Antonia",
  "Luciana", "Millaray", "Anaís", "Paloma", "Carla",
];

const SUPPRESSED_ROUTES = ["/chat", "/chats", "/login", "/register", "/forgot-password", "/dashboard"];

/* ─── Types ─── */

type SocialProofEvent = {
  id: string;
  kind: "message" | "whatsapp";
  displayName: string;
};

/* ─── Component ─── */

export default function SocialProofToast() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const queueRef = useRef<SocialProofEvent[]>([]);
  const [active, setActive] = useState<SocialProofEvent | null>(null);
  const lastNameRef = useRef("");
  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  // Check if current route should suppress toasts
  const isSuppressed = SUPPRESSED_ROUTES.some((r) => pathname.startsWith(r));

  // Push event to queue
  const enqueue = useCallback((evt: SocialProofEvent) => {
    if (queueRef.current.length < MAX_QUEUE) {
      queueRef.current.push(evt);
    }
  }, []);

  // Show next toast from queue
  const showNext = useCallback(() => {
    if (!mountedRef.current || busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    setActive(next);

    // Auto-dismiss
    setTimeout(() => {
      if (!mountedRef.current) return;
      setActive(null);
      // Cooldown before next
      setTimeout(() => {
        if (!mountedRef.current) return;
        busyRef.current = false;
        showNext();
      }, COOLDOWN_MS);
    }, DISMISS_MS);
  }, []);

  // Dismiss on click
  const dismiss = useCallback(() => {
    setActive(null);
    setTimeout(() => {
      if (!mountedRef.current) return;
      busyRef.current = false;
      showNext();
    }, COOLDOWN_MS);
  }, [showNext]);

  // Periodically check queue (in case events were enqueued while idle)
  useEffect(() => {
    const interval = setInterval(() => {
      if (readyRef.current && !busyRef.current && queueRef.current.length > 0) {
        showNext();
      }
    }, 2000);
    return () => clearInterval(interval);
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

  // Listen for real SSE events (only if authenticated)
  useEffect(() => {
    if (!isAuthed) return;
    const cleanup = connectRealtime(({ type, data }) => {
      if (type === "social_proof" && data?.displayName) {
        enqueue({
          id: `real-${Date.now()}-${Math.random()}`,
          kind: data.kind === "whatsapp" ? "whatsapp" : "message",
          displayName: data.displayName,
        });
      }
    });
    return cleanup;
  }, [isAuthed, enqueue]);

  // Generate fake events
  useEffect(() => {
    if (isSuppressed) return;

    let timer: ReturnType<typeof setTimeout>;

    const scheduleFake = () => {
      const delay = MIN_FAKE_INTERVAL + Math.random() * (MAX_FAKE_INTERVAL - MIN_FAKE_INTERVAL);
      timer = setTimeout(() => {
        if (!mountedRef.current) return;
        // Skip if queue is already full
        if (queueRef.current.length >= 3) {
          scheduleFake();
          return;
        }
        // Skip if tab is hidden
        if (document.visibilityState === "hidden") {
          scheduleFake();
          return;
        }

        // Pick random name (avoid repeating last)
        let name: string;
        do {
          name = NAMES[Math.floor(Math.random() * NAMES.length)];
        } while (name === lastNameRef.current && NAMES.length > 1);
        lastNameRef.current = name;

        const kind = Math.random() < 0.6 ? "message" : "whatsapp";
        enqueue({
          id: `fake-${Date.now()}-${Math.random()}`,
          kind: kind as "message" | "whatsapp",
          displayName: name,
        });

        scheduleFake();
      }, delay);
    };

    scheduleFake();
    return () => clearTimeout(timer);
  }, [isSuppressed, enqueue]);

  // Don't render anything on suppressed routes
  if (isSuppressed) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] flex justify-center px-4 md:inset-x-auto md:bottom-6 md:right-6 md:left-auto md:justify-end"
    >
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 350 }}
            onClick={dismiss}
            className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e1a]/85 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            {/* Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20">
              {active.kind === "whatsapp" ? (
                <Phone className="h-4 w-4 text-emerald-400" />
              ) : (
                <MessageCircle className="h-4 w-4 text-fuchsia-400" />
              )}
            </div>

            {/* Text */}
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/70">
              {active.kind === "whatsapp" ? (
                <>Alguien contactó a <span className="font-semibold text-fuchsia-300">{active.displayName}</span> por WhatsApp</>
              ) : (
                <>Alguien envió un mensaje a <span className="font-semibold text-fuchsia-300">{active.displayName}</span></>
              )}
            </p>

            {/* Progress bar */}
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
  );
}
