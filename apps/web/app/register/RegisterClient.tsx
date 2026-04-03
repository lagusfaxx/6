"use client";

import { useMemo, useState, useRef } from "react";
import AuthForm, { type RegisterFormData } from "../../components/AuthForm";
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
  Camera,
  Upload,
  Sparkles,
  Gift,
  Shield,
  Star,
  Heart,
  MapPin,
  Store,
} from "lucide-react";

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

type Step = "choose" | "form" | "verify" | "avatar" | "pending";

const profileOptions: Array<{
  key: ProfileType;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  gradient: string;
  gradientBg: string;
  border: string;
  accentIcon: any;
  features: string[];
}> = [
  {
    key: "CLIENT",
    title: "Cliente",
    subtitle: "Consumidor",
    description: "Busca perfiles, guarda favoritos y coordina por chat.",
    icon: User,
    gradient: "from-sky-500 to-blue-600",
    gradientBg: "from-sky-500/15 to-blue-600/15",
    border: "border-sky-400/30",
    accentIcon: Heart,
    features: ["Buscar perfiles", "Chat privado", "Guardar favoritos"],
  },
  {
    key: "PROFESSIONAL",
    title: "Experiencia",
    subtitle: "Profesional",
    description: "Ofrece experiencias con perfil completo, fotos y categorías.",
    icon: Briefcase,
    gradient: "from-fuchsia-500 to-pink-600",
    gradientBg: "from-fuchsia-500/15 to-pink-600/15",
    border: "border-fuchsia-400/30",
    accentIcon: Star,
    features: ["Perfil premium", "Galería de fotos", "Membresía 3 meses gratis"],
  },
  {
    key: "ESTABLISHMENT",
    title: "Motel / Hotel",
    subtitle: "Establecimiento",
    description: "Administra habitaciones, promociones y reservas.",
    icon: Building2,
    gradient: "from-violet-500 to-purple-600",
    gradientBg: "from-violet-500/15 to-purple-600/15",
    border: "border-violet-400/30",
    accentIcon: MapPin,
    features: ["Gestión de reservas", "Promociones", "Ubicación en mapa"],
  },
  {
    key: "SHOP",
    title: "Tienda",
    subtitle: "Comercio",
    description: "Comercios que venden artículos tipo sex shop.",
    icon: ShoppingBag,
    gradient: "from-amber-500 to-orange-600",
    gradientBg: "from-amber-500/15 to-orange-600/15",
    border: "border-amber-400/30",
    accentIcon: Store,
    features: ["Catálogo de productos", "Ubicación en mapa", "Perfil comercial"],
  },
];

const stepLabels: Record<Step, string> = {
  choose: "Tipo de cuenta",
  form: "Datos",
  verify: "Verificación",
  avatar: "Foto de perfil",
  pending: "Confirmación",
};

function getStepsForProfile(profileType: ProfileType): Step[] {
  if (profileType === "PROFESSIONAL") {
    return ["choose", "form", "verify", "avatar", "pending"];
  }
  if (profileType === "ESTABLISHMENT" || profileType === "SHOP") {
    return ["choose", "form", "verify", "pending"];
  }
  return ["choose", "form", "verify"];
}

/* ── Step Indicator ── */
function StepIndicator({ steps, current }: { steps: Step[]; current: Step }) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  done
                    ? "w-8 bg-gradient-to-r from-fuchsia-500 to-violet-500"
                    : active
                      ? "w-8 bg-gradient-to-r from-fuchsia-400 to-violet-400 shadow-[0_0_12px_rgba(232,121,249,0.4)]"
                      : "w-2 bg-white/15"
                }`}
              />
              <span
                className={`text-[10px] mt-1.5 transition-colors whitespace-nowrap ${
                  done
                    ? "text-fuchsia-300/70"
                    : active
                      ? "text-white/70 font-medium"
                      : "text-white/25"
                }`}
              >
                {stepLabels[s]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RegisterClient() {
  const [step, setStep] = useState<Step>("choose");
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

  const isBusinessProfile =
    profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP";
  const isProfessional = profileType === "PROFESSIONAL";

  const selected = useMemo(() => {
    return profileOptions.find((o) => o.key === profileType)!;
  }, [profileType]);

  const termsType = isBusinessProfile ? "business" : "client";
  const steps = getStepsForProfile(profileType);

  async function createAccountAfterVerification() {
    if (!pendingFormData) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(pendingFormData),
      });
      if (isProfessional) {
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-start px-4 py-6 sm:py-10">
        <StepIndicator steps={steps} current="verify" />
        <EmailVerification
          email={registeredEmail}
          onVerified={createAccountAfterVerification}
          onBack={() => setStep("form")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start px-4 py-6 sm:py-10">
      <div className="w-full max-w-xl">
        {/* Step indicator */}
        <StepIndicator steps={steps} current={step} />

        {/* Logo + Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
            <img
              src="/brand/isotipo-new.png"
              alt="UZEED"
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-2xl"
            />
          </div>
          <h1 className="mt-5 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            {step === "choose"
              ? "Crear cuenta"
              : step === "pending"
                ? "Registro exitoso"
                : step === "avatar"
                  ? "Foto de perfil"
                  : "Completar registro"}
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center max-w-sm">
            {step === "choose"
              ? "Elige el tipo de cuenta que mejor se ajuste a ti"
              : step === "pending"
                ? "Tu registro ha sido recibido"
                : step === "avatar"
                  ? "Un último paso antes de completar tu registro"
                  : `Registrándote como ${selected?.title}`}
          </p>
        </div>

        {/* ─── CHOOSE STEP ─── */}
        {step === "choose" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <div className="grid gap-3 sm:grid-cols-2">
              {profileOptions.map((opt) => {
                const Icon = opt.icon;
                const AccentIcon = opt.accentIcon;
                const active = opt.key === profileType;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setProfileType(opt.key)}
                    className={`group relative w-full text-left rounded-2xl border p-5 transition-all duration-300 overflow-hidden ${
                      active
                        ? `${opt.border} bg-gradient-to-br ${opt.gradientBg} shadow-[0_8px_30px_rgba(0,0,0,0.3)] scale-[1.02]`
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05] hover:scale-[1.01]"
                    }`}
                  >
                    {/* Selection ring glow */}
                    {active && (
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${opt.gradientBg} opacity-50`} />
                    )}

                    {/* Top accent line */}
                    <div
                      className={`absolute inset-x-0 top-0 h-px transition-opacity duration-300 bg-gradient-to-r ${opt.gradient} ${
                        active ? "opacity-60" : "opacity-0 group-hover:opacity-30"
                      }`}
                    />

                    <div className="relative">
                      {/* Icon + Badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            active
                              ? `bg-gradient-to-br ${opt.gradient} shadow-lg`
                              : "bg-white/[0.06] border border-white/10 group-hover:bg-white/[0.08]"
                          }`}
                        >
                          <Icon className={`h-5.5 w-5.5 ${active ? "text-white" : "text-white/60"}`} />
                        </div>
                        {active && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="mb-3">
                        <span className="text-[10px] uppercase tracking-widest text-white/35 font-medium">
                          {opt.subtitle}
                        </span>
                        <h3 className="text-base font-semibold text-white mt-0.5">{opt.title}</h3>
                        <p className="text-xs text-white/45 mt-1 leading-relaxed">{opt.description}</p>
                      </div>

                      {/* Features list */}
                      <div className="space-y-1.5">
                        {opt.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <AccentIcon
                              className={`h-3 w-3 flex-shrink-0 ${
                                active ? "text-white/70" : "text-white/25"
                              }`}
                            />
                            <span
                              className={`text-[11px] ${
                                active ? "text-white/70" : "text-white/35"
                              }`}
                            >
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Promo badge for professionals */}
                      {opt.key === "PROFESSIONAL" && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/20 px-2.5 py-1">
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          <span className="text-[10px] font-semibold text-amber-300">3 meses gratis</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Continue button */}
            <button
              type="button"
              onClick={() => {
                setTermsAccepted(false);
                setStep("form");
              }}
              className="mt-6 w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 group"
            >
              Continuar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Login link */}
            <p className="mt-5 text-center text-sm text-white/40">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-fuchsia-300/70 hover:text-fuchsia-300 underline underline-offset-2 transition"
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        )}

        {/* ─── FORM STEP ─── */}
        {step === "form" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            {/* Profile type badge */}
            <div className="flex items-center justify-center mb-5">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${selected.border} bg-gradient-to-r ${selected.gradientBg}`}
              >
                <selected.icon className="h-4 w-4 text-white/70" />
                <span className="text-xs font-semibold text-white/80">{selected.title}</span>
              </div>
            </div>

            {/* Main card */}
            <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Top accent */}
              <div
                className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
                  selected.gradient.includes("sky")
                    ? "via-sky-400/50"
                    : selected.gradient.includes("fuchsia")
                      ? "via-fuchsia-400/50"
                      : selected.gradient.includes("violet")
                        ? "via-violet-400/50"
                        : "via-amber-400/50"
                } to-transparent`}
              />

              {/* Promo banner for professionals */}
              {isProfessional && (
                <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-r from-fuchsia-600/10 via-violet-600/10 to-pink-600/10 px-6 py-4">
                  <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-3xl" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-400/20">
                      <Gift className="h-5 w-5 text-fuchsia-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-sm font-bold text-white">Promo: 3 meses gratis</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/50 leading-relaxed">
                        Regístrate ahora y disfruta membresía sin costo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 sm:p-8">
                {registerError && (
                  <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 shrink-0 text-red-300" />
                    <span>{registerError}</span>
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
              </div>
            </div>

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setTermsAccepted(false);
              }}
              className="mt-4 mx-auto flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cambiar tipo de cuenta
            </button>

            {/* Login link */}
            <p className="mt-4 text-center text-sm text-white/40">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-fuchsia-300/70 hover:text-fuchsia-300 underline underline-offset-2 transition"
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        )}

        {/* ─── AVATAR STEP ─── */}
        {step === "avatar" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-400/15">
                    <Camera className="h-8 w-8 text-fuchsia-300" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Sube tu foto de perfil</h2>
                  <p className="mt-2 text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
                    Una foto de perfil es{" "}
                    <span className="text-fuchsia-300 font-semibold">obligatoria</span> para
                    profesionales. Los perfiles con foto reciben muchas más visitas.
                  </p>
                </div>

                {/* Avatar upload area */}
                <div className="flex flex-col items-center gap-5">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className={`relative group w-44 h-44 rounded-full border-2 border-dashed transition-all duration-300 overflow-hidden ${
                      avatarPreview
                        ? "border-fuchsia-400/50 shadow-[0_0_40px_rgba(232,121,249,0.15)]"
                        : "border-white/15 hover:border-fuchsia-400/30 hover:bg-white/[0.03] hover:shadow-[0_0_30px_rgba(232,121,249,0.1)]"
                    }`}
                  >
                    {avatarPreview ? (
                      <>
                        <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Camera className="h-6 w-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2.5">
                        <div className="h-14 w-14 rounded-full bg-white/[0.06] flex items-center justify-center">
                          <Upload className="h-7 w-7 text-white/30" />
                        </div>
                        <span className="text-xs text-white/40 font-medium">Toca para subir</span>
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
                  <p className="text-xs text-white/30">JPG, PNG o WebP — Máximo 10 MB</p>
                </div>

                {avatarError && (
                  <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center">
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
            </div>
          </div>
        )}

        {/* ─── PENDING STEP ─── */}
        {step === "pending" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

              <div className="p-6 sm:p-8">
                {/* Success card */}
                <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">¡Registro exitoso!</h2>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
                    Tu perfil ha sido creado. Para aparecer en la plataforma, un administrador
                    verificará tu cuenta mediante una llamada telefónica.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 px-4 py-2 text-sm text-white/50">
                    <Phone className="h-4 w-4" />
                    <span>Verificación telefónica pendiente</span>
                  </div>
                </div>

                {/* While you wait */}
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-white/40" />
                    Mientras tanto puedes:
                  </h3>
                  <ul className="space-y-2.5">
                    {[
                      "Subir tu foto de perfil y fotos de galería",
                      "Completar tu descripción y servicios",
                      "Configurar tus tarifas y disponibilidad",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        </div>
                        <span className="text-sm text-white/55">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Link
                    href="/cuenta"
                    className="btn-primary text-center text-sm py-3 flex items-center justify-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    Mi perfil
                  </Link>
                  <Link
                    href="/"
                    className="btn-secondary text-center text-sm py-3 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Inicio
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
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
