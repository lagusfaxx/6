"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

const hearts = [1, 2, 3, 4, 5];

export default function RateProfessionalPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = String(params.serviceId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/services/${serviceId}/review`, {
        method: "POST",
        body: JSON.stringify({ hearts: rating, comment })
      });
      router.push("/servicios");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Calificar profesional</h1>
        <p className="mt-2 text-sm text-white/70">Usa corazones para valorar el servicio recibido.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 grid gap-4">
        <div>
          <div className="text-sm font-medium">Rating</div>
          <div className="mt-2 flex gap-2">
            {hearts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`h-10 w-10 rounded-full border text-lg ${
                  value <= rating ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"
                }`}
              >
                ♥
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-2 text-sm">
          Comentario (opcional)
          <textarea
            className="input min-h-[120px]"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comparte tu experiencia"
          />
        </label>

        <button className="btn-primary" disabled={saving}>
          {saving ? "Enviando..." : "Enviar calificación"}
        </button>
      </form>
    </div>
  );
}
