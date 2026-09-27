"use client";

import {
  QUICK_REPLY_MAX_LENGTH,
  QUICK_REPLY_TOPICS,
  type QuickReplies,
  type QuickReplyKey,
} from "../lib/quickReplies";

/**
 * Campos de las respuestas rápidas (tarifa, servicios, horario...). Se usa en
 * el registro y en la configuración de la cuenta.
 */
export default function QuickRepliesFields({
  value,
  onChange,
  compact = false,
}: {
  value: QuickReplies;
  onChange: (next: QuickReplies) => void;
  compact?: boolean;
}) {
  const set = (key: QuickReplyKey, text: string) =>
    onChange({ ...value, [key]: text.slice(0, QUICK_REPLY_MAX_LENGTH) });

  return (
    <div className="grid gap-3">
      {QUICK_REPLY_TOPICS.map((t) => (
        <div key={t.key} className="grid gap-1.5">
          <label
            htmlFor={`quick-reply-${t.key}`}
            className={`flex items-center gap-2 font-medium text-white/75 ${compact ? "text-[12px]" : "text-sm"}`}
          >
            {t.label}
            {t.required ? (
              <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                Obligatorio
              </span>
            ) : (
              <span className="text-[10px] font-normal text-white/35">Opcional</span>
            )}
          </label>
          <textarea
            id={`quick-reply-${t.key}`}
            className={`input ${compact ? "min-h-[64px] text-[13px]" : "min-h-[72px]"}`}
            value={value[t.key] || ""}
            onChange={(e) => set(t.key, e.target.value)}
            placeholder={t.placeholder}
            maxLength={QUICK_REPLY_MAX_LENGTH}
          />
          <p className="text-[10px] text-white/30">
            El cliente toca “{t.question}” y recibe esto al instante.
          </p>
        </div>
      ))}
    </div>
  );
}
