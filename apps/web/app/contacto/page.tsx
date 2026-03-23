"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";

type ContactCategory = "general" | "soporte" | "profesional" | "reporte";

const CATEGORIES: { value: ContactCategory; label: string }[] = [
  { value: "general", label: "Consulta general" },
  { value: "soporte", label: "Soporte técnico" },
  { value: "profesional", label: "Cuenta profesional" },
  { value: "reporte", label: "Reportar un problema" },
];

export default function ContactoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<ContactCategory>("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setStatus("loading");
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          message: message.trim(),
        }),
      });
      setFeedback("Tu mensaje ha sido enviado. Te responderemos a la brevedad.");
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      setFeedback(friendlyErrorMessage(err));
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10">
          <Mail className="h-5 w-5 text-fuchsia-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Contacto</h1>
          <p className="text-sm text-white/40">Estamos aquí para ayudarte</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mensaje enviado</h2>
              <p className="mt-1 text-sm text-white/50">{feedback}</p>
            </div>
            <button
              onClick={() => setStatus("idle")}
              className="mt-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
            >
              Enviar otro mensaje
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/40">
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/40">
                Correo electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/40">
                Categoría
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      category === c.value
                        ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/40">
                Mensaje *
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe tu consulta..."
                rows={5}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20"
              />
            </div>

            {status === "error" && feedback && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                {feedback}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              {status === "loading" ? (
                <>
                  <MessageSquare className="h-4 w-4 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar mensaje
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-white/30">
        También puedes escribirnos directamente a{" "}
        <a href="mailto:contacto@uzeed.cl" className="text-fuchsia-400/70 hover:text-fuchsia-300">
          contacto@uzeed.cl
        </a>
      </div>
    </div>
  );
}
