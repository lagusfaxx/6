"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { apiFetch } from "../lib/api";

type Prefs = {
  promoteOnX: boolean;
  isProfessional: boolean;
  posted: boolean;
};

/**
 * Permiso para que UZEED anuncie el perfil en su cuenta de X.
 *
 * Solo se muestra a perfiles profesionales: es lo único que se anuncia. Si el
 * post ya salió se dice, porque apagar el interruptor frena los anuncios
 * futuros pero no retira uno publicado.
 */
export default function XPromotionToggle() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<Prefs>("/profile/social-preferences")
      .then((r) => { if (alive && r) setPrefs(r); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const toggle = useCallback(async () => {
    if (!prefs || saving) return;
    const next = !prefs.promoteOnX;
    setSaving(true);
    setError(false);
    // Optimista: el interruptor responde al toque y se revierte si falla.
    setPrefs({ ...prefs, promoteOnX: next });
    try {
      const r = await apiFetch<{ promoteOnX: boolean }>(
        "/profile/social-preferences",
        { method: "PATCH", body: JSON.stringify({ promoteOnX: next }) },
      );
      setPrefs((prev) => (prev ? { ...prev, promoteOnX: Boolean(r?.promoteOnX) } : prev));
    } catch {
      setPrefs((prev) => (prev ? { ...prev, promoteOnX: !next } : prev));
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [prefs, saving]);

  if (!prefs && !error) {
    return <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />;
  }
  // Sin datos, o cuenta de cliente: no hay nada que anunciar.
  if (!prefs || !prefs.isProfessional) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <Megaphone className="h-4 w-4 shrink-0 text-white/30" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Anunciar mi perfil en X</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">
            {prefs.posted
              ? "Tu perfil ya se anunció. Apagarlo evita anuncios futuros; para borrar el publicado, escríbenos."
              : "Publicamos tu nombre, ciudad, foto de portada y el enlace a tu perfil. Nada más."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.promoteOnX}
          aria-label="Anunciar mi perfil en X"
          onClick={toggle}
          disabled={saving}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            prefs.promoteOnX ? "bg-fuchsia-600" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              prefs.promoteOnX ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px] text-red-300">
          No se pudo guardar la preferencia. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
