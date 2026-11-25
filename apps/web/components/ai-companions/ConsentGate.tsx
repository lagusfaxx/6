"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { apiErrorMessage } from "../../lib/aiCompanions";

/**
 * Antes de usar la sección: mayoría de edad (con fecha de nacimiento si la
 * cuenta no la tiene) y aceptación de las reglas.
 */
export default function ConsentGate({ hasBirthdate, onDone }: { hasBirthdate: boolean; onDone: () => void }) {
  const [birthdate, setBirthdate] = useState("");
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!accept) return setError("Debes aceptar las reglas para continuar.");
    if (!hasBirthdate && !birthdate) return setError("Indica tu fecha de nacimiento.");
    setLoading(true);
    try {
      await apiFetch("/ai-companions/consent", {
        method: "POST",
        body: JSON.stringify({ accept: true, ...(hasBirthdate ? {} : { birthdate }) }),
      });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-[#0d0e1a] p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-fuchsia-500/15">
          <ShieldCheck className="h-5 w-5 text-fuchsia-300" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">Sección para mayores de 18</h2>
          <p className="text-xs text-white/50">Acompañantes virtuales con inteligencia artificial</p>
        </div>
      </div>

      <ul className="mb-5 space-y-2 text-sm text-white/70">
        <li>• Todos los personajes son <b className="text-white">ficticios y adultos</b>, creados con IA. No son personas reales.</li>
        <li>• Está prohibido cualquier contenido que involucre a menores de edad, aunque sea ficción. Se bloquea y se revisa.</li>
        <li>• No se crean imágenes de personas reales ni parecidas a alguien real, y no se pueden subir fotos.</li>
        <li>• Todo es entre adultos que consienten: nada de violencia sexual.</li>
        <li>• Tu historial y lo que el personaje recuerda de ti son privados; puedes verlos y borrarlos cuando quieras.</li>
      </ul>

      {!hasBirthdate && (
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-white/60">Fecha de nacimiento</span>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
          />
        </label>
      )}

      <label className="mb-5 flex cursor-pointer items-start gap-3 text-sm text-white/80">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-fuchsia-500"
        />
        <span>Confirmo que soy mayor de 18 años y acepto las reglas de la sección.</span>
      </label>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar
      </button>
    </div>
  );
}
