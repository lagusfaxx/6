"use client";

import { useMemo, useState } from "react";
import AuthForm from "../../components/AuthForm";
import Link from "next/link";
import { Briefcase, Building2, ShoppingBag, User, Clock, Phone, CheckCircle2 } from "lucide-react";
import { API_URL } from "../../lib/api";
import Avatar from "../../components/Avatar";

type ProfileType = "CLIENT" | "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";

const consumerOption = {
  key: "CLIENT" as ProfileType,
  title: "Registro Cliente",
  description: "Busca perfiles, guarda favoritos y coordina por chat.",
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
    title: "Experiencia",
    description: "Ofrece experiencias con perfil completo, fotos y categorías.",
    icon: Briefcase
  },
  {
    key: "ESTABLISHMENT",
    title: "Motel / Hotel",
    description: "Administra habitaciones, promociones y reservas desde el Panel Motel.",
    icon: Building2
  },
  {
    key: "SHOP",
    title: "Tienda",
    description: "Comercios que venden artículos tipo sex shop se registran como Tienda.",
    icon: ShoppingBag
  }
];

export default function RegisterClient() {
  const [step, setStep] = useState<"choose" | "form" | "photo" | "pending">("choose");
  const [profileType, setProfileType] = useState<ProfileType>("CLIENT");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
          ? "Separamos el registro en Cliente y Registro Experiencia/Lugar/Tienda para que cada perfil tenga opciones lógicas y útiles."
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
      ) : step === "form" ? (
        <div className="mt-6">
          <AuthForm
            mode="register"
            initialProfileType={profileType}
            lockProfileType
            onSuccess={() => {
              if (profileType !== "CLIENT") {
                setStep("pending");
                return { redirect: null };
              }
              return { redirect: "/" };
            }}
          />
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="mt-4 text-sm text-white/60 underline"
          >
            Cambiar tipo de registro
          </button>
        </div>
      ) : step === "pending" ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
            <Clock className="mx-auto h-12 w-12 text-amber-400 mb-3" />
            <h2 className="text-xl font-semibold text-amber-200">Registro recibido</h2>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Tu perfil ha sido creado exitosamente. Para aparecer en la plataforma, un administrador
              verificara tu cuenta mediante una llamada telefonica.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/50">
              <Phone className="h-4 w-4" />
              <span>Verificacion telefonica manual</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold mb-2">Mientras tanto puedes:</h3>
            <ul className="text-sm text-white/60 space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                Subir tu foto de perfil y fotos de galeria
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                Completar tu descripcion y servicios
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                Configurar tus tarifas y disponibilidad
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/cuenta" className="btn-primary">Ir a mi perfil</Link>
            <Link href="/" className="btn-secondary">Volver al inicio</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold">Foto de perfil</h2>
            <p className="mt-1 text-sm text-white/60">Puedes subir una foto ahora o mas tarde desde tu panel.</p>
            <div className="mt-4 flex items-center gap-4">
              <Avatar src={avatarPreview} alt="Vista previa" size={72} className="border-white/20" />
              <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer inline-flex">
                {uploading ? "Subiendo..." : "Subir foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append("file", file);
                    setUploading(true);
                    try {
                      const res = await fetch(`${API_URL}/profile/avatar`, {
                        method: "POST",
                        credentials: "include",
                        body: form
                      });
                      if (!res.ok) throw new Error("UPLOAD_FAILED");
                      const data = await res.json();
                      setAvatarPreview(data?.avatarUrl || null);
                    } catch {
                      setAvatarPreview(null);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/cuenta" className="btn-primary">Continuar</Link>
            <Link href="/cuenta" className="btn-secondary">Omitir por ahora</Link>
          </div>
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
