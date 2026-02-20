"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-3 inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm md:opacity-70"
    >
      ← Atrás
    </button>
  );
}
