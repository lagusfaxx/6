"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  Pin,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";
import {
  authorName,
  loadDraft,
  loginHref,
  saveDraft,
  timeAgo,
  type FeedThread,
  type ForumCategory,
} from "./forumShared";

type Kind = "community" | "profiles";
type Sort = "latest" | "newest" | "replies";

const SORTS: { id: Sort; label: string }[] = [
  { id: "latest", label: "Activos" },
  { id: "newest", label: "Nuevos" },
  { id: "replies", label: "Más comentados" },
];

/** Ideas para romper el hielo cuando todavía no hay conversaciones. */
const STARTERS: { title: string; slug: string }[] = [
  { title: "¿Qué motel recomiendan en Santiago?", slug: "moteles" },
  { title: "Consejos para una primera cita segura", slug: "consejos" },
  { title: "¿Alguna masajista recomendada en Providencia?", slug: "masajes" },
  { title: "Cuenten su mejor experiencia (sin datos personales)", slug: "experiencias" },
  { title: "Hola, soy nuevo en UZEED 👋", slug: "general" },
];

const DRAFT_KEY = "new-thread";

export default function ForumFeed({ initialCategory = "" }: { initialCategory?: string }) {
  const router = useRouter();
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [kind, setKind] = useState<Kind>("community");
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<Sort>("latest");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const [threads, setThreads] = useState<FeedThread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [composerCat, setComposerCat] = useState(initialCategory);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ categories: ForumCategory[] }>("/forum/categories")
      .then((r) => setCategories(r.categories))
      .catch(() => {});
  }, []);

  // Borrador guardado antes de ir a iniciar sesión.
  useEffect(() => {
    const raw = loadDraft(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setTitle(d.title || "");
      setDetails(d.details || "");
      if (d.slug) setComposerCat(d.slug);
      setComposerOpen(true);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // La URL sigue a la categoría elegida, para poder compartirla.
  useEffect(() => {
    const path = category ? `/foro/categoria/${encodeURIComponent(category)}` : "/foro";
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [category]);

  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ kind, sort, page: String(p) });
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      return `/forum/threads?${params.toString()}`;
    },
    [kind, sort, category, q]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    apiFetch<{ threads: FeedThread[]; total: number; page: number; pages: number }>(buildQuery(1))
      .then((r) => {
        if (cancelled) return;
        setThreads(r.threads);
        setTotal(r.total);
        setPage(1);
        setPages(r.pages);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildQuery]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const r = await apiFetch<{ threads: FeedThread[]; pages: number }>(buildQuery(page + 1));
      setThreads((prev) => [...prev, ...r.threads.filter((t) => !prev.some((p) => p.id === t.id))]);
      setPage(page + 1);
      setPages(r.pages);
    } catch {}
    setLoadingMore(false);
  };

  // Tiempo real: temas nuevos y respuestas.
  const liveFilter = useRef({ kind, category, q, sort });
  liveFilter.current = { kind, category, q, sort };
  useEffect(() => {
    return connectRealtime(({ type, data }) => {
      if (!data) return;
      const f = liveFilter.current;
      if (type === "forum:newThread" && data.id) {
        if (f.kind !== "community" || f.q) return;
        if (f.category && data.category?.slug !== f.category) return;
        const t: FeedThread = {
          id: data.id,
          title: data.title,
          excerpt: data.excerpt || "",
          author: data.author,
          category: data.category,
          replyCount: 0,
          views: 0,
          isPinned: false,
          isLocked: false,
          isOfficial: false,
          lastPostAt: data.createdAt ?? new Date().toISOString(),
          createdAt: data.createdAt ?? new Date().toISOString(),
        };
        setThreads((prev) => (prev.some((p) => p.id === t.id) ? prev : [t, ...prev]));
        setTotal((n) => n + 1);
      }
      if (type === "forum:newPost" && data.threadId) {
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.id === data.threadId);
          if (idx === -1) return prev;
          const updated = {
            ...prev[idx],
            replyCount: prev[idx].replyCount + 1,
            lastPostAt: data.post?.createdAt ?? new Date().toISOString(),
          };
          const rest = prev.filter((_, i) => i !== idx);
          if (f.sort !== "latest" || updated.isPinned) return prev.map((t, i) => (i === idx ? updated : t));
          const firstUnpinned = rest.findIndex((t) => !t.isPinned);
          const at = firstUnpinned === -1 ? rest.length : firstUnpinned;
          return [...rest.slice(0, at), updated, ...rest.slice(at)];
        });
      }
    });
  }, []);

  const openComposer = (preset?: { title: string; slug: string }) => {
    if (preset) {
      setTitle(preset.title);
      if (categories.some((c) => c.slug === preset.slug)) setComposerCat(preset.slug);
    }
    setComposerOpen(true);
    setPostError("");
    setTimeout(() => titleRef.current?.focus(), 30);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setPostError("");
  };

  const handlePost = async () => {
    const t = title.trim();
    if (t.length < 5) {
      setPostError("Escribe al menos 5 caracteres.");
      return;
    }
    if (!isAuthed) {
      saveDraft(DRAFT_KEY, JSON.stringify({ title, details, slug: composerCat }));
      router.push(loginHref(window.location.pathname));
      return;
    }
    const cat = categories.find((c) => c.slug === composerCat);
    setPosting(true);
    setPostError("");
    try {
      const res = await apiFetch<{ thread: { id: string } }>("/forum/threads", {
        method: "POST",
        body: JSON.stringify({ title: t, content: details.trim(), categoryId: cat?.id }),
      });
      saveDraft(DRAFT_KEY, "");
      router.push(`/foro/thread/${res.thread.id}`);
    } catch (err) {
      setPostError(friendlyErrorMessage(err));
      setPosting(false);
    }
  };

  const activeCategory = useMemo(() => categories.find((c) => c.slug === category), [categories, category]);
  const selectableCategories = categories;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      {/* Header */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          {activeCategory ? activeCategory.name : "Foro"}
        </h1>
        <p className="mt-1 text-sm text-white/45">
          {activeCategory?.description ||
            "Pregunta, recomienda y comenta con la comunidad. Solo se muestra tu nickname."}
        </p>
      </header>

      {/* Composer */}
      {kind === "community" && (
        <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => openComposer()}
              className="flex w-full items-center gap-3 text-left"
            >
              <Avatar src={me?.user?.avatarUrl} alt={me?.user?.username || "Tú"} size={36} />
              <span className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-white/40 transition hover:border-fuchsia-500/30">
                ¿Qué quieres preguntar o compartir?
              </span>
            </button>
          ) : (
            <div>
              <div className="flex items-start gap-3">
                <Avatar src={me?.user?.avatarUrl} alt={me?.user?.username || "Tú"} size={36} />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Tu pregunta o tema, ej: ¿Qué motel recomiendan en Ñuñoa?"
                    maxLength={200}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/30 outline-none transition focus:border-fuchsia-500/40"
                  />
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost();
                    }}
                    placeholder="Detalles (opcional)"
                    rows={3}
                    maxLength={10000}
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-fuchsia-500/40"
                  />
                </div>
              </div>

              {selectableCategories.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:pl-12">
                  <span className="mr-1 text-[11px] text-white/35">Categoría:</span>
                  {selectableCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setComposerCat(composerCat === c.slug ? "" : c.slug)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        composerCat === c.slug
                          ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
                          : "border-white/[0.08] text-white/50 hover:text-white/80"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {postError && <p className="mt-3 text-xs text-red-400 sm:pl-12">{postError}</p>}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="rounded-xl px-3 py-2 text-sm text-white/50 transition hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={posting || !title.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {isAuthed ? "Publicar" : "Inicia sesión y publica"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(
          [
            { id: "community", label: "Conversaciones", icon: MessageSquare },
            { id: "profiles", label: "Opiniones de perfiles", icon: UserRound },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setKind(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
              kind === tab.id ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/70"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={kind === "profiles" ? "Busca un perfil por nombre o @usuario" : "Buscar en el foro"}
          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-fuchsia-500/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/40 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
          <Chip active={!category} onClick={() => setCategory("")}>
            Todas
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar"
          className="rounded-lg border border-white/[0.08] bg-[#0d0e1a] px-2.5 py-1.5 text-xs text-white/70 outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/50">
          {loadError}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          kind={kind}
          searching={Boolean(q)}
          categories={categories}
          category={category}
          onStart={openComposer}
          onClear={() => setSearch("")}
        />
      ) : (
        <>
          <p className="mb-2 text-[11px] text-white/35">
            {total} {total === 1 ? "tema" : "temas"}
          </p>
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                {t.isOfficial ? <ProfileThreadRow t={t} /> : <ThreadRow t={t} showCategory={!category} />}
              </li>
            ))}
          </ul>
          {page < pages && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] py-3 text-sm text-white/60 transition hover:bg-white/[0.05]"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Ver más
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
          : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function ThreadRow({ t, showCategory }: { t: FeedThread; showCategory: boolean }) {
  return (
    <Link
      href={`/foro/thread/${t.id}`}
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-fuchsia-500/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-3">
        <Avatar src={t.author.avatarUrl} alt={t.author.username} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/40">
            <span className="font-medium text-white/65">{authorName(t.author)}</span>
            <span>·</span>
            <span>{timeAgo(t.createdAt)}</span>
            {showCategory && t.category && (
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-white/45">{t.category.name}</span>
            )}
            {t.isPinned && <Pin className="h-3 w-3 text-amber-400" aria-label="Fijado" />}
            {t.isLocked && <Lock className="h-3 w-3 text-red-400" aria-label="Cerrado" />}
          </div>
          <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white/90 group-hover:text-fuchsia-200">
            {t.title}
          </h2>
          {t.excerpt && t.excerpt !== t.title && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/50">{t.excerpt}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[12px] text-white/40">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {t.replyCount === 0 ? "Responder" : `${t.replyCount} ${t.replyCount === 1 ? "respuesta" : "respuestas"}`}
            </span>
            {t.replyCount > 0 && <span>Última {timeAgo(t.lastPostAt)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProfileThreadRow({ t }: { t: FeedThread }) {
  return (
    <Link
      href={`/foro/thread/${t.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-fuchsia-500/20 hover:bg-white/[0.04]"
    >
      <Avatar src={t.author.avatarUrl} alt={t.author.username} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/90 group-hover:text-fuchsia-200">
          {authorName(t.author)}
        </p>
        <p className="truncate text-[12px] text-white/40">
          @{t.author.username} · {t.category?.name}
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/60 group-hover:border-fuchsia-500/30 group-hover:text-fuchsia-200">
        {t.replyCount > 0 ? `${t.replyCount} ${t.replyCount === 1 ? "opinión" : "opiniones"}` : "Opinar"}
      </span>
    </Link>
  );
}

function EmptyState({
  kind,
  searching,
  categories,
  category,
  onStart,
  onClear,
}: {
  kind: Kind;
  searching: boolean;
  categories: ForumCategory[];
  category: string;
  onStart: (preset?: { title: string; slug: string }) => void;
  onClear: () => void;
}) {
  if (searching) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/55">No encontramos resultados.</p>
        <button type="button" onClick={onClear} className="mt-2 text-xs text-fuchsia-400 hover:text-fuchsia-300">
          Limpiar búsqueda
        </button>
      </div>
    );
  }

  if (kind === "profiles") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/55">
        Aún no hay perfiles en esta categoría.
      </div>
    );
  }

  const slugs = new Set(categories.map((c) => c.slug));
  const starters = STARTERS.filter((s) => (category ? s.slug === category : true) && (slugs.size === 0 || slugs.has(s.slug)));
  const list = starters.length ? starters : STARTERS.filter((s) => slugs.size === 0 || slugs.has(s.slug)).slice(0, 3);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-fuchsia-500/[0.05] to-transparent p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/10">
        <Sparkles className="h-5 w-5 text-fuchsia-300" />
      </div>
      <p className="text-base font-semibold text-white/90">Todavía no hay conversaciones aquí</p>
      <p className="mt-1 text-sm text-white/45">Abre el primer tema. Toca una idea para empezar:</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {list.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onStart(s)}
            className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-xs text-white/70 transition hover:border-fuchsia-500/40 hover:text-white"
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
