"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Brain, Camera, Crown, Image as ImageIcon, Loader2, Lock, Pencil, Send,
  Settings2, Trash2, X, Check, Plus,
} from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import {
  ACCESS_LABEL,
  apiErrorMessage,
  fetchPrivateImage,
  type AiAccount,
  type AiImage,
  type ChatMessage,
  type Companion,
  type Intensity,
  type Memory,
} from "../../../../lib/aiCompanions";
import CompanionPortrait from "../../../../components/ai-companions/CompanionPortrait";
import ConsentGate from "../../../../components/ai-companions/ConsentGate";

type ChatPayload = {
  companion: Companion;
  allowed: boolean;
  unlockedUntil: string | null;
  settings: { personality: string; intensity: Intensity; userNickname: string | null };
  hasSummary: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
};

const INTENSITY_ORDER: Intensity[] = ["suave", "picante", "explicito"];

function PrivateImage({ imageId, alt }: { imageId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetchPrivateImage(`/ai-companions/images/${imageId}/file`)
      .then((u) => {
        url = u;
        if (alive) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId]);

  if (failed) return <div className="rounded-xl bg-white/5 px-3 py-6 text-center text-xs text-white/40">Imagen no disponible</div>;
  if (!src) return <div className="aspect-[3/4] w-56 animate-pulse rounded-xl bg-white/10" />;
  return (
    <>
      <button onClick={() => setZoom(true)} className="block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-80 w-56 object-cover" />
      </button>
      {zoom && (
        <button onClick={() => setZoom(false)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-2xl" />
        </button>
      )}
    </>
  );
}

export default function CompanionChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [account, setAccount] = useState<AiAccount | null>(null);
  const [data, setData] = useState<ChatPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<null | "settings" | "image">(null);
  const [pendingImages, setPendingImages] = useState<AiImage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadAccount = useCallback(async () => {
    const a = await apiFetch<AiAccount>("/ai-companions/me");
    setAccount(a);
    return a;
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const r = await apiFetch<ChatPayload>(`/ai-companions/chats/${encodeURIComponent(slug)}`);
      setData(r);
      setMessages(r.messages);
    } catch (err: any) {
      if (err?.body?.error !== "CONSENT_REQUIRED") setLoadError(apiErrorMessage(err, "No se pudo cargar el chat."));
    }
  }, [slug]);

  useEffect(() => {
    loadAccount()
      .then((a) => {
        if (a.adultConfirmed && a.isAdult) return loadChat();
      })
      .catch((err) => setLoadError(apiErrorMessage(err, "No se pudo cargar la sección.")));
  }, [loadAccount, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, pendingImages.length]);

  /* Seguimiento de imágenes en curso. */
  useEffect(() => {
    if (!pendingImages.length) return;
    const t = setInterval(async () => {
      const still: AiImage[] = [];
      let changed = false;
      for (const img of pendingImages) {
        try {
          const r = await apiFetch<{ image: AiImage }>(`/ai-companions/images/${img.id}`);
          if (r.image.status === "PENDING") still.push(r.image);
          else {
            changed = true;
            if (r.image.status !== "DONE") setNotice(r.image.error || "No se pudo generar la imagen.");
          }
        } catch {
          still.push(img);
        }
      }
      if (changed) {
        setPendingImages(still);
        await Promise.all([loadChat(), loadAccount()]);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pendingImages, loadChat, loadAccount]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setNotice("");
    setSending(true);
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, role: "USER", content, imageId: null, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, temp]);
    setInput("");
    try {
      const r = await apiFetch<{ messages: ChatMessage[]; usage: AiAccount["usage"] }>(
        `/ai-companions/chats/${encodeURIComponent(slug)}/messages`,
        { method: "POST", body: JSON.stringify({ content }) },
      );
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), ...r.messages]);
      setAccount((a) => (a ? { ...a, usage: r.usage } : a));
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setInput(content);
      setNotice(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function loadOlder() {
    if (!messages.length) return;
    const r = await apiFetch<ChatPayload>(
      `/ai-companions/chats/${encodeURIComponent(slug)}?before=${encodeURIComponent(messages[0].createdAt)}`,
    );
    setMessages((m) => [...r.messages, ...m]);
    setData((d) => (d ? { ...d, hasMore: r.hasMore } : d));
  }

  if (loadError) {
    return (
      <div className="px-4 py-24 text-center text-sm text-white/60">
        {loadError}{" "}
        <Link href="/acompanantes-ia" className="text-fuchsia-300 underline">
          Volver
        </Link>
      </div>
    );
  }
  if (!account) return <CenteredSpinner />;
  if (!account.adultConfirmed || !account.isAdult) {
    return (
      <div className="px-4 py-10">
        <ConsentGate
          hasBirthdate={account.hasBirthdate}
          onDone={() => loadAccount().then(() => loadChat())}
        />
      </div>
    );
  }
  if (!data) return <CenteredSpinner />;

  const c = data.companion;

  if (!data.allowed) {
    return <LockedView companion={c} account={account} onUnlocked={() => Promise.all([loadAccount(), loadChat()])} />;
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-3xl flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <Link href={`/acompanantes-ia/${c.slug}`} className="text-white/60 hover:text-white" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <CompanionPortrait name={c.name} gender={c.gender} src={c.avatarUrl} className="h-10 w-10" rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{c.name}</p>
          <p className="truncate text-[11px] text-white/45">
            IA · {c.personalities.find((p) => p.key === data.settings.personality)?.label || "Personaje"} ·{" "}
            {account.usage.messagesLeft} mensajes hoy
          </p>
        </div>
        <button onClick={() => setPanel("image")} className="rounded-full bg-white/5 p-2 text-white/70 hover:bg-white/10" aria-label="Pedir foto">
          <Camera className="h-5 w-5" />
        </button>
        <button onClick={() => setPanel("settings")} className="rounded-full bg-white/5 p-2 text-white/70 hover:bg-white/10" aria-label="Ajustes y memoria">
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {data.hasMore && (
          <button onClick={loadOlder} className="mx-auto block rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
            Ver mensajes anteriores
          </button>
        )}
        {messages.length === 0 && (
          <div className="mx-auto max-w-sm py-10 text-center">
            <CompanionPortrait name={c.name} gender={c.gender} src={c.avatarUrl} className="mx-auto mb-3 h-20 w-20" rounded="rounded-full" />
            <p className="text-sm text-white/70">Saluda a {c.name} para empezar.</p>
            <p className="mt-1 text-xs text-white/40">{c.tagline}</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "USER" ? "rounded-br-md bg-fuchsia-600 text-white" : "rounded-bl-md bg-white/[0.07] text-white/90"
              }`}
            >
              {m.imageId && m.role === "ASSISTANT" && (
                <div className="mb-2">
                  <PrivateImage imageId={m.imageId} alt={c.name} />
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
        {pendingImages.map((img) => (
          <div key={img.id} className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/[0.07] px-3.5 py-2.5 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" /> {c.name} está preparando tu foto…
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Entrada */}
      <div className="border-t border-white/10 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        {notice && (
          <p className="mb-2 flex items-start justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span>
              {notice}{" "}
              {/plan|tokens/i.test(notice) && (
                <Link href="/acompanantes-ia/planes" className="font-semibold underline">
                  Ver planes
                </Link>
              )}
            </span>
            <button onClick={() => setNotice("")} aria-label="Cerrar">
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
        {!account.features.chat && (
          <p className="mb-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">El chat con IA no está disponible en este momento.</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Escríbele a ${c.name}…`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-fuchsia-400/50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim() || !account.features.chat}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {panel === "settings" && (
        <SettingsPanel
          slug={c.slug}
          companion={c}
          account={account}
          settings={data.settings}
          onClose={() => setPanel(null)}
          onSettings={(s) => setData((d) => (d ? { ...d, settings: s } : d))}
          onCleared={() => {
            setMessages([]);
            setPanel(null);
          }}
        />
      )}
      {panel === "image" && (
        <ImagePanel
          slug={c.slug}
          companion={c}
          account={account}
          defaultIntensity={data.settings.intensity}
          onClose={() => setPanel(null)}
          onQueued={(img, balance) => {
            setPendingImages((p) => [...p, img]);
            setMessages((m) => [
              ...m,
              { id: `img-${img.id}`, role: "USER", content: `📸 ${img.request}`, imageId: null, createdAt: img.createdAt },
            ]);
            setAccount((a) => (a ? { ...a, walletBalance: balance } : a));
            setPanel(null);
          }}
        />
      )}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-fuchsia-300/60" />
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0e1a] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LockedView({ companion, account, onUnlocked }: { companion: Companion; account: AiAccount; onUnlocked: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function unlock() {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/ai-companions/unlock/${encodeURIComponent(companion.slug)}`, { method: "POST" });
      onUnlocked();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <CompanionPortrait name={companion.name} gender={companion.gender} src={companion.avatarUrl} className="mx-auto mb-4 h-28 w-28" rounded="rounded-full" />
      <h1 className="text-xl font-bold text-white">{companion.name}</h1>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/60">
        <Lock className="h-4 w-4" />
        {companion.access === "EXCLUSIVE"
          ? "Personaje exclusivo"
          : `Disponible con el plan ${ACCESS_LABEL[companion.access]}`}
      </p>
      <div className="mt-6 space-y-2">
        {companion.access === "EXCLUSIVE" && companion.unlockTokens > 0 && (
          <button
            onClick={unlock}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Desbloquear por {companion.unlockTokens} tokens · {companion.unlockDays} días
          </button>
        )}
        <Link
          href="/acompanantes-ia/planes"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black"
        >
          <Crown className="h-4 w-4" /> Ver planes
        </Link>
        <p className="pt-1 text-xs text-white/45">
          Saldo: {account.walletBalance} tokens ·{" "}
          <Link href="/wallet" className="underline">
            Recargar
          </Link>
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function SettingsPanel({
  slug, companion, account, settings, onClose, onSettings, onCleared,
}: {
  slug: string;
  companion: Companion;
  account: AiAccount;
  settings: ChatPayload["settings"];
  onClose: () => void;
  onSettings: (s: ChatPayload["settings"]) => void;
  onCleared: () => void;
}) {
  const [personality, setPersonality] = useState(settings.personality);
  const [intensity, setIntensity] = useState<Intensity>(settings.intensity);
  const [nickname, setNickname] = useState(settings.userNickname || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [memLimit, setMemLimit] = useState(0);
  const [autoMemory, setAutoMemory] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);

  const maxIdx = INTENSITY_ORDER.indexOf(account.features.maxChatIntensity);
  const enc = encodeURIComponent(slug);

  const loadMemories = useCallback(async () => {
    const r = await apiFetch<{ memories: Memory[]; summary: string | null; limit: number; autoMemory: boolean }>(
      `/ai-companions/chats/${enc}/memories`,
    );
    setMemories(r.memories);
    setSummary(r.summary);
    setMemLimit(r.limit);
    setAutoMemory(r.autoMemory);
  }, [enc]);

  useEffect(() => {
    loadMemories().catch(() => setMemories([]));
  }, [loadMemories]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await apiFetch<{ settings: ChatPayload["settings"] }>(`/ai-companions/chats/${enc}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ personality, intensity, userNickname: nickname }),
      });
      onSettings(r.settings);
      setMsg("Guardado");
    } catch (err) {
      setMsg(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addMemory() {
    if (!newMemory.trim()) return;
    try {
      await apiFetch(`/ai-companions/chats/${enc}/memories`, { method: "POST", body: JSON.stringify({ content: newMemory }) });
      setNewMemory("");
      await loadMemories();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await apiFetch(`/ai-companions/memories/${editing.id}`, { method: "PATCH", body: JSON.stringify({ content: editing.content }) });
      setEditing(null);
      await loadMemories();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  }

  async function removeMemory(id: string) {
    await apiFetch(`/ai-companions/memories/${id}`, { method: "DELETE" });
    await loadMemories();
  }

  async function clearSummary() {
    await apiFetch(`/ai-companions/chats/${enc}/summary`, { method: "DELETE" });
    setSummary(null);
  }

  async function clearChat(withMemories: boolean) {
    const text = withMemories
      ? `¿Borrar todo el historial y todo lo que ${companion.name} recuerda de ti?`
      : "¿Borrar el historial de esta conversación?";
    if (!window.confirm(text)) return;
    await apiFetch(`/ai-companions/chats/${enc}${withMemories ? "?memories=1" : ""}`, { method: "DELETE" });
    onCleared();
  }

  return (
    <Sheet title="Ajustes y memoria" onClose={onClose}>
      <section className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">Personalidad</label>
          <div className="flex flex-wrap gap-1.5">
            {companion.personalities.map((p) => (
              <button
                key={p.key}
                onClick={() => setPersonality(p.key)}
                title={p.description}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  personality === p.key ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">Intensidad</label>
          <div className="flex gap-1.5">
            {account.intensities.map((i, idx) => (
              <button
                key={i.key}
                disabled={idx > maxIdx}
                onClick={() => setIntensity(i.key)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-30 ${
                  intensity === i.key ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">¿Cómo quieres que te llame?</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={40}
            placeholder="Tu nombre o apodo"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {msg && <span className="text-xs text-white/60">{msg}</span>}
        </div>
      </section>

      <hr className="my-5 border-white/10" />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-white">
            <Brain className="h-4 w-4 text-fuchsia-300" /> Lo que {companion.name} recuerda
          </h4>
          <span className="text-[11px] text-white/40">
            {memories?.length ?? 0}/{memLimit}
          </span>
        </div>
        <p className="mb-3 text-xs text-white/45">
          {autoMemory
            ? "Con tu plan, la IA también anota sola datos importantes de la conversación. Puedes corregirlos o borrarlos."
            : "Agrega datos que quieras que recuerde. Con Premium o VIP los anota sola."}
        </p>

        <div className="mb-3 flex gap-2">
          <input
            value={newMemory}
            onChange={(e) => setNewMemory(e.target.value)}
            maxLength={300}
            placeholder="Ej: Me llamo Javier y trabajo de noche"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
          />
          <button onClick={addMemory} className="rounded-xl bg-white/10 px-3 text-white" aria-label="Agregar recuerdo">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-1.5">
          {memories === null && <li className="text-xs text-white/40">Cargando…</li>}
          {memories?.length === 0 && <li className="text-xs text-white/40">Aún no recuerda nada.</li>}
          {memories?.map((m) => (
            <li key={m.id} className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/80">
              {editing?.id === m.id ? (
                <>
                  <input
                    value={editing.content}
                    onChange={(e) => setEditing({ id: m.id, content: e.target.value })}
                    maxLength={300}
                    className="flex-1 rounded-lg bg-white/10 px-2 py-1 text-sm text-white outline-none"
                  />
                  <button onClick={saveEdit} aria-label="Guardar">
                    <Check className="h-4 w-4 text-emerald-300" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1">
                    {m.content}
                    {m.source === "auto" && <span className="ml-1.5 text-[10px] uppercase text-fuchsia-300/70">auto</span>}
                  </span>
                  <button onClick={() => setEditing({ id: m.id, content: m.content })} aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5 text-white/40" />
                  </button>
                  <button onClick={() => removeMemory(m.id)} aria-label="Borrar">
                    <Trash2 className="h-3.5 w-3.5 text-white/40" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {summary && (
          <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Resumen de conversaciones</span>
              <button onClick={clearSummary} className="text-[11px] text-white/45 underline">
                Borrar
              </button>
            </div>
            <p className="text-xs text-white/65">{summary}</p>
          </div>
        )}
      </section>

      <hr className="my-5 border-white/10" />

      <section className="space-y-2">
        <button onClick={() => clearChat(false)} className="w-full rounded-xl bg-white/5 py-2.5 text-sm text-white/75">
          Borrar historial
        </button>
        <button onClick={() => clearChat(true)} className="w-full rounded-xl bg-red-500/10 py-2.5 text-sm text-red-300">
          Borrar historial y memoria
        </button>
      </section>
    </Sheet>
  );
}

function ImagePanel({
  slug, companion, account, defaultIntensity, onClose, onQueued,
}: {
  slug: string;
  companion: Companion;
  account: AiAccount;
  defaultIntensity: Intensity;
  onClose: () => void;
  onQueued: (img: AiImage, balance: number) => void;
}) {
  const maxIdx = INTENSITY_ORDER.indexOf(account.features.maxImageIntensity);
  const [request, setRequest] = useState("");
  const [intensity, setIntensity] = useState<Intensity>(
    INTENSITY_ORDER.indexOf(defaultIntensity) > maxIdx ? account.features.maxImageIntensity : defaultIntensity,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ideas = ["Selfie en un café al atardecer", "Retrato en la playa con vestido blanco", "Foto casual en casa con polerón", "Sesión elegante con vestido negro"];

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch<{ image: AiImage; walletBalance: number }>(`/ai-companions/chats/${encodeURIComponent(slug)}/images`, {
        method: "POST",
        body: JSON.stringify({ request, intensity }),
      });
      onQueued(r.image, r.walletBalance);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet title={`Pedir una foto a ${companion.name}`} onClose={onClose}>
      {!account.features.images ? (
        <p className="text-sm text-white/60">La generación de imágenes no está disponible en este momento.</p>
      ) : (
        <>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Describe la foto: ropa, lugar, pose…"
            className="mb-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
          />
          <div className="mb-4 flex flex-wrap gap-1.5">
            {ideas.map((i) => (
              <button key={i} onClick={() => setRequest(i)} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                {i}
              </button>
            ))}
          </div>

          <div className="mb-4 flex gap-1.5">
            {account.intensities.map((i, idx) => (
              <button
                key={i.key}
                disabled={idx > maxIdx}
                onClick={() => setIntensity(i.key)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-30 ${
                  intensity === i.key ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>

          <p className="mb-3 text-[11px] text-white/45">
            Siempre es {companion.name}: la apariencia del personaje se mantiene. No se pueden subir fotos ni pedir imágenes de
            personas reales.
          </p>

          {error && (
            <p className="mb-3 text-sm text-red-400">
              {error}{" "}
              {/tokens/i.test(error) && (
                <Link href="/wallet" className="underline">
                  Recargar
                </Link>
              )}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading || request.trim().length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Generar · {account.imageTokens} {account.imageTokens === 1 ? "token" : "tokens"}
          </button>
          <p className="mt-2 text-center text-[11px] text-white/40">Saldo: {account.walletBalance} tokens</p>
        </>
      )}
    </Sheet>
  );
}
