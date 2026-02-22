type ChatMode = "message" | "request";

export function buildChatHref(targetUserId: string, options?: { mode?: ChatMode }): string {
  const userId = String(targetUserId || "").trim();
  const base = `/chat/${userId}`;

  if (options?.mode && options.mode !== "message") {
    return `${base}?mode=${options.mode}`;
  }

  return base;
}

export function buildLoginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildCurrentPathWithSearch(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

