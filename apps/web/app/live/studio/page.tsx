"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { getLocalMedia } from "../../../lib/webrtc";
import useMe from "../../../hooks/useMe";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  DollarSign,
  Eye,
  Flame,
  Gift,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  Plus,
  Radio,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

/* ── Types ── */

type TipOption = {
  id: string;
  label: string;
  price: number;
  emoji: string | null;
  isActive: boolean;
  sortOrder: number;
};

type StudioData = {
  privateShowPrice: number | null;
  tipOptions: TipOption[];
  activeTipOptionsCount: number;
  checks: {
    hasPrivateShowPrice: boolean;
    hasTipOptions: boolean;
    readyToGoLive: boolean;
  };
  activeStream: {
    id: string;
    title: string | null;
    viewerCount: number;
    startedAt: string;
    privateShowPrice: number | null;
  } | null;
};

/* ── Elapsed timer ── */
function useElapsed(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${m}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}

/* ── Suggested emojis ── */
const EMOJI_SUGGESTIONS = ["💃", "🔥", "💋", "🌹", "💎", "👑", "🎵", "💦", "😘", "🍑", "🫦", "✨"];

/* ── Quick price presets ── */
const PRICE_PRESETS = [25, 50, 100, 200, 500];

/* ── Page ── */

export default function LiveStudioPage() {
  const router = useRouter();
  const { me } = useMe();
  const [data, setData] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"go-live" | "tips" | "settings">("go-live");

  // Settings
  const [savingSettings, setSavingSettings] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [priceSaved, setPriceSaved] = useState(false);

  // Go live
  const [startingLive, setStartingLive] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");

  // Tips
  const [newTipLabel, setNewTipLabel] = useState("");
  const [newTipPrice, setNewTipPrice] = useState("");
  const [newTipEmoji, setNewTipEmoji] = useState("");
  const [savingTip, setSavingTip] = useState(false);
  const [deletingTipId, setDeletingTipId] = useState<string | null>(null);

  // Camera preview
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewMic, setPreviewMic] = useState(true);
  const [previewCam, setPreviewCam] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";
  const elapsed = useElapsed(data?.activeStream?.startedAt);

  /* ── Load studio data ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<StudioData>("/live/studio/settings");
      setData(r);
      setPriceInput(r.privateShowPrice ? String(r.privateShowPrice) : "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me && !isProfessional) {
      router.push("/live");
      return;
    }
    if (isProfessional) load();
  }, [isProfessional, me, load, router]);

  // Permission state
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const [needsManualPermission, setNeedsManualPermission] = useState(false);

  /* ── Detect PWA / mobile ── */
  const isMobilePWA = typeof window !== "undefined" && (
    (/iPad|iPhone|iPod/.test(navigator.userAgent || "") && ((window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches)) ||
    (/Android/i.test(navigator.userAgent || "") && window.matchMedia("(display-mode: standalone)").matches)
  );
  const isIOS = typeof window !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isMobile = typeof window !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""));

  /* ── Check permissions ── */
  const checkPermissions = useCallback(async () => {
    setPermissionState("checking");

    // On mobile PWA, permissions API often doesn't work - go straight to getUserMedia
    if (isMobilePWA || isIOS) {
      setPermissionState("prompt");
      setNeedsManualPermission(true);
      return;
    }

    // Try Permissions API first (works on Chrome desktop, some Android browsers)
    if (navigator.permissions) {
      try {
        const [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: "camera" as PermissionName }),
          navigator.permissions.query({ name: "microphone" as PermissionName }),
        ]);

        if (camPerm.state === "denied" || micPerm.state === "denied") {
          setPermissionState("denied");
          setCameraError("Permisos de cámara o micrófono denegados. Ve a la configuración de tu navegador para activarlos.");
          return;
        }

        if (camPerm.state === "granted" && micPerm.state === "granted") {
          setPermissionState("granted");
          return;
        }

        // "prompt" state - need to ask
        setPermissionState("prompt");

        // Listen for permission changes
        const onChange = () => {
          if (camPerm.state === "granted" && micPerm.state === "granted") {
            setPermissionState("granted");
          } else if (camPerm.state === "denied" || micPerm.state === "denied") {
            setPermissionState("denied");
          }
        };
        camPerm.addEventListener("change", onChange);
        micPerm.addEventListener("change", onChange);
        return;
      } catch {
        // Permissions API not supported for camera/mic on this browser
      }
    }

    // Fallback: just set as prompt and let getUserMedia handle it
    setPermissionState("prompt");
  }, [isMobilePWA, isIOS]);

  /* ── Camera preview using the robust getLocalMedia ── */
  const startPreview = useCallback(async () => {
    try {
      setCameraError("");
      setNeedsManualPermission(false);

      // Use the robust getLocalMedia which handles iOS/Android PWA, fallbacks, etc.
      const stream = await getLocalMedia({ video: true, audio: true });
      setPreviewStream(stream);
      setPermissionState("granted");
    } catch (err: any) {
      const msg = err?.message || "";

      if (err?.name === "NotAllowedError" || msg.includes("denegados") || msg.includes("denied")) {
        setPermissionState("denied");
        if (isMobilePWA || isIOS) {
          setCameraError(
            isIOS
              ? "Permisos denegados. En iOS ve a Ajustes > Safari > Cámara y Micrófono y permite el acceso."
              : "Permisos denegados. Ve a Ajustes > Apps > Navegador > Permisos y activa Cámara y Micrófono."
          );
        } else {
          setCameraError("Permisos denegados. Haz clic en el icono del candado en la barra de dirección para activarlos.");
        }
      } else if (err?.name === "NotFoundError") {
        setCameraError("No se encontró cámara o micrófono. Conecta un dispositivo y vuelve a intentar.");
      } else if (err?.name === "NotReadableError" || err?.name === "AbortError") {
        setCameraError("La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentar.");
      } else if (err?.name === "NotSupportedError" || msg.includes("HTTPS")) {
        setCameraError("Tu navegador no soporta acceso a la cámara en este contexto. Asegúrate de usar HTTPS.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Verifica que tienes cámara/micrófono y los permisos están activos.");
      }
    }
  }, [isMobilePWA, isIOS]);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Auto-start preview when permissions are granted and on the go-live tab
  useEffect(() => {
    if (activeTab === "go-live" && !data?.activeStream && permissionState === "granted" && !previewStream) {
      startPreview();
    }
  }, [activeTab, data?.activeStream, permissionState, previewStream, startPreview]);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      previewStream?.getTracks().forEach((t) => t.stop());
    };
  }, [previewStream]);

  // Attach preview to video element
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Toggle mic/cam on preview
  useEffect(() => {
    if (!previewStream) return;
    previewStream.getAudioTracks().forEach((t) => { t.enabled = previewMic; });
  }, [previewMic, previewStream]);

  useEffect(() => {
    if (!previewStream) return;
    previewStream.getVideoTracks().forEach((t) => { t.enabled = previewCam; });
  }, [previewCam, previewStream]);

  const sortedTips = useMemo(
    () => (data?.tipOptions || []).filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [data]
  );

  const inactiveTips = useMemo(
    () => (data?.tipOptions || []).filter((t) => !t.isActive),
    [data]
  );

  /* ── Actions ── */
  const savePrivateShowPrice = async () => {
    const privateShowPrice = parseInt(priceInput, 10);
    if (!privateShowPrice || privateShowPrice < 1) return;
    setSavingSettings(true);
    try {
      await apiFetch("/live/studio/settings", {
        method: "PUT",
        body: JSON.stringify({ privateShowPrice }),
      });
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 2000);
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo guardar");
    } finally {
      setSavingSettings(false);
    }
  };

  const addTipOption = async () => {
    const label = newTipLabel.trim();
    const price = parseInt(newTipPrice, 10);
    if (!label || !price || price < 1) return;
    setSavingTip(true);
    try {
      await apiFetch("/live/tip-options/add", {
        method: "POST",
        body: JSON.stringify({ label, price, emoji: newTipEmoji.trim() || null }),
      });
      setNewTipLabel("");
      setNewTipPrice("");
      setNewTipEmoji("");
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo crear");
    } finally {
      setSavingTip(false);
    }
  };

  const removeTipOption = async (optionId: string) => {
    setDeletingTipId(optionId);
    try {
      await apiFetch(`/live/tip-options/${optionId}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo eliminar");
    } finally {
      setDeletingTipId(null);
    }
  };

  const startLive = async () => {
    if (!data?.checks.readyToGoLive) return;
    setStartingLive(true);
    // Stop preview before going live
    previewStream?.getTracks().forEach((t) => t.stop());
    setPreviewStream(null);
    try {
      const res = await apiFetch<{ stream: { id: string } }>("/live/start", {
        method: "POST",
        body: JSON.stringify({
          title: liveTitle.trim() || null,
          privateShowPrice: parseInt(priceInput, 10),
        }),
      });
      router.push(`/live/${res.stream.id}`);
    } catch (e: any) {
      if (e?.body?.streamId) {
        router.push(`/live/${e.body.streamId}`);
        return;
      }
      alert(e?.body?.error || "No se pudo iniciar el live");
    } finally {
      setStartingLive(false);
    }
  };

  if (!isProfessional) return null;

  /* ── Readiness score ── */
  const cameraReady = !!previewStream && !cameraError && permissionState === "granted";
  const readinessItems = data
    ? [
        { ok: data.checks.hasPrivateShowPrice, label: "Precio show privado", required: true },
        { ok: data.checks.hasTipOptions, label: "Opciones de propina", required: false },
        { ok: cameraReady, label: "Cámara y micrófono", required: true },
      ]
    : [];
  const readyCount = readinessItems.filter((r) => r.ok).length;
  const canGoLive = data?.checks.readyToGoLive && cameraReady;

  return (
    <div className="min-h-screen bg-[#070816] text-white pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070816]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/live"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 blur-lg scale-150" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/25 to-rose-600/25 border border-fuchsia-500/20">
                <Radio className="h-4 w-4 text-fuchsia-400" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Live Studio</h1>
              <p className="text-[10px] text-white/35">Panel de transmisión</p>
            </div>
          </div>

          {/* Live status pill */}
          {data?.activeStream && (
            <Link
              href={`/live/${data.activeStream.id}`}
              className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 transition-all hover:bg-red-500/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-bold text-red-300">EN VIVO</span>
              <span className="text-[10px] text-white/40">{elapsed}</span>
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-5">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
            ))}
          </div>
        ) : data && (
          <>
            {/* ═══ ALREADY LIVE BANNER ═══ */}
            {data.activeStream && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.08] via-fuchsia-500/[0.05] to-transparent">
                <div className="flex items-center gap-4 p-5">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/30 to-fuchsia-500/30">
                    <Radio className="h-7 w-7 text-red-300 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold">Estás transmitiendo en vivo</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/50">
                      {data.activeStream.title && (
                        <span className="truncate max-w-[200px]">{data.activeStream.title}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {data.activeStream.viewerCount} viendo
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsed}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/live/${data.activeStream.id}`}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(239,68,68,0.25)]"
                  >
                    Ir al stream
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* ═══ TAB NAVIGATION ═══ */}
            <div className="mb-5 flex gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              {([
                { key: "go-live" as const, label: "Transmitir", icon: Video },
                { key: "tips" as const, label: "Propinas", icon: Gift },
                { key: "settings" as const, label: "Configuración", icon: Settings2 },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 text-fuchsia-300 border border-fuchsia-500/20 shadow-[0_0_12px_rgba(168,85,247,0.06)]"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* ═══ TAB: GO LIVE ═══ */}
            {/* ═══════════════════════════════════════════ */}
            {activeTab === "go-live" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                {/* Camera Preview */}
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black aspect-video">
                    {data.activeStream ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Radio className="mx-auto h-12 w-12 text-red-400 animate-pulse mb-3" />
                          <p className="text-sm font-semibold text-white/70">Transmisión activa</p>
                          <p className="text-xs text-white/35 mt-1">Vuelve al stream para ver tu cámara</p>
                        </div>
                      </div>
                    ) : previewStream && previewCam ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                      />
                    ) : permissionState === "checking" ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-fuchsia-400/50 mb-3" />
                          <p className="text-sm text-white/40">Verificando permisos...</p>
                        </div>
                      </div>
                    ) : permissionState === "denied" || cameraError ? (
                      <div className="flex h-full items-center justify-center p-6">
                        <div className="text-center max-w-sm">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                            <CameraOff className="h-6 w-6 text-red-400" />
                          </div>
                          <p className="text-sm font-semibold text-red-300 mb-2">
                            {permissionState === "denied" ? "Permisos denegados" : "Error de cámara"}
                          </p>
                          <p className="text-xs text-white/40 leading-relaxed mb-4">
                            {cameraError || "Necesitas dar permiso a la cámara y micrófono para transmitir."}
                          </p>
                          {isMobile && (
                            <div className="mb-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-left">
                              <p className="text-[11px] font-semibold text-amber-300 mb-1.5">
                                {isIOS ? "En tu iPhone/iPad:" : "En tu Android:"}
                              </p>
                              {isIOS ? (
                                <ol className="text-[11px] text-white/40 space-y-1 list-decimal pl-3.5">
                                  <li>Abre <strong className="text-white/60">Ajustes</strong> de tu dispositivo</li>
                                  <li>Busca <strong className="text-white/60">Safari</strong> (o tu navegador)</li>
                                  <li>Activa <strong className="text-white/60">Cámara</strong> y <strong className="text-white/60">Micrófono</strong></li>
                                  <li>Vuelve aquí y toca <strong className="text-white/60">Reintentar</strong></li>
                                </ol>
                              ) : (
                                <ol className="text-[11px] text-white/40 space-y-1 list-decimal pl-3.5">
                                  <li>Toca el <strong className="text-white/60">candado/icono</strong> en la barra de dirección</li>
                                  <li>Toca <strong className="text-white/60">Permisos</strong></li>
                                  <li>Activa <strong className="text-white/60">Cámara</strong> y <strong className="text-white/60">Micrófono</strong></li>
                                  <li>Toca <strong className="text-white/60">Reintentar</strong> abajo</li>
                                </ol>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCameraError("");
                              setPermissionState("prompt");
                              startPreview();
                            }}
                            className="rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-all"
                          >
                            Reintentar
                          </button>
                        </div>
                      </div>
                    ) : (permissionState === "prompt" || needsManualPermission) && !previewStream ? (
                      <div className="flex h-full items-center justify-center p-6">
                        <div className="text-center max-w-xs">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10">
                            <Camera className="h-6 w-6 text-fuchsia-400" />
                          </div>
                          <p className="text-sm font-semibold text-white/80 mb-1">Activa tu cámara</p>
                          <p className="text-xs text-white/35 leading-relaxed mb-4">
                            {isMobilePWA
                              ? "Toca el botón y acepta los permisos cuando tu teléfono te pregunte."
                              : "Necesitamos acceso a tu cámara y micrófono para la transmisión en vivo."}
                          </p>
                          <button
                            type="button"
                            onClick={startPreview}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(168,85,247,0.3)]"
                          >
                            <Camera className="h-4 w-4" />
                            {isMobilePWA ? "Permitir cámara y micrófono" : "Activar cámara"}
                          </button>
                          {isMobilePWA && (
                            <p className="mt-3 text-[10px] text-white/25">
                              Si no aparece el cuadro de permisos, revisa la configuración de tu navegador.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Camera className="mx-auto h-10 w-10 text-white/15 mb-3" />
                          <p className="text-sm text-white/30">Cámara apagada</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewCam(true);
                              if (!previewStream) startPreview();
                            }}
                            className="mt-3 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/20 px-4 py-2 text-xs text-fuchsia-300 hover:bg-fuchsia-600/30 transition-all"
                          >
                            Encender cámara
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Camera overlay controls */}
                    {!data.activeStream && previewStream && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewMic(!previewMic)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-xl transition-all ${
                            previewMic
                              ? "bg-white/10 border border-white/15 text-white hover:bg-white/20"
                              : "bg-red-500/20 border border-red-500/30 text-red-400"
                          }`}
                        >
                          {previewMic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewCam(!previewCam)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-xl transition-all ${
                            previewCam
                              ? "bg-white/10 border border-white/15 text-white hover:bg-white/20"
                              : "bg-red-500/20 border border-red-500/30 text-red-400"
                          }`}
                        >
                          {previewCam ? <Video className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                        </button>
                      </div>
                    )}

                    {/* LIVE indicator overlay */}
                    {!data.activeStream && previewStream && previewCam && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-lg px-2.5 py-1 border border-white/10">
                        <span className="h-2 w-2 rounded-full bg-white/40" />
                        <span className="text-[10px] font-bold text-white/50">PREVIEW</span>
                      </div>
                    )}
                  </div>

                  {/* Title input */}
                  {!data.activeStream && (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-white/50">
                        <Sparkles className="h-3 w-3 text-fuchsia-400/60" />
                        Título de tu live
                      </label>
                      <input
                        value={liveTitle}
                        onChange={(e) => setLiveTitle(e.target.value)}
                        maxLength={100}
                        placeholder="Ej: Show nocturno especial..."
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:ring-1 focus:ring-fuchsia-500/15 focus:outline-none transition-all"
                      />
                      <p className="mt-1.5 text-[10px] text-white/25">{liveTitle.length}/100 caracteres</p>
                    </div>
                  )}
                </div>

                {/* Right sidebar - Readiness + Go Live */}
                <div className="space-y-4">
                  {/* Quick stats (when live) */}
                  {data.activeStream && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-center">
                        <Users className="mx-auto h-4 w-4 text-fuchsia-400/60 mb-1" />
                        <p className="text-lg font-bold">{data.activeStream.viewerCount}</p>
                        <p className="text-[10px] text-white/30">Viewers</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-center">
                        <Clock className="mx-auto h-4 w-4 text-emerald-400/60 mb-1" />
                        <p className="text-lg font-bold">{elapsed}</p>
                        <p className="text-[10px] text-white/30">Tiempo</p>
                      </div>
                    </div>
                  )}

                  {/* Readiness checklist */}
                  {!data.activeStream && (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
                        <span className="text-xs font-semibold text-white/60">Checklist</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          readyCount === readinessItems.length
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        }`}>
                          {readyCount}/{readinessItems.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-1">
                        {readinessItems.map((item, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                              item.ok ? "bg-emerald-500/[0.05]" : "bg-white/[0.02]"
                            }`}
                          >
                            {item.ok ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                            ) : (
                              <div className={`h-4 w-4 shrink-0 rounded-full border-2 ${item.required ? "border-red-400/40" : "border-amber-400/40"}`} />
                            )}
                            <span className={`text-xs ${item.ok ? "text-emerald-300/80" : "text-white/40"}`}>
                              {item.label}
                            </span>
                            {!item.ok && item.required && (
                              <span className="ml-auto text-[9px] text-red-400/70 font-medium">Requerido</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Private show price quick config */}
                  {!data.activeStream && (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/60">
                          <Coins className="h-3.5 w-3.5 text-amber-400/60" />
                          Show privado
                        </div>
                        {data.privateShowPrice && (
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            {data.privateShowPrice} tk
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mb-2">
                        <div className="relative flex-1">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                          <input
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            type="number"
                            min="1"
                            placeholder="Precio en tokens"
                            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-amber-500/30 focus:outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={savePrivateShowPrice}
                          disabled={savingSettings || !priceInput}
                          className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                            priceSaved
                              ? "bg-emerald-500/20 border border-emerald-500/20 text-emerald-400"
                              : "bg-amber-600/80 hover:bg-amber-600 text-white"
                          }`}
                        >
                          {priceSaved ? "Listo" : savingSettings ? "..." : "Guardar"}
                        </button>
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-1.5">
                        {PRICE_PRESETS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPriceInput(String(p))}
                            className={`flex-1 rounded-lg border py-1.5 text-[10px] font-medium transition-all ${
                              priceInput === String(p)
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50 hover:bg-white/[0.04]"
                            }`}
                          >
                            {p} tk
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GO LIVE button */}
                  {!data.activeStream && (
                    <button
                      type="button"
                      onClick={startLive}
                      disabled={startingLive || !canGoLive}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-rose-600 p-[1px] transition-all hover:shadow-[0_12px_40px_rgba(219,39,119,0.3)] disabled:opacity-40 disabled:hover:shadow-none"
                    >
                      <div className="relative flex items-center justify-center gap-3 rounded-[15px] bg-gradient-to-r from-fuchsia-600 to-rose-600 px-6 py-4">
                        {startingLive ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Radio className="h-5 w-5" />
                        )}
                        <span className="text-base font-bold">
                          {startingLive ? "Iniciando..." : "Iniciar Live"}
                        </span>
                      </div>
                      {/* Shimmer */}
                      {!startingLive && canGoLive && (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                          <div className="absolute -left-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
                        </div>
                      )}
                    </button>
                  )}

                  {/* Tip count info */}
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Gift className="h-3.5 w-3.5 text-fuchsia-400/50" />
                        Opciones de propina
                      </div>
                      <span className="text-sm font-bold text-white/70">{data.activeTipOptionsCount}</span>
                    </div>
                    {data.activeTipOptionsCount === 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("tips")}
                        className="mt-2 w-full rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.06] py-2 text-[11px] text-fuchsia-300 hover:bg-fuchsia-500/10 transition-all"
                      >
                        Crear propinas
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* ═══ TAB: TIPS ═══ */}
            {/* ═══════════════════════════════════════════ */}
            {activeTab === "tips" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                {/* Existing tips */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold">
                      <Gift className="h-4 w-4 text-fuchsia-400" />
                      Tus opciones de propina
                    </h2>
                    <span className="text-xs text-white/30">{sortedTips.length} activas</span>
                  </div>

                  {sortedTips.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 blur-2xl scale-[2]" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04]">
                          <Gift className="h-7 w-7 text-white/15" />
                        </div>
                      </div>
                      <p className="text-sm text-white/50 mb-1">No tienes propinas creadas</p>
                      <p className="text-xs text-white/25">Crea opciones para que tus viewers te envíen propinas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedTips.map((t) => (
                        <div
                          key={t.id}
                          className="group/tip flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:border-fuchsia-500/10 hover:bg-white/[0.03]"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/[0.06] border border-fuchsia-500/[0.12] text-lg">
                            {t.emoji || "🎁"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.label}</p>
                          </div>
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                            {t.price} tk
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTipOption(t.id)}
                            disabled={deletingTipId === t.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/0 group-hover/tip:text-white/30 hover:!text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                          >
                            {deletingTipId === t.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inactive tips */}
                  {inactiveTips.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-white/25 mb-2">Inactivas ({inactiveTips.length})</p>
                      <div className="space-y-1.5">
                        {inactiveTips.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3 py-2 opacity-50">
                            <span className="text-sm">{t.emoji || "🎁"}</span>
                            <span className="text-xs text-white/40 truncate flex-1">{t.label}</span>
                            <span className="text-[10px] text-white/20">{t.price} tk</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Create new tip */}
                <div>
                  <div className="sticky top-[72px] rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                    <div className="border-b border-white/[0.05] px-5 py-3.5">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <Plus className="h-4 w-4 text-fuchsia-400" />
                        Nueva propina
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Label */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-white/40">
                          Nombre de la propina
                        </label>
                        <input
                          value={newTipLabel}
                          onChange={(e) => setNewTipLabel(e.target.value)}
                          placeholder="Ej: Bailo para ti"
                          maxLength={50}
                          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:outline-none transition-all"
                        />
                      </div>

                      {/* Price */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-white/40">
                          Precio en tokens
                        </label>
                        <div className="relative">
                          <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400/40" />
                          <input
                            value={newTipPrice}
                            onChange={(e) => setNewTipPrice(e.target.value)}
                            type="number"
                            min="1"
                            placeholder="Ej: 25"
                            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/30 focus:outline-none transition-all"
                          />
                        </div>
                        {/* Quick price buttons */}
                        <div className="mt-2 flex gap-1.5">
                          {[5, 10, 25, 50, 100].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setNewTipPrice(String(p))}
                              className={`flex-1 rounded-lg border py-1.5 text-[10px] font-medium transition-all ${
                                newTipPrice === String(p)
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : "border-white/[0.06] text-white/25 hover:text-white/40"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Emoji */}
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-white/40">
                          Emoji (opcional)
                        </label>
                        <input
                          value={newTipEmoji}
                          onChange={(e) => setNewTipEmoji(e.target.value)}
                          placeholder="💃"
                          maxLength={4}
                          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:outline-none transition-all"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {EMOJI_SUGGESTIONS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => setNewTipEmoji(e)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition-all ${
                                newTipEmoji === e
                                  ? "border-fuchsia-500/30 bg-fuchsia-500/10"
                                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                              }`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      {newTipLabel && newTipPrice && (
                        <div className="rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.04] p-3">
                          <p className="text-[10px] text-white/30 mb-2">Vista previa</p>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/10 text-base">
                              {newTipEmoji || "🎁"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{newTipLabel}</p>
                            </div>
                            <span className="text-xs font-bold text-amber-300">{newTipPrice} tk</span>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addTipOption}
                        disabled={savingTip || !newTipLabel.trim() || !newTipPrice}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(168,85,247,0.25)] disabled:opacity-40 disabled:hover:scale-100"
                      >
                        {savingTip ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {savingTip ? "Creando..." : "Crear propina"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* ═══ TAB: SETTINGS ═══ */}
            {/* ═══════════════════════════════════════════ */}
            {activeTab === "settings" && (
              <div className="max-w-2xl space-y-5">
                {/* Private show price */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/15">
                      <Coins className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Precio de show privado</h3>
                      <p className="text-[11px] text-white/30">Lo que cobras cuando un viewer quiere un show exclusivo</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                        <input
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          type="number"
                          min="1"
                          placeholder="Ej: 50"
                          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/15 focus:outline-none transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={savePrivateShowPrice}
                        disabled={savingSettings || !priceInput}
                        className={`rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:opacity-40 ${
                          priceSaved
                            ? "bg-emerald-500/20 border border-emerald-500/20 text-emerald-400"
                            : "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-[0_8px_24px_rgba(245,158,11,0.2)]"
                        }`}
                      >
                        {priceSaved ? "Guardado" : savingSettings ? "Guardando..." : "Guardar precio"}
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {PRICE_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriceInput(String(p))}
                          className={`flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                            priceInput === String(p)
                              ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                              : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50 hover:bg-white/[0.04]"
                          }`}
                        >
                          {p} tokens
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick tips guide */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 border border-violet-500/15">
                      <Zap className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Consejos para ganar más</h3>
                      <p className="text-[11px] text-white/30">Tips de profesionales exitosas</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { icon: Gift, text: "Crea mínimo 3 opciones de propina con precios variados" },
                      { icon: Sparkles, text: "Usa emojis llamativos en tus propinas" },
                      { icon: Eye, text: "Pon un título atractivo a tu live" },
                      { icon: TrendingUp, text: "Transmite en horarios punta (21:00 - 02:00)" },
                      { icon: Flame, text: "Interactúa con el chat para mantener viewers" },
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3">
                        <tip.icon className="h-4 w-4 shrink-0 text-fuchsia-400/50 mt-0.5" />
                        <p className="text-xs text-white/50 leading-relaxed">{tip.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stream quality info */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/15">
                      <Wifi className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Calidad de transmisión</h3>
                      <p className="text-[11px] text-white/30">Requisitos para una buena calidad</p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Internet mínimo</p>
                      <p className="text-sm font-bold text-white/70">5 Mbps</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Resolución</p>
                      <p className="text-sm font-bold text-white/70">640x480</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Cámara</p>
                      <p className="text-sm font-bold text-white/70">Frontal</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <p className="text-[10px] text-white/30 mb-1">Audio</p>
                      <p className="text-sm font-bold text-white/70">48 kHz</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
