"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Loader2,
  ScanFace,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

type LatestStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "APPROVED" | "DECLINED" | "EXPIRED";

type StatusResponse = {
  configured: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  latest: { status: LatestStatus; rejectReason: string | null; reviewedAt: string | null; createdAt: string } | null;
};

export default function VerificacionIdentidadPage() {
  const { me, loading: meLoading } = useMe();
  const router = useRouter();

  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<StatusResponse>("/verification/identity/status");
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polling mientras hay una verificación en curso (el resultado llega por webhook)
  useEffect(() => {
    const s = data?.latest?.status;
    const inFlight = s === "PENDING" || s === "IN_PROGRESS" || s === "IN_REVIEW";
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (inFlight && !data?.isVerified) {
      pollRef.current = setInterval(load, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data?.latest?.status, data?.isVerified, load]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await apiFetch<{ url: string }>("/verification/identity/start", { method: "POST", body: JSON.stringify({}) });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setError("No se pudo iniciar la verificación. Intenta de nuevo.");
        setStarting(false);
      }
    } catch (err: any) {
      const code = err?.message || "";
      setError(
        code.includes("NOT_ELIGIBLE")
          ? "La verificación de identidad es solo para perfiles profesionales."
          : code.includes("NOT_CONFIGURED")
            ? "La verificación aún no está habilitada. Inténtalo más tarde."
            : "No se pudo iniciar la verificación. Intenta de nuevo.",
      );
      setStarting(false);
    }
  };

  if (meLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!me?.user?.id) {
    router.push("/login?next=/cuenta/verificacion");
    return null;
  }

  const verified = Boolean(data?.isVerified) || data?.latest?.status === "APPROVED";
  const st = data?.latest?.status;
  const inReview = st === "IN_REVIEW";
  const inFlight = st === "PENDING" || st === "IN_PROGRESS";
  const declined = st === "DECLINED";
  const minor = declined && data?.latest?.rejectReason === "MENOR_DE_EDAD";

  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/cuenta" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-emerald-400" /> Verificación de identidad
          </h1>
          <p className="text-xs text-white/40">Consigue el sello verificada y más confianza</p>
        </div>
      </div>

      {verified ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
            <BadgeCheck className="h-7 w-7 text-emerald-300" />
          </div>
          <h2 className="text-lg font-bold">¡Identidad verificada!</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/50">
            Tu perfil ya muestra el sello <strong className="text-emerald-300">Verificada</strong>. Los clientes confían más en perfiles verificados.
          </p>
          <Link href="/cuenta" className="mt-5 inline-block rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10">
            Volver a mi cuenta
          </Link>
        </div>
      ) : inReview ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
            <Clock className="h-7 w-7 text-amber-300" />
          </div>
          <h2 className="text-lg font-bold">En revisión</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/50">
            Recibimos tu verificación y la estamos revisando. Te avisaremos apenas esté lista (suele tardar pocos minutos).
          </p>
        </div>
      ) : inFlight ? (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15">
            <Loader2 className="h-7 w-7 animate-spin text-sky-300" />
          </div>
          <h2 className="text-lg font-bold">Verificación en curso</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/50">
            Si no terminaste el proceso, puedes retomarlo. Esta página se actualiza sola cuando recibamos el resultado.
          </p>
          <button onClick={start} disabled={starting} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
            Retomar verificación
          </button>
        </div>
      ) : (
        <>
          {declined && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-3.5 text-sm text-rose-200">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {minor
                  ? "La verificación fue rechazada: el documento indica que eres menor de 18 años."
                  : "No pudimos verificar tu identidad. Revisa que el documento se vea nítido y que la selfie tenga buena luz, e inténtalo de nuevo."}
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/15">
              <ScanFace className="h-7 w-7 text-fuchsia-300" />
            </div>
            <h2 className="text-center text-lg font-bold">Verifica tu identidad en 1 minuto</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-center text-sm text-white/50">
              Escanea tu cédula y haz una selfie con prueba de vida. Al verificarte, tu perfil obtiene el sello <strong className="text-emerald-300">Verificada</strong>.
            </p>

            <ul className="mx-auto mt-5 max-w-sm space-y-2.5 text-sm text-white/60">
              <li className="flex items-center gap-2.5"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Más confianza y más contactos de clientes</li>
              <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Tu documento lo procesa un proveedor seguro, no se guarda en UZEED</li>
              <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 shrink-0 text-emerald-400" /> Resultado en minutos, sin llamadas</li>
            </ul>

            {data && !data.configured && (
              <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 text-center text-xs text-amber-200/90">
                La verificación automática aún no está habilitada. Vuelve a intentarlo más tarde.
              </p>
            )}

            <button
              onClick={start}
              disabled={starting || (data && !data.configured) || false}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] px-6 py-3.5 text-sm font-bold transition hover:bg-[position:100%_0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
              {declined ? "Reintentar verificación" : "Verificar mi identidad ahora"}
            </button>
            {error && <p className="mt-3 text-center text-xs text-rose-300">{error}</p>}
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/30">
            Al continuar aceptas que un proveedor externo de verificación procese tu documento y tu imagen
            para confirmar tu identidad y tu mayoría de edad.
          </p>
        </>
      )}
    </div>
  );
}
