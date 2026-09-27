"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import {
  QUICK_REPLY_MAX_LENGTH,
  QUICK_REPLY_MIN_LENGTH,
  QUICK_REPLY_TOPICS,
  type QuickReplies,
  type QuickReplyKey,
} from "../lib/quickReplies";

/**
 * Editor de respuestas rápidas en formato "pestañas": una pregunta a la vez,
 * con una vista previa de cómo lo ve el cliente en el chat. Cabe en la
 * pantalla del teléfono sin importar cuántas preguntas haya.
 *
 * `focusKey` permite abrir una pregunta desde afuera (ej. la primera que
 * falta cuando la validación falla).
 */
export default function QuickRepliesEditor({
  value,
  onChange,
  focusKey,
}: {
  value: QuickReplies;
  onChange: (next: QuickReplies) => void;
  focusKey?: QuickReplyKey | null;
}) {
  const [active, setActive] = useState<QuickReplyKey>(QUICK_REPLY_TOPICS[0].key);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusKey) {
      setActive(focusKey);
      textareaRef.current?.focus();
    }
  }, [focusKey]);

  const topic = QUICK_REPLY_TOPICS.find((t) => t.key === active) ?? QUICK_REPLY_TOPICS[0];
  const text = value[active] || "";
  const isDone = (key: QuickReplyKey) =>
    (value[key] || "").trim().length >= QUICK_REPLY_MIN_LENGTH;

  const index = QUICK_REPLY_TOPICS.findIndex((t) => t.key === active);
  const next = QUICK_REPLY_TOPICS[index + 1];

  return (
    <div className="grid gap-3">
      {/* Preguntas: se tocan para editarlas */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_REPLY_TOPICS.map((t) => {
          const selected = t.key === active;
          const done = isDone(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-pressed={selected}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-white shadow-[0_0_18px_-6px_rgba(217,70,239,0.7)]"
                  : done
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.04] text-white/60"
              }`}
            >
              {done ? (
                <Check className="h-3 w-3 text-emerald-300" />
              ) : t.required ? (
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
              ) : null}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Vista previa del chat */}
      <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">
          <Zap className="h-3 w-3 text-fuchsia-300/70" />
          Así lo verá el cliente
        </p>
        <div className="flex justify-end">
          <span className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-fuchsia-600/80 to-violet-600/80 px-3 py-1.5 text-[13px] text-white">
            {topic.question}
          </span>
        </div>
        <div className="mt-1.5 flex justify-start">
          <span
            className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-white/10 px-3 py-1.5 text-[13px] ${
              text.trim() ? "bg-white/10 text-white/85" : "bg-white/[0.03] italic text-white/30"
            }`}
          >
            {text.trim() || "Tu respuesta aparecerá aquí"}
          </span>
        </div>
      </div>

      {/* Respuesta de la pregunta activa */}
      <div className="grid gap-1.5">
        <label
          htmlFor="quick-reply-editor"
          className="flex items-center justify-between text-sm font-medium text-white/75"
        >
          <span className="flex items-center gap-2">
            {topic.label}
            {topic.required ? (
              <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                Obligatorio
              </span>
            ) : (
              <span className="text-[10px] font-normal text-white/35">Opcional</span>
            )}
          </span>
          <span className="text-[10px] font-normal text-white/30">
            {text.length}/{QUICK_REPLY_MAX_LENGTH}
          </span>
        </label>
        <textarea
          ref={textareaRef}
          id="quick-reply-editor"
          className="input min-h-[84px]"
          value={text}
          onChange={(e) =>
            onChange({ ...value, [active]: e.target.value.slice(0, QUICK_REPLY_MAX_LENGTH) })
          }
          placeholder={topic.placeholder}
          maxLength={QUICK_REPLY_MAX_LENGTH}
        />
        {next && (
          <button
            type="button"
            onClick={() => setActive(next.key)}
            className="justify-self-end text-[11px] font-medium text-fuchsia-300/80 transition hover:text-fuchsia-200"
          >
            Siguiente: {next.label} →
          </button>
        )}
      </div>
    </div>
  );
}
