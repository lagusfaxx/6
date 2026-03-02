"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function EditorCard({
  title,
  subtitle,
  children,
  delay = 0,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -1 }}
      className={`editor-card p-5 sm:p-6 ${className}`}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
