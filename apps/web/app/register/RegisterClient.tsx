"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import AuthForm, { type RegisterFormData } from "../../components/AuthForm";
import ProfessionalRegisterForm from "../../components/ProfessionalRegisterForm";
import TermsModal from "../../components/TermsModal";
import EmailVerification from "../../components/EmailVerification";
import Link from "next/link";
import { apiFetch, getApiBase, friendlyErrorMessage } from "../../lib/api";
import {
  Briefcase,
  Building2,
  ShoppingBag,
  User,
  Clock,
  Phone,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Gift,
  ShieldCheck,
  Lock,
  Heart,
  Check,
  Star,
} from "lucide-react";

function trialLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}

const FREE_TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_FREE_TRIAL_DAYS || 90);
const TRIAL_TEXT = `${trialLabel(FREE_TRIAL_DAYS)} gratis`;

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

type OptionConfig = {
  key: ProfileType;
  title: string;
  description: string;
  icon: any;
  accent: string;
  iconGradient: string;
  ringColor: string;
  badge?: { text: string; tone: "promo" | "popular" };
};

const consumerOption: OptionConfig = {
  key: "CLIENT",
  title: "Cliente",
  description: "Busca perfiles, guarda favoritos y coordina por chat.",
  icon: User,
  accent: "from-sky-500/15 via-blue-500/10 to-cyan-500/10",
  iconGradient: "from-sky-400 to-blue-500",
  ringColor: "ring-sky-400/50 border-sky-400/40",
  badge: { text: "Más popular", tone: "popular" },
};

const businessOptions: OptionConfig[] = [
  {
    key: "PROFESSIONAL",
    title: "Experiencia",
    description: "Ofrece experiencias con perfil completo, fotos y categorías.",
    icon: Briefcase,
    accent: "from-fuchsia-500/15 via-pink-500/10 to-rose-500/10",
    iconGradient: "from-fuchsia-400 to-pink-500",
    ringColor: "ring-fuchsia-400/50 border-fuchsia-400/40",
    badge: { text: TRIAL_TEXT, tone: "promo" },
  },
  {
    key: "ESTABLISHMENT",
    title: "Motel / Hotel",
    description: "Administra habitaciones, promociones y reservas.",
    icon: Building2,
    accent: "from-violet-500/15 via-purple-500/10 to-indigo-500/10",
    iconGradient: "from-violet-400 to-purple-500",
    ringColor: "ring-violet-400/50 border-violet-400/40",
  },
  {
    key: "SHOP",
    title: "Tienda",
    description: "Comercios que venden artículos tipo sex shop.",
    icon: ShoppingBag,
    accent: "from-amber-500/15 via-orange-500/10 to-yellow-500/10",
    iconGradient: "from-amber-400 to-orange-500",
    ringColor: "ring-amber-400/50 border-amber-400/40",
  },
];

export default function RegisterClient() {
  const [step, setStep] = useState<"choose" | "form" | "verify" | "pending">("choose");
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [pendingFormData, setPendingFormData] = useState<RegisterFormData | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function onGoogleClick() {
    setGoogleLoading(true);
    setRegisterError(null);
    window.location.href = `${getApiBase()}/auth/google/start?next=/`;
  }

  const MIN_PHOTOS = 3;
  const MAX_PHOTOS = 6;

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      galleryPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const isBusinessProfile =
    profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP";
  const isProfessional = profileType === "PROFESSIONAL";

  const selected = useMemo<OptionConfig | null>(() => {
    if (profileType === null) return null;
    if (profileType === "CLIENT") return consumerOption;
    return businessOptions.find((o) => o.key === profileType) ?? null;
  }, [profileType]);

  const termsType = isBusinessProfile ? "business" : "client";

  // After email verified, create the account (and upload photos for professionals)
  async function createAccountAfterVerification() {
    if (!pendingFormData) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(pendingFormData),
      });
      // Register auto-creates the session, no separate login needed

      // For professionals, upload the photos collected in the "photos" step
      if (isProfessional && galleryFiles.length > 0) {
        const base = getApiBase();

        // Upload first photo as avatar
        const avatarForm = new FormData();
        avatarForm.append("file", galleryFiles[0]);
        await fetch(`${base}/profile/avatar`, {
          method: "POST",
          body: avatarForm,
          credentials: "include",
        });

        // Upload all photos as gallery media
        const mediaForm = new FormData();
        for (const file of galleryFiles) {
          mediaForm.append("files", file);
        }
        await fetch(`${base}/profile/media`, {
          method: "POST",
          body: mediaForm,
          credentials: "include",
        });
      }

      if (isBusinessProfile) {
        setStep("pending");
      } else {
        window.location.replace("/");
      }
    } catch (err: any) {
      const msg = err?.body?.message || friendlyErrorMessage(err) || "Error al crear la cuenta.";
      setRegisterError(msg);
      setStep("form");
    } finally {
      setRegistering(false);
    }
  }

  function handleGalleryAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      valid.push(file);
    }
    const remaining = MAX_PHOTOS - galleryFiles.length;
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length > 0) {
      setGalleryFiles((prev) => [...prev, ...toAdd]);
      setGalleryPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    }
    e.target.value = "";
  }

  function removeGalleryItem(idx: number) {
    URL.revokeObjectURL(galleryPreviews[idx]);
    setGalleryFiles((prev) => prev.filter((_, i) => i !== idx));
    setGalleryPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  // Email verification screen
  if (step === "verify") {
    return (
      <EmailVerification
        email={registeredEmail}
        onVerified={createAccountAfterVerification}
        onBack={() => setStep("form")}
      />
    );
  }

  const stepIndex = step === "choose" ? 0 : step === "form" ? 1 : step === "pending" ? 2 : 1;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Hero header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 blur-3xl scale-150 animate-pulse" />
            <div className="relative rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 p-[2px] shadow-2xl">
              <img
                src="/brand/isotipo-new.png"
                alt="UZEED"
                className="w-20 h-20 rounded-[22px]"
              />
            </div>
          </div>
          <h1 className="mt-6 text-[2rem] md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-white/55 text-center max-w-sm leading-relaxed">
            {step === "choose"
              ? "Elige el tipo de cuenta que mejor se ajuste a ti. Es rápido y gratis."
              : step === "pending"
                ? "Tu registro ha sido recibido"
                : `Registrándote como ${selected?.title ?? profileType}`}
          </p>

          {/* Progress dots */}
          {step !== "pending" && (
            <div className="mt-5 flex items-center gap-2">
              {["Tipo", "Datos", "Listo"].map((label, i) => {
                const active = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          current
                            ? "w-8 bg-gradient-to-r from-fuchsia-400 to-violet-400"
                            : active
                              ? "w-4 bg-white/50"
                              : "w-4 bg-white/10"
                        }`}
                      />
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                          current ? "text-white/80" : active ? "text-white/40" : "text-white/20"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card */}
        <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top glow line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
          {/* Ambient corner glows */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

          {step === "choose" ? (
            <div className="relative p-6 sm:p-8">
              {/* Consumer section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-px flex-1 bg-white/5" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                    Consumidor
                  </p>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
                <OptionCard
                  option={consumerOption}
                  selected={profileType === consumerOption.key}
                  onSelect={() => setProfileType(consumerOption.key)}
                />
              </div>

              {/* Business section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-px flex-1 bg-white/5" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                    Profesional / Comercio
                  </p>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid gap-3">
                  {businessOptions.map((opt) => (
                    <OptionCard
                      key={opt.key}
                      option={opt}
                      selected={profileType === opt.key}
                      onSelect={() => setProfileType(opt.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Promo banner visible when professional selected */}
              {profileType === "PROFESSIONAL" && (
                <div className="mt-5 relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/20 to-pink-600/20 p-4">
                  <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-fuchsia-500/20 blur-2xl" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 border border-fuchsia-400/30 shadow-lg shadow-fuchsia-500/20">
                      <Gift className="h-5 w-5 text-fuchsia-200" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        <span className="text-sm font-bold text-white">{TRIAL_TEXT}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-white/65 leading-relaxed">
                        Sin tarjeta de crédito. Empieza a recibir clientes hoy.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Google sign-up — ONLY for clients */}
              {profileType === "CLIENT" && (
                <>
                  <button
                    type="button"
                    onClick={onGoogleClick}
                    disabled={googleLoading}
                    className="mt-6 group w-full flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white hover:bg-white/95 active:scale-[0.99] text-gray-800 font-semibold py-3.5 transition-all duration-200 disabled:opacity-60 shadow-lg"
                  >
                    {googleLoading ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                        </svg>
                        Continuar con Google
                      </>
                    )}
                  </button>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 text-xs text-white/40 bg-gradient-to-r from-transparent via-[#0d0e1a] to-transparent">
                        o con correo
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Continue button */}
              <button
                type="button"
                disabled={profileType === null}
                onClick={() => {
                  setTermsAccepted(false);
                  setStep("form");
                }}
                className={`${profileType === "CLIENT" ? "" : "mt-6"} group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] bg-left hover:bg-right font-semibold text-white py-3.5 text-base flex items-center justify-center gap-2 shadow-[0_15px_40px_rgba(168,85,247,0.35)] transition-[background-position,transform] duration-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:from-white/10 disabled:to-white/10`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {profileType === null ? "Elige una opción" : "Continuar"}
                  {profileType !== null && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </span>
              </button>

              {/* Trust indicators */}
              <div className="mt-6 flex items-center justify-center gap-5 text-[11px] text-white/40">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
                  <span>Verificado</span>
                </div>
                <span className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-sky-400/70" />
                  <span>Privado</span>
                </div>
                <span className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-fuchsia-400/70" />
                  <span>Gratis</span>
                </div>
              </div>
            </div>
          ) : step === "form" ? (
            <div className="relative p-6 sm:p-8">
              {/* Selected type chip */}
              {selected && (() => {
                const SelectedIcon = selected.icon;
                return (
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("choose");
                        setTermsAccepted(false);
                      }}
                      className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition rounded-lg px-2 py-1 -mx-2 hover:bg-white/5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Cambiar
                    </button>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <div
                        className={`h-5 w-5 rounded-md bg-gradient-to-br ${selected.iconGradient} flex items-center justify-center`}
                      >
                        <SelectedIcon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-white/80">{selected.title}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Promo banner for professionals */}
              {isProfessional && (
                <div className="relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/20 to-pink-600/20 p-5 mb-6">
                  <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-16 w-16 rounded-full bg-violet-500/10 blur-2xl" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-400/20">
                      <Gift className="h-6 w-6 text-fuchsia-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-bold text-white">Promo: {TRIAL_TEXT}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-white/60 leading-relaxed">
                        Regístrate ahora y disfruta {trialLabel(FREE_TRIAL_DAYS)} de membresía sin
                        costo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {registerError && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {registerError}
                </div>
              )}

              {isProfessional ? (
                <ProfessionalRegisterForm
                  termsAccepted={termsAccepted}
                  onOpenTerms={() => setTermsOpen(true)}
                  onCollectData={(data) => {
                    setPendingFormData(data);
                    setRegisteredEmail(data.email);
                    setRegisterError(null);
                    setStep("verify");
                  }}
                  onBack={() => {
                    setStep("choose");
                    setTermsAccepted(false);
                  }}
                  galleryFiles={galleryFiles}
                  galleryPreviews={galleryPreviews}
                  onGalleryAdd={handleGalleryAdd}
                  onGalleryRemove={removeGalleryItem}
                  galleryInputRef={galleryInputRef}
                  minPhotos={MIN_PHOTOS}
                  maxPhotos={MAX_PHOTOS}
                />
              ) : (
                <AuthForm
                  mode="register"
                  initialProfileType={profileType ?? undefined}
                  lockProfileType
                  termsAccepted={termsAccepted}
                  onOpenTerms={() => setTermsOpen(true)}
                  onCollectData={(data) => {
                    setPendingFormData(data);
                    setRegisteredEmail(data.email);
                    setRegisterError(null);
                    setStep("verify");
                  }}
                />
              )}
            </div>
          ) : step === "pending" ? (
            <div className="relative p-6 sm:p-8">
              <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 to-orange-500/20 border border-amber-400/30">
                  <Clock className="h-8 w-8 text-amber-300" />
                </div>
                <h2 className="text-xl font-bold text-amber-100">Registro recibido</h2>
                <p className="mt-2 text-sm text-white/70 leading-relaxed max-w-sm mx-auto">
                  Tu perfil ha sido creado exitosamente. Para aparecer en la plataforma, un
                  administrador verificará tu cuenta mediante una llamada telefónica.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <Phone className="h-3.5 w-3.5" />
                  <span>Verificación telefónica manual</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-fuchsia-300" />
                  Mientras tanto puedes
                </h3>
                <ul className="text-sm text-white/65 space-y-2">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Subir tu foto de perfil y fotos de galería
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Completar tu descripción y servicios
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Configurar tus tarifas y disponibilidad
                  </li>
                </ul>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/cuenta"
                  className="btn-primary flex-1 text-center flex items-center justify-center gap-2"
                >
                  Ir a mi perfil
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/" className="btn-secondary flex-1 text-center">
                  Volver al inicio
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-white/45">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-fuchsia-300 hover:text-fuchsia-200 underline-offset-4 hover:underline transition"
          >
            Inicia sesión
          </Link>
        </p>
      </div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setTermsOpen(false);
        }}
        type={termsType}
      />
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: OptionConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative w-full text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden ${
        selected
          ? `bg-gradient-to-br ${option.accent} ${option.ringColor} ring-2 shadow-[0_10px_40px_rgba(168,85,247,0.15)]`
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-0.5"
      }`}
    >
      {/* Badge */}
      {option.badge && (
        <span
          className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            option.badge.tone === "promo"
              ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
              : "border-sky-400/40 bg-sky-500/15 text-sky-200"
          }`}
        >
          {option.badge.tone === "promo" ? (
            <Sparkles className="h-2.5 w-2.5" />
          ) : (
            <Star className="h-2.5 w-2.5 fill-current" />
          )}
          {option.badge.text}
        </span>
      )}

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div
          className={`relative h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 ${
            selected
              ? `bg-gradient-to-br ${option.iconGradient} shadow-lg scale-105`
              : "bg-white/5 border border-white/10 group-hover:scale-105"
          }`}
        >
          <Icon
            className={`h-5 w-5 transition-colors ${selected ? "text-white" : "text-white/75"}`}
          />
          {selected && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 border-2 border-[#0d0e1a] flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </span>
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1 pr-16">
          <div
            className={`font-semibold transition-colors ${
              selected ? "text-white" : "text-white/95"
            }`}
          >
            {option.title}
          </div>
          <div className="text-xs sm:text-sm text-white/55 mt-0.5 leading-relaxed">
            {option.description}
          </div>
        </div>
      </div>
    </button>
  );
}
