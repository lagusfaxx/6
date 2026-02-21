"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="fixed left-3 top-[128px] z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur-xl transition hover:bg-white/10 hover:text-white md:left-[252px] md:top-[138px]"
      aria-label="Volver"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
