"use client";

import { useMemo, useState } from "react";
import AuthForm from "../../components/AuthForm";
import Link from "next/link";
import { Briefcase, Building2, ShoppingBag, User } from "lucide-react";

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

const options: Array<{
  key: ProfileType;
  title: string;
  description: string;
  icon: any;
}> = [
  {
    key: "CLIENT",
    title: "👤 Cliente",
    description: "Busca profesionales y establecimientos, chatea, solicita servicios y califica",
    icon: User
  },
  {
    key: "PROFESSIONAL",
    title: "💃 Profesional",
    description: "Ofrece servicios, gestiona perfil, ubicación, galería, precios y contactos",
    icon: Briefcase
  },
  {
    key: "ESTABLISHMENT",
    title: "🏨 Establecimiento / Motel / Night Club",
    description: "Publica habitaciones, packs, promociones y recibe solicitudes",
    icon: Building2
  },
  {
    key: "SHOP",
    title: "🛒 Sex Shop",
    description: "Publica productos con foto, precio, stock y descripción",
    icon: ShoppingBag
  }
];

export default function RegisterClient() {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [profileType, setProfileType] = useState<ProfileType>("CLIENT");

  const selected = useMemo(() => options.find((o) => o.key === profileType), [profileType]);

  return (
    <div className="max-w-xl mx-auto card p-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-400/60 via-purple-400/60 to-transparent" />
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 text-sm text-white/60">
        {step === "choose"
          ? "Primero elige tu tipo de perfil. Esto define cómo funciona toda la app (no es decorativo)."
          : `Registrándote como: ${selected?.title ?? profileType}`}
      </p>

      {step === "choose" ? (
        <div className="mt-6 grid gap-3">
          {options.map((opt) => {
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

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mt-2 rounded-2xl bg-white text-black font-semibold py-3 hover:bg-white/90 transition"
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
            Cambiar tipo de perfil
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
