"use client";

import { motion } from "framer-motion";

type Props = {
  tone: "success" | "error";
  message: string;
};

export default function ToastNotification({ tone, message }: Props) {
  const colors =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : "border-red-400/30 bg-red-500/10 text-red-100";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-20 right-6 z-[60] rounded-xl border px-4 py-3 text-sm backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${colors}`}
    >
      {message}
    </motion.div>
  );
}
