"use client";

import * as React from "react";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ${className || ""}`}
    >
      {children}
    </span>
  );
}
