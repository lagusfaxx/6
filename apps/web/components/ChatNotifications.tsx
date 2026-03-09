"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { connectRealtime } from "../lib/realtime";
import { apiFetch } from "../lib/api";
import useMe from "../hooks/useMe";

type ChatNotifCtx = {
  unreadCount: number;
  refreshUnread: () => void;
};

const Ctx = createContext<ChatNotifCtx>({ unreadCount: 0, refreshUnread: () => {} });

export function useChatNotifications() {
  return useContext(Ctx);
}

export function ChatNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname() || "/";
  const { me, loading: meLoading } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const fetchUnread = useCallback(() => {
    if (!isAuthed) return;
    apiFetch<{ count: number }>("/messages/unread-count")
      .then((r) => setUnreadCount(r.count))
      .catch(() => {});
  }, [isAuthed]);

  // Fetch unread count on mount and when auth changes
  useEffect(() => {
    if (meLoading || !isAuthed) return;
    fetchUnread();
  }, [meLoading, isAuthed, fetchUnread]);

  // Re-fetch when navigating to/from chat pages (messages get read)
  useEffect(() => {
    if (pathname.startsWith("/chat") || pathname.startsWith("/chats")) {
      // Small delay to allow readAt to be set by the API
      const timer = setTimeout(fetchUnread, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, fetchUnread]);

  // Listen for real-time message events via SSE
  useEffect(() => {
    if (meLoading || !isAuthed) return;

    const cleanup = connectRealtime((event) => {
      if (event.type === "message" && event.data?.message) {
        // A new message arrived — increment unread count
        // (unless user is currently viewing that chat)
        const msg = event.data.message;
        const isViewingChat =
          pathname === `/chat/${msg.fromId}` ||
          pathname === `/chats/${msg.fromId}`;

        if (!isViewingChat) {
          setUnreadCount((c) => c + 1);
        }
      }
    });

    return cleanup;
  }, [meLoading, isAuthed, pathname]);

  const refreshUnread = useCallback(() => {
    fetchUnread();
  }, [fetchUnread]);

  return (
    <Ctx.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </Ctx.Provider>
  );
}
