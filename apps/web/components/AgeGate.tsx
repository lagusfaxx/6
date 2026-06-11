"use client";

import { useEffect, useState } from "react";

/**
 * Verificación de mayoría de edad para usuarios nuevos.
 * Se muestra una sola vez por dispositivo (localStorage). "Soy menor"
 * redirige fuera del sitio. Fondo: /brand/age-gate-bg.jpg (opcional —
 * sin la imagen queda el degradado oscuro).
 */

const STORAGE_KEY = "uzeed:ageVerified";

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // storage bloqueado (modo privacidad extremo): pedir confirmación igual
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // sin storage: al menos deja pasar en esta visita
    }
    setShow(false);
  };

  const reject = () => {
    window.location.href = "https://www.google.com";
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
    >
      {/* Fondo: foto oscurecida (con fallback a degradado si no existe) */}
      <div className="absolute inset-0 bg-[#0a0612]">
        <img
          src="/brand/age-gate-bg.jpg"
          alt=""
          aria-hidden
          className="h-full w-full object-cover opacity-75"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/75" />
      </div>

      {/* Tarjeta */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0b16]/90 p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-9">
        <h1 id="age-gate-title" className="text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]">
          ¿Tienes más de 18 años?
        </h1>
        <p className="mx-auto mt-2.5 max-w-xs text-xs leading-relaxed text-white/45">
          Este sitio contiene contenido para adultos. Al continuar confirmas que
          eres mayor de edad y aceptas nuestros{" "}
          <a href="/terminos" className="text-fuchsia-300/80 underline-offset-2 hover:underline">
            términos y condiciones
          </a>
          .
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={accept}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_40px_rgba(139,92,246,0.35)] transition hover:brightness-110 active:scale-[0.99]"
          >
            Sí, soy mayor de 18 años
          </button>
          <button
            type="button"
            onClick={reject}
            className="w-full rounded-2xl border border-violet-400/40 bg-transparent px-6 py-3.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.05]"
          >
            Soy menor de 18 años
          </button>
        </div>
      </div>
    </div>
  );
}
