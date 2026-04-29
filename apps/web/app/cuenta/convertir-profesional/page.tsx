"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  VenetianMask,
  ImagePlus,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";

import useMe from "../../../hooks/useMe";
import { apiFetch, getApiBase, friendlyErrorMessage } from "../../../lib/api";
import MapboxAddressAutocomplete from "../../../components/MapboxAddressAutocomplete";
import TermsModal from "../../../components/TermsModal";

const phoneRegex =
  /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/;

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
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
  { num: 1, label: "Datos" },
  { num: 2, label: "Servicio" },
  { num: 3, label: "Ubicación" },
];

export default function UpgradeToProfessionalPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const user = me?.user ?? null;

  const [subStep, setSubStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [phone, setPhone] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Step 2
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [bio, setBio] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Prefill from current user (one-shot once user loads)
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!user || prefilled) return;
    if (user.displayName) setDisplayName(user.displayName);
    if ((user as any).phone) setPhone(String((user as any).phone));
    if (user.gender) setGender(user.gender);
    if ((user as any).address) setAddress(String((user as any).address));
    if (user.birthdate) {
      const d = new Date(user.birthdate);
      if (!Number.isNaN(d.getTime())) {
        setBirthYear(String(d.getFullYear()));
        setBirthMonth(String(d.getMonth() + 1));
      }
    }
    setPrefilled(true);
  }, [user, prefilled]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      galleryPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Guard: only CLIENT can access this page
  useEffect(() => {
    if (meLoading || !user) return;
    const type = (user.profileType || "").toUpperCase();
    if (type && type !== "CLIENT") {
      router.replace("/cuenta");
    }
  }, [user, meLoading, router]);

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
    const toAdd = valid.slice(0, Math.max(0, remaining));
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

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (displayName.trim().length < 2)
        return "Tu nombre público debe tener al menos 2 caracteres.";
      if (!phoneRegex.test(phone.trim()))
        return "Ingresa un número válido con código de país (+56, +57, +58 o +51).";
      if (!birthYear || !birthMonth)
        return "Ingresa tu fecha de nacimiento.";
      const now = new Date();
      let age = now.getFullYear() - Number(birthYear);
      const mDiff = now.getMonth() - (Number(birthMonth) - 1);
      if (mDiff < 0) age -= 1;
      if (age < 18) return "Debes ser mayor de 18 años.";
    }
    if (step === 2) {
      if (!primaryCategory) return "Selecciona el tipo de servicio que ofreces.";
      if (galleryFiles.length < MIN_PHOTOS)
        return `Sube al menos ${MIN_PHOTOS} fotos para continuar.`;
    }
    if (step === 3) {
      if (
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        !latitude ||
        !longitude
      )
        return "Debes seleccionar una dirección válida desde el buscador de Mapbox.";
      if (!acceptTerms)
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

  async function uploadPendingPhotos(): Promise<void> {
    if (!galleryFiles.length) return;
    const base = getApiBase();
    const mediaForm = new FormData();
    for (const file of galleryFiles) {
      mediaForm.append("files", file);
    }
    const res = await fetch(`${base}/profile/media`, {
      method: "POST",
      body: mediaForm,
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || "No se pudieron subir las fotos.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
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
    setError(null);
    setSubmitting(true);
    try {
      // 1) Upload any newly selected photos so the backend can count them
      await uploadPendingPhotos();

      // 2) Call upgrade endpoint
      await apiFetch("/profile/upgrade-to-professional", {
        method: "POST",
        body: JSON.stringify({
          displayName: displayName.trim(),
          gender,
          phone: phone.trim(),
          primaryCategory,
          address,
          city: city || undefined,
          latitude: Number(latitude),
          longitude: Number(longitude),
          bio: bio.trim() || undefined,
          birthMonth,
          birthYear,
          acceptTerms: true,
        }),
      });

      setDone(true);
    } catch (err: any) {
      setError(
        err?.body?.message ||
          friendlyErrorMessage(err) ||
          "No se pudo convertir tu perfil. Intenta nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (meLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <p className="text-white/70">Inicia sesión para continuar.</p>
        <Link href="/login" className="btn-primary mt-4 inline-block px-6">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-xl py-10">
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400/30 to-violet-500/20 border border-fuchsia-400/30">
              <Sparkles className="h-8 w-8 text-fuchsia-200" />
            </div>
            <h2 className="text-xl font-bold text-fuchsia-100">¡Bienvenida!</h2>
            <p className="mt-2 text-sm text-white/70 leading-relaxed max-w-sm mx-auto">
              Tu perfil ahora es profesional. Para aparecer en la plataforma, un
              administrador verificará tu cuenta mediante una llamada telefónica.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
              <Phone className="h-3.5 w-3.5" />
              <span>Verificación telefónica manual</span>
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <a
              href="/dashboard/services"
              className="btn-primary flex-1 text-center flex items-center justify-center gap-2"
            >
              Ir a Creator Studio
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/cuenta" className="btn-secondary flex-1 text-center">
              Volver a mi cuenta
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl py-10">
      <Link
        href="/cuenta"
        className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mi cuenta
      </Link>

      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 blur-3xl scale-150 animate-pulse" />
          <div className="relative rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 p-3 shadow-2xl">
            <VenetianMask className="h-10 w-10 text-fuchsia-200" />
          </div>
        </div>
        <h1 className="mt-6 text-[1.65rem] md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent text-center">
          Conviértete en profesional
        </h1>
        <p className="mt-2 text-sm text-white/55 text-center max-w-sm leading-relaxed">
          Completa los datos para publicar tu perfil y empezar a recibir clientes.
        </p>
      </div>

      <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <form onSubmit={handleSubmit} className="relative p-6 sm:p-8 grid gap-4">
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

          {/* ─── Step 1: Datos personales ─── */}
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
                <label className="text-sm font-medium text-white/70">Teléfono</label>
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
            </>
          )}

          {/* ─── Step 2: Servicio + galería ─── */}
          {subStep === 2 && (
            <>
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

              <div className="grid gap-2">
                <label className="text-sm font-medium text-white/70">
                  Tus fotos *{" "}
                  <span className="font-normal text-white/30">
                    — mínimo {MIN_PHOTOS}, hasta {MAX_PHOTOS}
                  </span>
                </label>
                <p className="text-xs text-white/40 -mt-1">
                  La primera será tu foto principal de perfil.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
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
                              onClick={() => removeGalleryItem(idx)}
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
                  onChange={handleGalleryAdd}
                  className="hidden"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-white/30">
                    JPG, PNG o WebP. Máx 10 MB.
                  </p>
                  <p className="text-[10px] text-white/40">
                    {galleryFiles.length} de {MAX_PHOTOS}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ─── Step 3: Ubicación + términos ─── */}
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

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 rounded border-white/20 bg-white/5 accent-fuchsia-500"
                    checked={acceptTerms}
                    onChange={(e) => {
                      if (!acceptTerms) {
                        setTermsOpen(true);
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
                        setTermsOpen(true);
                      }}
                      className="text-fuchsia-300/80 hover:text-fuchsia-300 underline underline-offset-2 transition"
                    >
                      Términos y Condiciones
                    </button>{" "}
                    para perfiles profesionales.
                  </span>
                </label>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {subStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="btn-secondary flex-1 py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : subStep < 3 ? (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                "Convertirme en profesional"
              )}
            </button>
          </div>
        </form>
      </div>

      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          setAcceptTerms(true);
          setTermsOpen(false);
        }}
        type="business"
      />
    </div>
  );
}
