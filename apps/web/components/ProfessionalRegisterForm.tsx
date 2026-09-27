"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type RegisterFormData } from "./AuthForm";
import MapboxAddressAutocomplete from "./MapboxAddressAutocomplete";
import QuickRepliesEditor from "./QuickRepliesEditor";
import {
  QUICK_REPLY_MIN_LENGTH,
  QUICK_REPLY_TOPICS,
  cleanQuickReplies,
  quickRepliesError,
  type QuickReplies,
  type QuickReplyKey,
} from "../lib/quickReplies";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  Gift,
  ImagePlus,
  X,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

/* Mismo tope que valida la API (`DISPLAY_NAME_MAX_LENGTH` en @uzeed/shared).
   Se repite aquí para no arrastrar el paquete compartido —y zod con él— al
   bundle del cliente, igual que ya se hace con el regex del teléfono. */
const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 20;

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

const GENDERS = [
  { value: "FEMALE", label: "Mujer" },
  { value: "MALE", label: "Hombre" },
  /* "Trans" es el nombre que usa todo el sitio para OTHER (Explorar,
     Publícate) y la API le suma la etiqueta "trans" del directorio. */
  { value: "OTHER", label: "Trans" },
];

const CATEGORIES = [
  { value: "escort", label: "Escort", hint: "Acompañante", emoji: "💋" },
  { value: "masajes", label: "Masajista", hint: "Masajes", emoji: "💆" },
  { value: "despedidas", label: "Despedidas", hint: "De soltero", emoji: "🎉" },
  { value: "videollamadas", label: "Videollamadas", hint: "Solo online", emoji: "📱" },
];

/* Pasos cortos, una idea por pantalla: en el teléfono el registro era una
   sola columna larguísima. */
const STEPS = [
  { label: "Cuenta", title: "Crea tu cuenta", subtitle: "Tus datos de acceso. Tu correo y teléfono no se publican." },
  { label: "Sobre ti", title: "Cuéntanos de ti", subtitle: "Así te encuentran los clientes que buscan lo que ofreces." },
  { label: "Fotos", title: "Tus fotos", subtitle: "Los perfiles con buenas fotos reciben muchos más mensajes." },
  { label: "Tu chat", title: "Respuestas rápidas", subtitle: "Los clientes tocan “Tarifa” o “Servicios” en tu chat y reciben tu respuesta al instante, aunque no estés conectada." },
  { label: "Ubicación", title: "¿Dónde atiendes?", subtitle: "Último paso. Tu dirección exacta nunca se muestra." },
] as const;

const TOTAL_STEPS = STEPS.length;

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
  initialEmail,
  initialDisplayName,
  lockEmail = false,
  skipPassword = false,
  submitLabel,
}: {
  termsAccepted: boolean;
  onOpenTerms: () => void;
  onCollectData: (data: RegisterFormData) => void;
  onBack: () => void;
  galleryFiles: File[];
  galleryPreviews: string[];
  onGalleryAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryRemove: (idx: number) => void;
  galleryInputRef: React.RefObject<HTMLInputElement>;
  minPhotos: number;
  maxPhotos: number;
  initialEmail?: string;
  initialDisplayName?: string;
  lockEmail?: boolean;
  skipPassword?: boolean;
  submitLabel?: string;
}) {
  const [subStep, setSubStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  // Paso 1
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [email, setEmail] = useState(initialEmail || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Paso 2
  const [gender, setGender] = useState("FEMALE");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");

  // Paso 4
  const [quickReplies, setQuickReplies] = useState<QuickReplies>({});
  const [quickFocus, setQuickFocus] = useState<QuickReplyKey | null>(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState("");

  // Paso 5
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [bio, setBio] = useState("");
  const [showBio, setShowBio] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const finalTermsAccepted = externalTermsAccepted ?? acceptTerms;

  // Cada paso parte arriba: en el teléfono el botón queda abajo y, sin esto,
  // el paso siguiente aparecía a media pantalla.
  useEffect(() => {
    // Sólo la ventana: scrollIntoView también desplazaba el interior de la
    // tarjeta (overflow-hidden en PC) y la dejaba cortada arriba.
    const el = topRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    if (top < window.scrollY) window.scrollTo({ top, behavior: "smooth" });
  }, [subStep]);

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (displayName.trim().length < DISPLAY_NAME_MIN_LENGTH)
        return `El nombre público debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`;
      if (displayName.trim().length > DISPLAY_NAME_MAX_LENGTH)
        return `El nombre público no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
      if (!email.trim()) return "Ingresa tu email.";
      if (!phoneRegex.test(phone.trim()))
        return "Ingresa un número válido con código de país (+56, +57, +58 o +51).";
      if (!skipPassword && password.length < 8)
        return "La contraseña debe tener al menos 8 caracteres.";
    }
    if (step === 2) {
      if (!birthYear || !birthMonth) return "Ingresa tu fecha de nacimiento.";
      const now = new Date();
      const bYear = Number(birthYear);
      const bMonth = Number(birthMonth);
      let age = now.getFullYear() - bYear;
      const mDiff = now.getMonth() - (bMonth - 1);
      if (mDiff < 0) age -= 1;
      if (age < 18) return "Debes ser mayor de 18 años.";
      if (!primaryCategory) return "Elige cómo te defines.";
    }
    if (step === 3) {
      if (galleryFiles.length < minPhotos)
        return `Sube al menos ${minPhotos} fotos para continuar.`;
    }
    if (step === 4) {
      const quickError = quickRepliesError(quickReplies);
      if (quickError) {
        // Abre la primera obligatoria que falta para que la vea sin buscar.
        const firstMissing = QUICK_REPLY_TOPICS.find(
          (t) => t.required && (quickReplies[t.key] || "").trim().length < QUICK_REPLY_MIN_LENGTH,
        );
        if (firstMissing) setQuickFocus(firstMissing.key);
        return quickError;
      }
      if (autoReplyEnabled && autoReplyMessage.trim().length < 5)
        return "Escribe el mensaje automático que quieres enviar (mínimo 5 caracteres).";
    }
    if (step === 5) {
      if (
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        !latitude ||
        !longitude
      )
        return "Elige tu dirección desde la lista de sugerencias.";
      if (!finalTermsAccepted)
        return "Debes aceptar los términos y condiciones para continuar.";
    }
    return null;
  }

  function goTo(step: number) {
    setDirection(step > subStep ? 1 : -1);
    setError(null);
    setSubStep(step);
  }

  function handleBack() {
    if (subStep === 1) {
      onBack();
      return;
    }
    goTo(subStep - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep(subStep);
    if (err) {
      setError(err);
      return;
    }
    if (subStep < TOTAL_STEPS) {
      goTo(subStep + 1);
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
      autoReplyEnabled: autoReplyEnabled && autoReplyMessage.trim().length > 0,
      autoReplyMessage: autoReplyMessage.trim() || undefined,
      quickReplies: cleanQuickReplies(quickReplies),
    };
    onCollectData(formData);
  }

  const current = STEPS[subStep - 1];

  return (
    /* En el teléfono ocupa el alto de la pantalla (menos la cabecera) para
       que la barra de botones quede abajo aunque el paso sea corto. */
    <form
      onSubmit={handleSubmit}
      className="relative flex min-h-[calc(100svh-6rem)] flex-col sm:block sm:min-h-0"
    >
      <div ref={topRef} className="scroll-mt-4" />

      {/* Progreso: barra por pasos + título del paso */}
      <div className="mb-5">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              /* Se puede volver a un paso ya hecho tocando su barra. */
              onClick={() => i + 1 < subStep && goTo(i + 1)}
              disabled={i + 1 >= subStep}
              aria-label={`Paso ${i + 1}: ${s.label}`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 disabled:cursor-default"
            >
              <span
                className={`block h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-500 ${
                  i + 1 <= subStep ? "w-full" : "w-0"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
          Paso {subStep} de {TOTAL_STEPS} · {current.label}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">{current.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">{current.subtitle}</p>
      </div>

      <div className="flex-1">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={subStep}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid gap-4"
        >
          {/* ─── Paso 1: Cuenta ─── */}
          {subStep === 1 && (
            <>
              <div className="grid gap-2">
                <label className="flex items-center justify-between text-sm font-medium text-white/70">
                  Nombre público
                  <span className="text-[11px] font-normal text-white/35">
                    {displayName.trim().length}/{DISPLAY_NAME_MAX_LENGTH}
                  </span>
                </label>
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Agus"
                  required
                  minLength={DISPLAY_NAME_MIN_LENGTH}
                  /* Los nombres largos rompen las tarjetas del inicio, así que se
                     cortan aquí y no después a mano. */
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  autoComplete="nickname"
                />
                <p className="text-[11px] text-white/35">
                  Con este nombre te verán tus clientes. Después solo se cambia con
                  aprobación del equipo.
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-white/70">Email</label>
                <input
                  className={`input ${lockEmail ? "cursor-not-allowed opacity-70" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  readOnly={lockEmail}
                />
                {lockEmail && (
                  <p className="text-xs text-white/40">
                    Usaremos tu correo de Google (ya verificado).
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-white/70">Teléfono (WhatsApp)</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </div>

              {!skipPassword && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-white/70">Contraseña</label>
                  <div className="relative">
                    <input
                      className="input pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 transition hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Paso 2: Sobre ti ─── */}
          {subStep === 2 && (
            <>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-white/70">¿Cómo te defines?</span>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => {
                    const selected = primaryCategory === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setPrimaryCategory(c.value)}
                        aria-pressed={selected}
                        className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                          selected
                            ? "border-fuchsia-400/60 bg-gradient-to-br from-fuchsia-500/25 to-violet-500/15 shadow-[0_8px_24px_-10px_rgba(217,70,239,0.6)]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="text-xl leading-none">{c.emoji}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-white">{c.label}</span>
                          <span className="block truncate text-[11px] text-white/45">{c.hint}</span>
                        </span>
                        {selected && (
                          <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-fuchsia-200" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium text-white/70">Género</span>
                <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value)}
                      aria-pressed={gender === g.value}
                      className={`rounded-xl py-2.5 text-sm font-medium transition ${
                        gender === g.value
                          ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow"
                          : "text-white/55 hover:text-white/80"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium text-white/70">Fecha de nacimiento</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      className="input select-dark"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      aria-label="Mes de nacimiento"
                    >
                      <option value="">Mes</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  </div>
                  <div className="relative">
                    <select
                      className="input select-dark"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      aria-label="Año de nacimiento"
                    >
                      <option value="">Año</option>
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  </div>
                </div>
                <p className="text-xs text-white/40">Debes ser mayor de 18 años. No se muestra tu fecha, solo tu edad.</p>
              </div>
            </>
          )}

          {/* ─── Paso 3: Fotos ─── */}
          {subStep === 3 && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/45">
                  Mínimo {minPhotos}, hasta {maxPhotos}. La primera es tu foto principal.
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                    galleryFiles.length >= minPhotos
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {galleryFiles.length}/{maxPhotos}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: maxPhotos }).map((_, idx) => {
                  const hasPhoto = idx < galleryPreviews.length;
                  const isNextSlot = idx === galleryPreviews.length;
                  return (
                    <div
                      key={idx}
                      className={`relative aspect-[3/4] overflow-hidden rounded-2xl border ${
                        isNextSlot
                          ? "border-dashed border-fuchsia-400/40 bg-fuchsia-500/[0.06]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      {hasPhoto ? (
                        <>
                          <img
                            src={galleryPreviews[idx]}
                            alt={`Foto ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {idx === 0 && (
                            <span className="absolute left-1.5 top-1.5 rounded-md bg-fuchsia-500/85 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              Principal
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onGalleryRemove(idx)}
                            aria-label={`Quitar foto ${idx + 1}`}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 transition hover:bg-red-500/80"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-colors ${
                            isNextSlot ? "text-fuchsia-300/80" : "text-white/20 hover:text-fuchsia-400/60"
                          }`}
                        >
                          <ImagePlus className="h-6 w-6" />
                          <span className="text-[10px]">Agregar</span>
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
              <p className="text-[11px] text-white/35">
                JPG, PNG o WebP, hasta 10 MB. Solo fotos tuyas y sin datos de contacto.
              </p>
            </div>
          )}

          {/* ─── Paso 4: Respuestas rápidas + mensaje automático ─── */}
          {subStep === 4 && (
            <>
              <QuickRepliesEditor
                value={quickReplies}
                onChange={(next) => {
                  setQuickReplies(next);
                  setError(null);
                }}
                focusKey={quickFocus}
              />

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 shrink-0 text-fuchsia-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white/85">Mensaje automático</span>
                    <span className="block text-[11px] leading-snug text-white/45">
                      Un saludo que se envía solo cuando alguien te escribe.
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoReplyEnabled}
                    aria-label="Activar mensaje automático"
                    onClick={() => setAutoReplyEnabled((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      autoReplyEnabled ? "bg-fuchsia-600" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        autoReplyEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {autoReplyEnabled && (
                  <div className="mt-3 grid gap-1.5">
                    <textarea
                      className="input min-h-[80px]"
                      value={autoReplyMessage}
                      onChange={(e) => setAutoReplyMessage(e.target.value.slice(0, 500))}
                      placeholder="Hola, gracias por escribirme. En un rato te respondo."
                      maxLength={500}
                    />
                    <p className="text-[11px] text-white/35">{autoReplyMessage.length}/500</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── Paso 5: Ubicación y términos ─── */}
          {subStep === 5 && (
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
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-xs leading-relaxed text-emerald-300/80">
                  Los clientes solo ven una zona aproximada (~600 m) en el mapa.
                </p>
              </div>

              {/* Opcionales: plegados para no alargar el paso */}
              <div className="grid gap-2">
                {showBio ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/70">Descripción del perfil</label>
                    <textarea
                      className="input min-h-[96px]"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Describe tu experiencia en pocas líneas."
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBio(true)}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.06]"
                  >
                    <span>
                      + Agregar descripción <span className="text-white/35">(opcional)</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/35" />
                  </button>
                )}

                {showReferral ? (
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      className="input pl-10"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Código de quien te invitó"
                      maxLength={20}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReferral(true)}
                    className="justify-self-start px-1 text-xs text-white/45 underline-offset-2 transition hover:text-white/70 hover:underline"
                  >
                    ¿Te invitó alguien? Ingresa su código
                  </button>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
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
                <span className="text-sm leading-relaxed text-white/60">
                  He leído y acepto los{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenTerms();
                    }}
                    className="inline-flex items-center gap-1 text-fuchsia-300/80 underline underline-offset-2 transition hover:text-fuchsia-300"
                  >
                    <FileText className="h-3 w-3" />
                    Términos y Condiciones
                  </button>{" "}
                  de la plataforma.
                </span>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Barra de acciones: fija abajo en el teléfono, así el botón siempre
          está a mano sin importar lo largo del paso. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-white/[0.06] bg-[#070816]/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label={subStep === 1 ? "Cambiar tipo de registro" : "Paso anterior"}
            className="btn-secondary flex h-12 w-12 shrink-0 items-center justify-center !p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="submit"
            className="btn-primary flex h-12 flex-1 items-center justify-center gap-2 text-base"
          >
            {subStep < TOTAL_STEPS ? (
              <>
                Continuar
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              submitLabel || "Crear mi perfil"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
