"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Loader2,
  Phone,
  ScanFace,
  ShieldCheck,
} from "lucide-react";

/**
 * Paso final del registro de un profesional: verificación de identidad.
 * Si el proveedor (Didit) está configurado, muestra el test de identidad
 * (escaneo de cédula + selfie con prueba de vida). Si no, cae al mensaje de
 * verificación telefónica manual como respaldo.
 */
export default function IdentityVerificationStep() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ configured: boolean }>("/verification/identity/status")
      .then((r) => setConfigured(Boolean(r?.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const r = await apiFetch<{ url: string }>("/verification/identity/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (r?.url) {
        window.location.href = r.url;
      } else {
        setError("No se pudo iniciar la verificación. Intenta de nuevo.");
        setStarting(false);
      }
    } catch {
      setError("No se pudo iniciar la verificación. Intenta de nuevo.");
      setStarting(false);
    }
  };

  // Mientras carga la config, evita parpadeo mostrando un placeholder neutro
  if (configured === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  // Respaldo: proveedor no configurado → verificación manual
  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/30 to-orange-500/20">
          <Clock className="h-8 w-8 text-amber-300" />
        </div>
        <h2 className="text-xl font-bold text-amber-100">Registro recibido</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/70">
          Tu perfil ha sido creado. Para aparecer en la plataforma, un administrador
          verificará tu cuenta mediante una llamada telefónica.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
          <Phone className="h-3.5 w-3.5" />
          <span>Verificación telefónica manual</span>
        </div>
      </div>
    );
  }

  // Test de identidad automatizado
  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/5 p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-400/25 to-violet-500/20">
        <ScanFace className="h-8 w-8 text-fuchsia-200" />
      </div>
      <h2 className="text-xl font-bold">Último paso: verifica tu identidad</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/70">
        Escanea tu cédula y haz una selfie. Toma 1 minuto y tu perfil obtiene el sello{" "}
        <strong className="text-emerald-300">Verificada</strong>, que genera más confianza y más contactos.
      </p>

      <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-[13px] text-white/65">
        <li className="flex items-center gap-2.5"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Sello verificada al instante</li>
        <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Tu documento lo procesa un proveedor seguro</li>
        <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 shrink-0 text-emerald-400" /> Sin llamadas ni esperas</li>
      </ul>

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] bg-left px-6 py-3.5 text-sm font-bold transition-[background-position] duration-500 hover:bg-right disabled:cursor-not-allowed disabled:opacity-50"
      >
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
        Verificar mi identidad ahora
      </button>
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

      <Link
        href="/cuenta/verificacion"
        className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-medium text-white/45 transition hover:text-white/70"
      >
        Lo haré más tarde <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
