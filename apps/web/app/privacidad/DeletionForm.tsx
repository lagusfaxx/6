"use client";

import { useState } from "react";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";

type RequestType = "account" | "data";

export default function DeletionForm({
  type,
  title,
  description,
}: {
  type: RequestType;
  title: string;
  description: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        "/privacy/request-deletion",
        {
          method: "POST",
          body: JSON.stringify({ type, email: email.trim(), message: message.trim() }),
        },
      );
      setFeedback(res.message);
      setStatus("success");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      setFeedback(friendlyErrorMessage(err));
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{description}</p>

      {status === "success" ? (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {feedback}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">
              Correo electrónico de contacto *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">
              Mensaje o detalle adicional (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe tu solicitud..."
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-400">{feedback}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {status === "loading" ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>
      )}
    </div>
  );
}
