"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { getApiBase } from "../../../lib/api";

type LinkState = {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";
  name: string;
  poses: string[];
  expiresAt: string;
};

type Shot = { pose: string; blob: Blob; url: string };

const POSE_COPY: Record<string, { title: string; hint: string }> = {
  FRONT: { title: "Mira de frente", hint: "Cara completa, sin lentes ni gorro" },
  LEFT: { title: "Gira a tu izquierda", hint: "Perfil izquierdo, sin tapar la cara" },
  RIGHT: { title: "Gira a tu derecha", hint: "Perfil derecho, sin tapar la cara" },
};

/**
 * Verificación facial. Se abre desde el enlace que el equipo manda por
 * WhatsApp, sin sesión: la profesional suele estar en otro teléfono y pedirle
 * que inicie sesión aquí haría que la mitad abandone.
 */
export default function FaceVerificationPage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [link, setLink] = useState<LinkState | null>(null);
  const [loading, setLoading] = useState(true);
  // Un enlace inválido y una API caída no son lo mismo: si se muestran igual,
  // un problema de despliegue parece un enlace vencido y nadie lo detecta.
  const [loadError, setLoadError] = useState<"NOT_FOUND" | "SERVER" | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const poses = link?.poses ?? ["FRONT", "LEFT", "RIGHT"];
  const currentPose = poses[shots.length];
  const done = shots.length >= poses.length;

  const loadLink = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`${getApiBase()}/face-verification/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        throw new Error(r.status === 404 ? "NOT_FOUND" : "SERVER");
      })
      .then(setLink)
      .catch((e: Error) => {
        setLink(null);
        setLoadError(e.message === "NOT_FOUND" ? "NOT_FOUND" : "SERVER");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      // Sin permiso de cámara la verificación no puede quedar bloqueada: se
      // cae al selector de archivos, que en el teléfono abre la cámara igual.
      setCameraError(true);
      setCameraReady(false);
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !currentPose) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    if (!size) return;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShots((prev) => [...prev, { pose: currentPose, blob, url: URL.createObjectURL(blob) }]);
      },
      "image/jpeg",
      0.9,
    );
  }

  function addFromFile(file: File | undefined) {
    if (!file || !currentPose) return;
    setShots((prev) => [
      ...prev,
      { pose: currentPose, blob: file, url: URL.createObjectURL(file) },
    ]);
  }

  function retake() {
    setShots((prev) => {
      const next = [...prev];
      const last = next.pop();
      if (last) URL.revokeObjectURL(last.url);
      return next;
    });
  }

  async function submit() {
    if (shots.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const body = new FormData();
      shots.forEach((s, i) => {
        body.append("shots", s.blob, `${s.pose.toLowerCase()}-${i}.jpg`);
        body.append("poses", s.pose);
      });
      const res = await fetch(`${getApiBase()}/face-verification/${encodeURIComponent(token)}/shots`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "No se pudieron enviar las fotos.");
      }
      stopCamera();
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "No se pudieron enviar las fotos.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Fallo de red o del servidor: se puede reintentar, no es culpa del enlace.
  if (loadError === "SERVER") {
    return (
      <Shell>
        <div className="text-center">
          <X className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-3 text-lg font-bold">No pudimos abrir la verificación</h1>
          <p className="mt-2 text-sm text-white/50">
            Hubo un problema de conexión con el servidor. Inténtalo de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={loadLink}
            className="mt-4 rounded-full border border-white/15 bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.12]"
          >
            Reintentar
          </button>
        </div>
      </Shell>
    );
  }

  if (!link || link.status === "EXPIRED") {
    return (
      <Shell>
        <div className="text-center">
          <X className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-3 text-lg font-bold">Enlace no válido</h1>
          <p className="mt-2 text-sm text-white/50">
            Este enlace venció o ya se usó. Escríbele al equipo para que te envíe uno nuevo.
          </p>
        </div>
      </Shell>
    );
  }

  if (sent || link.status === "SUBMITTED") {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-3 text-lg font-bold">¡Listo! Recibimos tus fotos</h1>
          <p className="mt-2 text-sm text-white/50">
            Nuestro equipo las va a revisar. Cuando aprobemos tu verificación tu perfil se publica
            y te avisamos.
          </p>
        </div>
      </Shell>
    );
  }

  if (link.status === "APPROVED") {
    return (
      <Shell>
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-3 text-lg font-bold">Tu perfil ya está verificado</h1>
          <p className="mt-2 text-sm text-white/50">No necesitas hacer nada más.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-lg font-bold">Hola {link.name} 👋</h1>
        <p className="mt-1 text-sm text-white/50">
          Son 3 fotos de tu cara para verificar que el perfil es tuyo. Toma menos de un minuto.
        </p>
      </div>

      {/* Progreso de poses */}
      <div className="mt-5 flex justify-center gap-2">
        {poses.map((p, i) => (
          <span
            key={p}
            className={`h-1.5 w-12 rounded-full ${
              i < shots.length ? "bg-emerald-400" : i === shots.length ? "bg-fuchsia-500" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      {!done && (
        <p className="mt-4 text-center">
          <span className="block text-base font-semibold text-white">
            {POSE_COPY[currentPose]?.title ?? "Mira a la cámara"}
          </span>
          <span className="mt-0.5 block text-xs text-white/40">
            {POSE_COPY[currentPose]?.hint ?? "Cara completa y bien iluminada"}
          </span>
        </p>
      )}

      {/* Visor */}
      <div className="relative mx-auto mt-4 aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full scale-x-[-1] object-cover ${cameraReady && !done ? "" : "hidden"}`}
        />

        {done && shots.length > 0 && (
          <img src={shots[shots.length - 1].url} alt="" className="h-full w-full object-cover" />
        )}

        {!cameraReady && !done && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Camera className="h-10 w-10 text-white/30" />
            {cameraError ? (
              <>
                <p className="text-xs text-white/45">
                  No pudimos abrir la cámara. Puedes tomar la foto igual desde tu teléfono.
                </p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white"
                >
                  Tomar foto
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white"
              >
                Activar cámara
              </button>
            )}
          </div>
        )}

        {/* Guía ovalada para encuadrar la cara */}
        {cameraReady && !done && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[55%] rounded-[50%] border-2 border-white/40" />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          addFromFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* Miniaturas de lo capturado */}
      {shots.length > 0 && (
        <div className="mt-4 flex justify-center gap-2">
          {shots.map((s) => (
            <img
              key={s.url}
              src={s.url}
              alt={s.pose}
              className="h-14 w-14 rounded-xl border border-emerald-400/40 object-cover"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
          {error}
        </p>
      )}

      {/* Acciones */}
      <div className="mt-5 flex items-center gap-3">
        {shots.length > 0 && (
          <button
            type="button"
            onClick={retake}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.1] disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
            Repetir
          </button>
        )}
        {!done ? (
          <button
            type="button"
            onClick={cameraReady ? capture : cameraError ? () => fileRef.current?.click() : startCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(217,70,239,0.9)] transition hover:brightness-110"
          >
            <Camera className="h-4 w-4" />
            {cameraReady || cameraError ? "Tomar foto" : "Activar cámara"}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(217,70,239,0.9)] transition hover:brightness-110 disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Enviar verificación
          </button>
        )}
      </div>

      <p className="mt-5 text-center text-[11px] text-white/30">
        Estas fotos son solo para verificar tu identidad. No se publican en tu perfil.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0b14] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white/60">
          <ShieldCheck className="h-4 w-4 text-fuchsia-400" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Verificación UZEED
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
