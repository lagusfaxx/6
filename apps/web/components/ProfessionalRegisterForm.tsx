"use client";

import { Fragment, useState } from "react";
import { type RegisterFormData } from "./AuthForm";
import MapboxAddressAutocomplete from "./MapboxAddressAutocomplete";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  Gift,
  ImagePlus,
  X,
} from "lucide-react";

const phoneRegex =
  /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/;

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function buildYearOptions() {
  const now = new Date();
  const maxYear = now.getFullYear() - 18;
  const minYear = now.getFullYear() - 80;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  return years;
}

const YEAR_OPTIONS = buildYearOptions();

const STEPS = [
  { num: 1, label: "Cuenta" },
  { num: 2, label: "Perfil" },
  { num: 3, label: "Ubicación" },
];

export default function ProfessionalRegisterForm({
  termsAccepted: externalTermsAccepted,
  onOpenTerms,
  onCollectData,
  onBack,
  galleryFiles,
  galleryPreviews,
  onGalleryAdd,
  onGalleryRemove,
  galleryInputRef,
  minPhotos,
  maxPhotos,
}: {
  termsAccepted: boolean;
  onOpenTerms: () => void;
  onCollectData: (data: RegisterFormData) => void;
  onBack: () => void;
  galleryFiles: File[];
  galleryPreviews: string[];
  onGalleryAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryRemove: (idx: number) => void;
  galleryInputRef: React.RefObject<HTMLInputElement | null>;
  minPhotos: number;
  maxPhotos: number;
}) {
  const [subStep, setSubStep] = useState(1);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [gender, setGender] = useState("FEMALE");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");

  // Step 3
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [bio, setBio] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const finalTermsAccepted = externalTermsAccepted ?? acceptTerms;

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (displayName.trim().length < 2)
        return "El nombre público debe tener al menos 2 caracteres.";
      if (username.trim().length < 3)
        return "El nombre de usuario debe tener al menos 3 caracteres.";
      if (!email.trim()) return "Ingresa tu email.";
      if (!phoneRegex.test(phone.trim()))
        return "Ingresa un número válido con código de país (+56, +57, +58 o +51).";
      if (password.length < 8)
        return "La contraseña debe tener al menos 8 caracteres.";
    }
    if (step === 2) {
      if (!birthYear || !birthMonth)
        return "Ingresa tu fecha de nacimiento.";
      const now = new Date();
      const bYear = Number(birthYear);
      const bMonth = Number(birthMonth);
      let age = now.getFullYear() - bYear;
      const mDiff = now.getMonth() - (bMonth - 1);
      if (mDiff < 0) age -= 1;
      if (age < 18) return "Debes ser mayor de 18 años.";
      if (!primaryCategory) return "Selecciona una categoría.";
      if (galleryFiles.length < minPhotos)
        return `Debes subir al menos ${minPhotos} fotos para continuar.`;
    }
    if (step === 3) {
      if (
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        !latitude ||
        !longitude
      )
        return "Debes seleccionar una dirección válida desde el buscador de Mapbox.";
      if (!finalTermsAccepted)
        return "Debes aceptar los términos y condiciones para continuar.";
    }
    return null;
  }

  function handleNext() {
    const err = validateStep(subStep);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubStep(subStep + 1);
  }

  function handleBack() {
    setError(null);
    setSubStep(subStep - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subStep < 3) {
      handleNext();
      return;
    }
    const err = validateStep(3);
    if (err) {
      setError(err);
      return;
    }
    const birthdate =
      birthYear && birthMonth
        ? `${birthYear}-${birthMonth.padStart(2, "0")}-01`
        : undefined;

    const formData: RegisterFormData = {
      email,
      password,
      displayName,
      username,
      phone,
      gender,
      primaryCategory: primaryCategory || undefined,
      profileType: "PROFESSIONAL",
      address,
      city: city || undefined,
      latitude: Number(latitude),
      longitude: Number(longitude),
      acceptTerms: finalTermsAccepted,
      birthdate,
      bio: bio || undefined,
      referralCode: referralCode.trim() || undefined,
    };
    onCollectData(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-2">
        {STEPS.map((s, i) => (
          <Fragment key={s.num}>
            {i > 0 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  subStep > s.num - 1 ? "bg-fuchsia-500" : "bg-white/10"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  subStep > s.num
                    ? "bg-fuchsia-500 text-white"
                    : subStep === s.num
                      ? "bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25"
                      : "border border-white/20 bg-white/5 text-white/40"
                }`}
              >
                {subStep > s.num ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-[10px] ${
                  subStep >= s.num ? "text-white/70" : "text-white/30"
                }`}
              >
                {s.label}
              </span>
            </div>
          </Fragment>
        ))}
      </div>

      {/* ─── Step 1: Cuenta ─── */}
      {subStep === 1 && (
        <>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Nombre público
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: Agus"
              required
              minLength={2}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Nombre de usuario
            </label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tuusuario"
              required
              minLength={3}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">Email</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              type="email"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Teléfono
            </label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678 / +57 3..."
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Contraseña
            </label>
            <div className="relative">
              <input
                className="input pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition p-1"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Step 2: Perfil ─── */}
      {subStep === 2 && (
        <>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">Género</label>
            <div className="relative">
              <select
                className="input select-dark"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="FEMALE">Mujer</option>
                <option value="MALE">Hombre</option>
                <option value="OTHER">Otro</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
                ▾
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Fecha de nacimiento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select
                  className="input select-dark"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                >
                  <option value="">Mes</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
                  ▾
                </span>
              </div>
              <div className="relative">
                <select
                  className="input select-dark"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                >
                  <option value="">Año</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
                  ▾
                </span>
              </div>
            </div>
            <p className="text-xs text-white/40">
              Debes ser mayor de 18 años.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              ¿Cómo te defines? (categoría principal)
            </label>
            <div className="relative">
              <select
                className="input appearance-none pr-10"
                value={primaryCategory}
                onChange={(e) => setPrimaryCategory(e.target.value)}
              >
                <option value="">Selecciona tu categoría</option>
                <option value="escort">Escort / Acompañante</option>
                <option value="masajes">Masajista</option>
                <option value="trans">Trans</option>
                <option value="despedidas">Despedidas de soltero</option>
                <option value="videollamadas">Videollamadas</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
                ▾
              </span>
            </div>
          </div>

          {/* Gallery photos */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Tus fotos *{" "}
              <span className="font-normal text-white/30">
                — mínimo {minPhotos}, hasta {maxPhotos}
              </span>
            </label>
            <p className="text-xs text-white/40 -mt-1">
              La primera será tu foto principal de perfil.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: maxPhotos }).map((_, idx) => {
                const hasPhoto = idx < galleryPreviews.length;
                return (
                  <div
                    key={idx}
                    className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                  >
                    {hasPhoto ? (
                      <>
                        <img
                          src={galleryPreviews[idx]}
                          alt={`Foto ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {idx === 0 && (
                          <span className="absolute left-1 top-1 rounded-md bg-fuchsia-500/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            Principal
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onGalleryRemove(idx)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-red-500/80 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/20 transition-colors hover:text-fuchsia-400/60"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="text-[9px]">Agregar</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onGalleryAdd}
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/30">
                JPG, PNG o WebP. Máx 10 MB.
              </p>
              <p className="text-[10px] text-white/40">
                {galleryFiles.length} de {maxPhotos}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ─── Step 3: Ubicación y términos ─── */}
      {subStep === 3 && (
        <>
          <MapboxAddressAutocomplete
            label="Dirección"
            value={address}
            onChange={(next) => {
              setAddress(next);
              setLatitude("");
              setLongitude("");
            }}
            onSelect={(selection) => {
              setAddress(selection.placeName);
              setCity(selection.city || "");
              setLatitude(String(selection.latitude));
              setLongitude(String(selection.longitude));
            }}
            placeholder="Busca tu dirección"
            required
          />
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Tu dirección exacta{" "}
              <span className="font-semibold">nunca se muestra</span>. Los
              clientes solo ven una zona aproximada (~600 m) en el mapa.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Descripción del perfil
            </label>
            <textarea
              className="input min-h-[110px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe tu experiencia en pocas líneas (puedes completar después)."
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/70">
              Código de referido
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                <Gift className="h-4 w-4" />
              </div>
              <input
                className="input pl-10"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Opcional"
                maxLength={20}
              />
            </div>
            <p className="text-xs text-white/40">
              Si alguien te invitó, ingresa su código aquí.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 rounded border-white/20 bg-white/5 accent-fuchsia-500"
                checked={finalTermsAccepted}
                onChange={(e) => {
                  if (onOpenTerms && !finalTermsAccepted) {
                    onOpenTerms();
                  } else {
                    setAcceptTerms(e.target.checked);
                  }
                }}
              />
              <span className="text-sm text-white/60 leading-relaxed">
                He leído y acepto los{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenTerms();
                  }}
                  className="inline-flex items-center gap-1 text-fuchsia-300/80 hover:text-fuchsia-300 underline underline-offset-2 transition"
                >
                  <FileText className="h-3 w-3" />
                  Términos y Condiciones
                </button>{" "}
                de la plataforma.
              </span>
            </label>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {subStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="btn-secondary flex-1 py-3.5 text-base flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Atrás
          </button>
        )}
        <button
          type="submit"
          className="btn-primary flex-1 py-3.5 text-base flex items-center justify-center gap-2"
        >
          {subStep < 3 ? (
            <>
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            "Crear cuenta"
          )}
        </button>
      </div>

      {/* Back to profile type selection */}
      {subStep === 1 && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cambiar tipo de registro
        </button>
      )}
    </form>
  );
}
