"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Only show on home route
    if (pathname !== "/") {
      return;
    }

    // Check if splash has been shown in this session
    const shown = sessionStorage.getItem("uzeed_splash_shown");
    if (shown === "true") {
      setIsVisible(false);
      return;
    }

    // Show splash
    setIsVisible(true);

    // Hide after 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem("uzeed_splash_shown", "true");
    }, 2500);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!isVisible && hasShown) return null;

  return (
    <AnimatePresence onExitComplete={() => setHasShown(true)}>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#070816]"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-fuchsia-900/10 to-transparent" />

          {/* Animated logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <motion.img
              src="/brand/isotipo-new.png"
              alt="UZEED"
              className="h-32 w-32 md:h-40 md:w-40"
              animate={{ rotate: 360 }}
              transition={{
                duration: 16,
                ease: "linear",
                repeat: Infinity
              }}
            />

            {/* Glow effect */}
            <div className="absolute inset-0 -z-10 blur-3xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 scale-150" />
          </motion.div>

          {/* Loading text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="absolute bottom-20 text-sm text-white/60"
          >
            Cargando experiencia...
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
