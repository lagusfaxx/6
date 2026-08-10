"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Mail, X } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type State = "working" | "done" | "invalid" | "error";

/**
 * Baja en un clic desde el enlace del correo.
 *
 * Se ejecuta sola al abrir, sin pedir confirmación ni sesión: si damos de
 * baja solo tras un clic extra, mucha gente marca el correo como spam, que
 * hace bastante más daño al dominio que una baja de más. Volver a activarlo
 * queda a un toque en la cuenta.
 */
export default function UnsubscribeClient() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    if (!uid || !token) {
      setState("invalid");
      return;
    }
    let alive = true;
    apiFetch("/notifications/email/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ uid, token }),
    })
      .then(() => { if (alive) setState("done"); })
      .catch((err: any) => {
        if (!alive) return;
        setState(err?.status === 403 ? "invalid" : "error");
      });
    return () => { alive = false; };
  }, [uid, token]);

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
        {state === "done" ? (
          <Check className="h-6 w-6 text-emerald-400" />
        ) : state === "working" ? (
          <Mail className="h-6 w-6 text-white/40" />
        ) : (
          <X className="h-6 w-6 text-red-400" />
        )}
      </div>

      {state === "working" && (
        <p className="text-sm text-white/50">Procesando tu baja…</p>
      )}

      {state === "done" && (
        <>
          <h1 className="text-lg font-bold">Listo, no te escribiremos más</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Desactivamos los avisos por correo de mensajes sin leer. Vas a seguir
            recibiendo tus mensajes dentro de UZEED, solo que sin aviso al correo.
          </p>
        </>
      )}

      {state === "invalid" && (
        <>
          <h1 className="text-lg font-bold">Este enlace no es válido</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Puede estar incompleto por el cliente de correo. Puedes desactivar los
            avisos desde tu cuenta.
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-lg font-bold">No pudimos procesar la baja</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Inténtalo de nuevo en unos minutos o desactívalo desde tu cuenta.
          </p>
        </>
      )}

      {state !== "working" && (
        <Link
          href="/cuenta"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-500"
        >
          Ir a mi cuenta
        </Link>
      )}
    </div>
  );
}
