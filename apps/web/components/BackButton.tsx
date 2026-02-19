"use client";

import { usePathname, useRouter } from "next/navigation";

const ROOT_PATHS = ["/", "/login", "/register", "/forgot-password"];

export default function BackButton() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  if (ROOT_PATHS.includes(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="fixed bottom-20 right-4 z-50 rounded-full border border-white/20 bg-black/75 px-4 py-2 text-xs text-white shadow-lg"
    >
      Volver
    </button>
  );
}
