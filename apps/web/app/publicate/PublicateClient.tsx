"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import MapboxAddressAutocomplete from "../../components/MapboxAddressAutocomplete";
import TermsModal from "../../components/TermsModal";

type Category = {
  id: string;
  name: string;
  slug: string;
  displayName: string;
};

type WizardData = {
  // Step 1
  displayName: string;
  primaryCategory: string;
  avatarFile: File | null;
  avatarPreview: string | null;
  // Step 2
  address: string;
  latitude: number | null;
  longitude: number | null;
  serviceDescription: string;
  servicePrice: string;
  // Step 3
  email: string;
  phone: string;
  acceptTerms: boolean;
};

const INITIAL_DATA: WizardData = {
  displayName: "",
  primaryCategory: "",
  avatarFile: null,
  avatarPreview: null,
  address: "",
  latitude: null,
  longitude: null,
  serviceDescription: "",
  servicePrice: "",
  email: "",
  phone: "",
  acceptTerms: false,
};

const PHONE_PREFIXES = ["+56", "+57", "+58", "+51"];

export default function PublicateClient() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch })),
    [],
  );

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update({ avatarFile: file, avatarPreview: URL.createObjectURL(file) });
  };

  /* ── Validation per step ── */

  const isStep1Valid =
    data.displayName.trim().length >= 2 && data.primaryCategory.length > 0;

  const isStep2Valid =
    data.address.trim().length >= 6 &&
    data.latitude !== null &&
    data.longitude !== null &&
    data.serviceDescription.trim().length >= 3 &&
    Number(data.servicePrice) > 0;

  const isStep3Valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    /^\+\d{8,15}$/.test(data.phone) &&
    data.acceptTerms;

  const canAdvance = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : isStep3Valid;

  /* ── Submit ── */

  const handleSubmit = async () => {
    if (!isStep3Valid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("displayName", data.displayName.trim());
      fd.append("primaryCategory", data.primaryCategory);
      fd.append("address", data.address);
      fd.append("latitude", String(data.latitude));
      fd.append("longitude", String(data.longitude));
      fd.append("serviceDescription", data.serviceDescription.trim());
      fd.append("servicePrice", data.servicePrice);
      fd.append("email", data.email.trim().toLowerCase());
      fd.append("phone", data.phone);
      fd.append("acceptTerms", "true");
      if (data.avatarFile) fd.append("avatar", data.avatarFile);

      await apiFetch("/auth/quick-register", { method: "POST", body: fd });
      setDone(true);
    } catch (err: any) {
      const msg =
        err?.body?.message ||
        err?.message ||
        "Ocurrió un error. Intenta nuevamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen ── */

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          Tu perfil fue creado exitosamente
        </h1>
        <p className="mt-3 text-sm text-white/50 leading-relaxed">
          Un administrador lo revisará pronto. Revisa tu correo electrónico para
          crear tu contraseña y completar tu perfil.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  /* ── Wizard ── */

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-fuchsia-500/40 focus:bg-white/[0.06]";

  const labelClass = "mb-1.5 block text-xs font-medium text-white/60";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
          <Sparkles className="h-6 w-6 text-fuchsia-400" />
        </div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          Publícate en UZEED
        </h1>
        <p className="mt-1 text-xs text-white/40">
          Crea tu perfil en 2 minutos — sin registro previo
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-fuchsia-500" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-white">Tu perfil</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.04] transition-colors hover:border-fuchsia-500/30"
            >
              {data.avatarPreview ? (
                <img
                  src={data.avatarPreview}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-6 w-6 text-white/30 group-hover:text-fuchsia-400" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="text-xs text-white/40">
              <p className="font-medium text-white/60">Foto de perfil</p>
              <p>Opcional — puedes agregarla después</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className={labelClass}>Nombre artístico *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ej: Valentina"
              maxLength={50}
              value={data.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Categoría *</label>
            <select
              className={inputClass}
              value={data.primaryCategory}
              onChange={(e) => update({ primaryCategory: e.target.value })}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug || c.name}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Service */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-white">Tu servicio</h2>

          {/* Location */}
          <div>
            <label className={labelClass}>Ubicación *</label>
            <MapboxAddressAutocomplete
              label=""
              value={data.address}
              placeholder="Ej: Providencia, Santiago"
              required
              onChange={(v) => update({ address: v })}
              onSelect={(s) =>
                update({
                  address: s.placeName,
                  latitude: s.latitude,
                  longitude: s.longitude,
                })
              }
            />
            {data.latitude && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400/70">
                <MapPin className="h-3 w-3" /> Ubicación verificada
              </p>
            )}
          </div>

          {/* Service description */}
          <div>
            <label className={labelClass}>Descripción del servicio *</label>
            <textarea
              className={inputClass + " min-h-[80px] resize-none"}
              placeholder="Describe brevemente lo que ofreces..."
              maxLength={500}
              value={data.serviceDescription}
              onChange={(e) => update({ serviceDescription: e.target.value })}
            />
          </div>

          {/* Price */}
          <div>
            <label className={labelClass}>Precio (CLP) *</label>
            <input
              type="number"
              className={inputClass}
              placeholder="Ej: 50000"
              min={1}
              value={data.servicePrice}
              onChange={(e) => update({ servicePrice: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 3: Contact */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-white">Tus datos</h2>

          {/* Email */}
          <div>
            <label className={labelClass}>Correo electrónico *</label>
            <input
              type="email"
              className={inputClass}
              placeholder="tu@correo.com"
              value={data.email}
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>

          {/* Phone */}
          <div>
            <label className={labelClass}>Teléfono *</label>
            <div className="flex gap-2">
              <select
                className={inputClass + " w-24 shrink-0"}
                value={data.phone.match(/^\+\d{2}/)?.[0] || "+56"}
                onChange={(e) => {
                  const digits = data.phone.replace(/^\+\d{2}/, "");
                  update({ phone: e.target.value + digits });
                }}
              >
                {PHONE_PREFIXES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                className={inputClass + " flex-1"}
                placeholder="912345678"
                value={data.phone.replace(/^\+\d{2}/, "")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const prefix = data.phone.match(/^\+\d{2}/)?.[0] || "+56";
                  update({ phone: prefix + digits });
                }}
              />
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-fuchsia-500"
              checked={data.acceptTerms}
              onChange={(e) => update({ acceptTerms: e.target.checked })}
            />
            <span className="text-xs text-white/50 leading-relaxed">
              Acepto los{" "}
              <button
                type="button"
                className="text-fuchsia-400 underline"
                onClick={(e) => {
                  e.preventDefault();
                  setShowTerms(true);
                }}
              >
                términos y condiciones
              </button>
            </span>
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setStep((s) => s - 1);
              setError(null);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>
        )}

        {step < 3 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => {
              setStep((s) => s + 1);
              setError(null);
            }}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance || submitting}
            onClick={handleSubmit}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creando perfil...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Crear mi perfil
              </>
            )}
          </button>
        )}
      </div>

      {/* Terms modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={() => {
          update({ acceptTerms: true });
          setShowTerms(false);
        }}
        type="business"
      />
    </div>
  );
}
