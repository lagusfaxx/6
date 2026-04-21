"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import AuthForm, { type RegisterFormData } from "../../components/AuthForm";
import ProfessionalRegisterForm from "../../components/ProfessionalRegisterForm";
import TermsModal from "../../components/TermsModal";
import EmailVerification from "../../components/EmailVerification";
import Link from "next/link";
import { apiFetch, getApiBase, friendlyErrorMessage } from "../../lib/api";
import { Briefcase, Building2, ShoppingBag, User, Clock, Phone, CheckCircle2, ArrowLeft, ArrowRight, Sparkles, Gift } from "lucide-react";

function trialLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}

const FREE_TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_FREE_TRIAL_DAYS || 90);
const TRIAL_TEXT = `${trialLabel(FREE_TRIAL_DAYS)} gratis`;

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

const consumerOption = {
  key: "CLIENT" as ProfileType,
  title: "Cliente",
  description: "Busca perfiles, guarda favoritos y coordina por chat.",
  icon: User,
  gradient: "from-sky-500/20 to-blue-500/20",
  border: "border-sky-400/30",
};

const businessOptions: Array<{
  key: ProfileType;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  border: string;
}> = [
  {
    key: "PROFESSIONAL",
    title: "Experiencia",
    description: "Ofrece experiencias con perfil completo, fotos y categorías.",
    icon: Briefcase,
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    border: "border-fuchsia-400/30",
  },
  {
    key: "ESTABLISHMENT",
    title: "Motel / Hotel",
    description: "Administra habitaciones, promociones y reservas.",
    icon: Building2,
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-400/30",
  },
  {
    key: "SHOP",
    title: "Tienda",
    description: "Comercios que venden artículos tipo sex shop.",
    icon: ShoppingBag,
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-400/30",
  },
];

export default function RegisterClient() {
  const [step, setStep] = useState<"choose" | "form" | "verify" | "pending">("choose");
  const [profileType, setProfileType] = useState<ProfileType>("CLIENT");
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

  const isBusinessProfile = profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP";
  const isProfessional = profileType === "PROFESSIONAL";

  const selected = useMemo(() => {
    if (profileType === "CLIENT") return consumerOption;
    return businessOptions.find((o) => o.key === profileType);
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
            <img
              src="/brand/isotipo-new.png"
              alt="UZEED"
              className="relative w-20 h-20 rounded-2xl shadow-2xl"
            />
          </div>
          <h1 className="mt-5 text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center max-w-sm">
            {step === "choose"
              ? "Elige el tipo de cuenta que mejor se ajuste a ti"
              : step === "pending"
                ? "Tu registro ha sido recibido"
                : `Registrándote como: ${selected?.title ?? profileType}`}
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          {/* Promo banner for professionals */}
          {isProfessional && step === "form" && (
            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/20 to-pink-600/20 p-5 mx-8 mt-6 mb-0">
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
                    Regístrate ahora y disfruta {trialLabel(FREE_TRIAL_DAYS)} de membresía sin costo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === "choose" ? (
            <div className="p-8">
              {/* Client option */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">Consumidor</p>
                <button
                  type="button"
                  onClick={() => setProfileType("CLIENT")}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                    profileType === "CLIENT"
                      ? `${consumerOption.border} bg-gradient-to-br ${consumerOption.gradient} shadow-lg`
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl border border-white/10 flex items-center justify-center ${
                      profileType === "CLIENT" ? "bg-white/10" : "bg-white/5"
                    }`}>
                      <User className="h-5 w-5 text-white/80" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{consumerOption.title}</div>
                      <div className="text-sm text-white/50 mt-0.5">{consumerOption.description}</div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Business options */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">Profesional / Comercio</p>
                <div className="grid gap-3">
                  {businessOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = opt.key === profileType;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setProfileType(opt.key)}
                        className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                          active
                            ? `${opt.border} bg-gradient-to-br ${opt.gradient} shadow-lg`
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-11 w-11 rounded-xl border border-white/10 flex items-center justify-center ${
                            active ? "bg-white/10" : "bg-white/5"
                          }`}>
                            <Icon className="h-5 w-5 text-white/80" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">{opt.title}</div>
                            <div className="text-sm text-white/50 mt-0.5">{opt.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promo banner visible on type selection */}
              {profileType === "PROFESSIONAL" && (
                <div className="mt-5 relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/20 to-pink-600/20 p-4">
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-400/20">
                      <Gift className="h-5 w-5 text-fuchsia-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-sm font-bold text-white">{TRIAL_TEXT}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-white/60">Sin tarjeta de crédito. Empieza a recibir clientes hoy.</p>
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
                    className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/95 hover:bg-white text-gray-800 font-medium py-3.5 transition disabled:opacity-60"
                  >
                    {googleLoading ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                        </svg>
                        Continuar con Google
                      </>
                    )}
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 text-xs text-white/40 bg-[#0d0e1a]">o con correo</span>
                    </div>
                  </div>
                </>
              )}

              {/* Continue button */}
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(false);
                  setStep("form");
                }}
                className={`${profileType === "CLIENT" ? "" : "mt-6"} w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2`}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : step === "form" ? (
            <div className="p-8">
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
                <>
                  <AuthForm
                    mode="register"
                    initialProfileType={profileType}
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
                  <button
                    type="button"
                    onClick={() => {
                      setStep("choose");
                      setTermsAccepted(false);
                    }}
                    className="mt-4 flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Cambiar tipo de registro
                  </button>
                </>
              )}
            </div>
          ) : step === "pending" ? (
            <div className="p-8">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                <Clock className="mx-auto h-12 w-12 text-amber-400 mb-3" />
                <h2 className="text-xl font-semibold text-amber-200">Registro recibido</h2>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                  Tu perfil ha sido creado exitosamente. Para aparecer en la plataforma, un administrador
                  verificará tu cuenta mediante una llamada telefónica.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/50">
                  <Phone className="h-4 w-4" />
                  <span>Verificación telefónica manual</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold mb-2">Mientras tanto puedes:</h3>
                <ul className="text-sm text-white/60 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Subir tu foto de perfil y fotos de galería
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Completar tu descripción y servicios
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    Configurar tus tarifas y disponibilidad
                  </li>
                </ul>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/cuenta" className="btn-primary flex-1 text-center">
                  Ir a mi perfil
                </Link>
                <Link href="/" className="btn-secondary flex-1 text-center">
                  Volver al inicio
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-white/40">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-fuchsia-300/70 hover:text-fuchsia-300 underline transition">
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
