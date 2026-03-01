"use client";

import { useMemo, useState } from "react";
import AuthForm from "../../components/AuthForm";
import TermsModal from "../../components/TermsModal";
import EmailVerification from "../../components/EmailVerification";
import Link from "next/link";
import { Briefcase, Building2, ShoppingBag, User, Clock, Phone, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";

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

  const isBusinessProfile = profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP";

  const selected = useMemo(() => {
    if (profileType === "CLIENT") return consumerOption;
    return businessOptions.find((o) => o.key === profileType);
  }, [profileType]);

  const termsType = isBusinessProfile ? "business" : "client";

  // Email verification screen
  if (step === "verify") {
    return (
      <EmailVerification
        email={registeredEmail}
        onVerified={() => {
          if (isBusinessProfile) {
            setStep("pending");
          } else {
            window.location.replace("/");
          }
        }}
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
              <AuthForm
                mode="register"
                initialProfileType={profileType}
                lockProfileType
                termsAccepted={termsAccepted}
                onOpenTerms={() => setTermsOpen(true)}
                onSuccess={(data: any) => {
                  setRegisteredEmail(data?.user?.email || "");
                  setStep("verify");
                  return { redirect: null };
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
