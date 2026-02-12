"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Nav from "./Nav";
import TopHeader from "./TopHeader";
import PushNotificationsManager from "./PushNotificationsManager";

/**
 * Controla cuándo se muestra el chrome (Nav + layout).
 * Auth pages deben ser “distraction-free”.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  // iOS Safari: evita “auto text sizing” que agranda botones/textos
  const iosTextSizeFix: React.CSSProperties = {
    WebkitTextSizeAdjust: "100%",
  };

  if (isAuthRoute) {
    return (
      <div
        style={iosTextSizeFix}
        className="min-h-[100svh] w-full px-4 py-10"
      >
        <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md items-center">
          <div className="w-full">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={iosTextSizeFix}
      className="flex min-h-[100svh] w-full bg-transparent text-white"
    >
      <Nav />

      <div className="relative flex-1">
        <TopHeader />
        <PushNotificationsManager />
        {/* padding-bottom con safe-area para que no se “corte” en iPhone */}
        <main className="flex-1 px-4 pt-[84px] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-[96px] md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
