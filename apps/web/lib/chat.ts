type ChatMode = "message" | "request";

export function buildChatHref(targetUserId: string, options?: { mode?: ChatMode }): string {
  const userId = String(targetUserId || "").trim();
  const params = new URLSearchParams();
  params.set("user", userId);

  if (options?.mode && options.mode !== "message") {
    params.set("mode", options.mode);
  }

  return `/chats?${params.toString()}`;
}

export function buildLoginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildCurrentPathWithSearch(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

