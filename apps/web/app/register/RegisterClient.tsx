"use client";

import { useMemo, useState } from "react";
import AuthForm from "../../components/AuthForm";
import Link from "next/link";
import { Briefcase, Building2, ShoppingBag, User } from "lucide-react";

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

const consumerOption = {
  key: "CLIENT" as ProfileType,
  title: "👤 Registro Cliente",
  description: "Solo consume: busca perfiles, guarda favoritos, chatea y solicita servicios.",
  icon: User
};

const businessOptions: Array<{
  key: ProfileType;
  title: string;
  description: string;
  icon: any;
}> = [
  {
    key: "PROFESSIONAL",
    title: "💃 Profesional",
    description: "Perfil para ofrecer servicios personales con galería y contacto.",
    icon: Briefcase
  },
  {
    key: "ESTABLISHMENT",
    title: "🏨 Motel / Night Club",
    description: "Publica habitaciones y servicios del establecimiento tipo booking.",
    icon: Building2
  },
  {
    key: "SHOP",
    title: "🛒 Tienda",
    description: "Todo comercio que vende artículos tipo sex shop se registra como Tienda.",
    icon: ShoppingBag
  }
];

export default function RegisterClient() {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [profileType, setProfileType] = useState<ProfileType>("CLIENT");

  const selected = useMemo(() => {
    if (profileType === "CLIENT") return consumerOption;
    return businessOptions.find((o) => o.key === profileType);
  }, [profileType]);

  return (
    <div className="max-w-xl mx-auto card p-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-400/60 via-purple-400/60 to-transparent" />
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 text-sm text-white/60">
        {step === "choose"
          ? "Separamos el registro en Cliente y Registro Profesional/Comercio para que cada perfil tenga opciones lógicas y útiles."
          : `Registrándote como: ${selected?.title ?? profileType}`}
      </p>

      {step === "choose" ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-white/50">Registro consumidor</div>
            <button
              type="button"
              onClick={() => setProfileType("CLIENT")}
              className={`w-full text-left rounded-2xl border p-5 transition ${
                profileType === "CLIENT" ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/25"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-white/80" />
                </div>
                <div className="grid gap-1">
                  <div className="font-semibold">{consumerOption.title}</div>
                  <div className="text-sm text-white/60">{consumerOption.description}</div>
                </div>
              </div>
            </button>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-white/50">Registro profesional / comercio</div>
            <div className="grid gap-3">
              {businessOptions.map((opt) => {
                const Icon = opt.icon;
                const active = opt.key === profileType;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setProfileType(opt.key)}
                    className={`text-left rounded-2xl border p-5 transition ${
                      active ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white/80" />
                      </div>
                      <div className="grid gap-1">
                        <div className="font-semibold">{opt.title}</div>
                        <div className="text-sm text-white/60">{opt.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mt-1 rounded-2xl bg-white text-black font-semibold py-3 hover:bg-white/90 transition"
          >
            Continuar
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <AuthForm mode="register" initialProfileType={profileType} lockProfileType />
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="mt-4 text-sm text-white/60 underline"
          >
            Cambiar tipo de registro
          </button>
        </div>
      )}

      <div className="mt-6 text-sm text-white/60">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-white underline">
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
