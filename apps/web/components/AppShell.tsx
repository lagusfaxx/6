"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Nav from "./Nav";
import TopHeader from "./TopHeader";
import Footer from "./Footer";
import LocationFilterProvider from "./LocationFilterProvider";
import BackButton from "./BackButton";
import { ForumNotificationProvider } from "./ForumNotifications";
import { ChatNotificationProvider } from "./ChatNotifications";
import { StoryUploadProvider } from "./StoryUploadContext";
import StoryUploadModal from "./StoryUploadModal";
import { usePageViewTracker } from "../hooks/useAnalytics";
import ScrollToTop from "./ScrollToTop";

/* Lazy-load non-critical shell components to reduce initial main-thread work */
const PushNotificationsManager = dynamic(
  () => import("./PushNotificationsManager"),
  { ssr: false },
);
const PresenceHeartbeat = dynamic(
  () => import("./PresenceHeartbeat"),
  { ssr: false },
);
const SocialProofToast = dynamic(
  () => import("./SocialProofToast"),
  { ssr: false },
);

/**
 * Controla cuándo se muestra el chrome (Nav + layout).
 * Auth pages y dashboard/services (Creator Studio) son distraction-free.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  usePageViewTracker();
  const pathname = usePathname() || "/";

  // Defer non-critical components until after first paint + idle time
  const [deferredReady, setDeferredReady] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setDeferredReady(true), { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(() => setDeferredReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  const isHome = pathname === "/";

  // Dashboard routes: hide main header/nav so the Creator Studio has its own layout
  const isDashboardRoute = pathname.startsWith("/dashboard");

  // U-Mate: has its own layout, no UZEED chrome
  const isUmateRoute = pathname.startsWith("/umate");

  // iOS Safari: evita "auto text sizing" que agranda botones/textos
  const iosTextSizeFix: React.CSSProperties = {
    WebkitTextSizeAdjust: "100%",
  };

  if (isAuthRoute) {
    return (
      <div
        style={iosTextSizeFix}
        className="min-h-[100svh] w-full px-4 py-10"
      >
        <ScrollToTop />
        <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md items-center">
          <div className="w-full">{children}</div>
        </div>
      </div>
    );
  }

  // U-Mate: own layout, no UZEED chrome
  if (isUmateRoute) {
    return (
      <div style={iosTextSizeFix} className="min-h-[100svh] w-full text-white">
        <ScrollToTop />
        {deferredReady && <PushNotificationsManager />}
        {deferredReady && <PresenceHeartbeat />}
        {children}
      </div>
    );
  }

  // Dashboard: minimal chrome, no header/nav, just the page content
  if (isDashboardRoute) {
    return (
      <LocationFilterProvider>
        <StoryUploadProvider>
        <div
          style={iosTextSizeFix}
          className="min-h-[100svh] w-full bg-transparent text-white"
        >
          <ScrollToTop />
          {deferredReady && <PushNotificationsManager />}
          {deferredReady && <PresenceHeartbeat />}
          <main className="min-h-[100svh]">
            {children}
          </main>
        </div>
        <StoryUploadModal />
        </StoryUploadProvider>
      </LocationFilterProvider>
    );
  }

  return (
    <LocationFilterProvider>
      <ForumNotificationProvider>
        <ChatNotificationProvider>
        <StoryUploadProvider>
        <div
          style={iosTextSizeFix}
          className="flex min-h-[100svh] w-full bg-transparent text-white"
        >
          <Nav />

          <div className="relative min-w-0 flex-1">
            <ScrollToTop />
            <TopHeader />
            {deferredReady && <PushNotificationsManager />}
            {deferredReady && <PresenceHeartbeat />}
            {deferredReady && <SocialProofToast />}
            {!isHome && <BackButton />}
            {/* Reduced pt since we removed the category chips row from mobile header */}
            <main className="flex-1 px-4 pt-[76px] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-[90px] md:pb-6">
              {children}
            </main>
            <Footer />
          </div>
        </div>
        <StoryUploadModal />
        </StoryUploadProvider>
        </ChatNotificationProvider>
      </ForumNotificationProvider>
    </LocationFilterProvider>
  );
}
