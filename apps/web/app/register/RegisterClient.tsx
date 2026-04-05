"use client";

import { useMemo, useState, useRef } from "react";
import AuthForm, { type RegisterFormData } from "../../components/AuthForm";
import TermsModal from "../../components/TermsModal";
import EmailVerification from "../../components/EmailVerification";
import Link from "next/link";
import { apiFetch, getApiBase, friendlyErrorMessage } from "../../lib/api";
import { Briefcase, Building2, ShoppingBag, User, Clock, Phone, CheckCircle2, ArrowLeft, ArrowRight, Camera, Upload, Sparkles, Gift } from "lucide-react";

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
  const [step, setStep] = useState<"choose" | "form" | "verify" | "avatar" | "pending">("choose");
  const [profileType, setProfileType] = useState<ProfileType>("CLIENT");
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [pendingFormData, setPendingFormData] = useState<RegisterFormData | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isBusinessProfile = profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP";
  const isProfessional = profileType === "PROFESSIONAL";

  const selected = useMemo(() => {
    if (profileType === "CLIENT") return consumerOption;
    return businessOptions.find((o) => o.key === profileType);
  }, [profileType]);

  const termsType = isBusinessProfile ? "business" : "client";

  // After email verified, create the account
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
      if (isProfessional) {
        // Professionals MUST upload a profile photo before continuing
        setStep("avatar");
      } else if (isBusinessProfile) {
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

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Solo se permiten imágenes (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("La imagen no puede superar 10 MB.");
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatarAndContinue() {
    if (!avatarFile) {
      setAvatarError("Debes subir una foto de perfil para continuar.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("file", avatarFile);
      const base = getApiBase();
      const resp = await fetch(`${base}/profile/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error("Error al subir la imagen.");
      }
      setStep("pending");
    } catch (err: any) {
      setAvatarError(err?.message || "Error al subir la imagen. Intenta nuevamente.");
    } finally {
      setUploadingAvatar(false);
    }
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
                : step === "avatar"
                  ? "Un último paso antes de completar tu registro"
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

              {/* Continue button */}
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(false);
                  setStep("form");
                }}
                className="mt-6 w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2"
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
            </div>
          ) : step === "avatar" ? (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-400/20">
                  <Camera className="h-7 w-7 text-fuchsia-300" />
                </div>
                <h2 className="text-xl font-bold text-white">Sube tu foto de perfil</h2>
                <p className="mt-1.5 text-sm text-white/50 leading-relaxed">
                  Una foto de perfil es <span className="text-fuchsia-300 font-semibold">obligatoria</span> para profesionales. Los perfiles con foto reciben muchas más visitas.
                </p>
              </div>

              {/* Avatar preview / upload area */}
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className={`relative group w-40 h-40 rounded-full border-2 border-dashed transition-all duration-200 overflow-hidden ${
                    avatarPreview
                      ? "border-fuchsia-400/50 shadow-[0_0_30px_rgba(232,121,249,0.15)]"
                      : "border-white/20 hover:border-fuchsia-400/40 hover:bg-white/[0.03]"
                  }`}
                >
                  {avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <Upload className="h-8 w-8 text-white/30" />
                      <span className="text-xs text-white/40">Toca para subir</span>
                    </div>
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <p className="text-xs text-white/30">JPG, PNG o WebP. Máximo 10 MB.</p>
              </div>

              {avatarError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center">
                  {avatarError}
                </div>
              )}

              <button
                type="button"
                onClick={uploadAvatarAndContinue}
                disabled={!avatarFile || uploadingAvatar}
                className="mt-6 w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Continuar
                  </>
                )}
              </button>
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
