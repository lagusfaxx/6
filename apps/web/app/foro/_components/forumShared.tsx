import type { ReactNode } from "react";

export type ForumAuthor = {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl: string | null;
};

export type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  threadCount: number;
};

export type FeedThread = {
  id: string;
  title: string;
  excerpt: string;
  author: ForumAuthor;
  category: { id: string; name: string; slug: string };
  replyCount: number;
  views: number;
  isPinned: boolean;
  isLocked: boolean;
  isOfficial: boolean;
  lastPostAt: string;
  createdAt: string;
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function authorName(a: ForumAuthor | null | undefined) {
  return a?.displayName || a?.username || "Usuario";
}

/**
 * Borradores del foro en sessionStorage: si alguien escribe sin sesión, se
 * guarda lo escrito, se va a iniciar sesión y al volver lo encuentra ahí.
 */
export function loadDraft(key: string): string {
  try {
    return sessionStorage.getItem(`forum-draft:${key}`) || "";
  } catch {
    return "";
  }
}

export function saveDraft(key: string, value: string) {
  try {
    if (value) sessionStorage.setItem(`forum-draft:${key}`, value);
    else sessionStorage.removeItem(`forum-draft:${key}`);
  } catch {}
}

export function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Texto de un post: las líneas que empiezan con ">" se muestran como cita. */
export function PostContent({ content }: { content: string }) {
  const blocks: { quote: boolean; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    const quote = line.trimStart().startsWith(">");
    const text = quote ? line.trimStart().replace(/^>\s?/, "") : line;
    const last = blocks[blocks.length - 1];
    if (last && last.quote === quote) last.lines.push(text);
    else blocks.push({ quote, lines: [text] });
  }

  const out: ReactNode[] = blocks.map((b, i) => {
    const text = b.lines.join("\n").replace(/^\n+|\n+$/g, "");
    if (!text) return null;
    return b.quote ? (
      <blockquote
        key={i}
        className="my-2 border-l-2 border-fuchsia-500/40 bg-white/[0.03] py-1.5 pl-3 pr-2 text-[13px] text-white/50 rounded-r-lg"
      >
        {text}
      </blockquote>
    ) : (
      <p key={i} className="whitespace-pre-wrap">
        {text}
      </p>
    );
  });

  return <div className="space-y-1 break-words text-[15px] leading-relaxed text-white/80">{out}</div>;
}
