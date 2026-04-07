"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  ImagePlus,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  X,
  Zap,
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

const PROFILE_TAGS = [
  "tetona","culona","delgada","fitness","gordita",
  "rubia","morena","pelirroja","trigueña",
  "sumisa","dominante","caliente","cariñosa","natural",
  "tatuada","piercing",
];

const SERVICE_TAGS = [
  "anal","trios","packs","videollamada",
  "masaje erotico","despedidas","discapacitados","fetiches",
  "bdsm","sexo oral","lluvia dorada","rol",
];

type WizardData = {
  // Step 1 — Perfil + Fotos
  displayName: string;
  primaryCategory: string;
  bio: string;
  galleryFiles: File[];
  galleryPreviews: string[];
  // Step 2 — Servicio
  profileTags: string[];
  serviceTags: string[];
  baseRate: string;
  minDurationMinutes: string;
  acceptsIncalls: boolean;
  acceptsOutcalls: boolean;
  address: string;
  latitude: number | null;
  longitude: number | null;
  serviceDescription: string;
  // Step 3 — Plan + Datos
  selectedPlan: "free" | "gold";
  email: string;
  phone: string;
  acceptTerms: boolean;
};

const INITIAL_DATA: WizardData = {
  displayName: "",
  primaryCategory: "",
  bio: "",
  galleryFiles: [],
  galleryPreviews: [],
  profileTags: [],
  serviceTags: [],
  baseRate: "",
  minDurationMinutes: "",
  acceptsIncalls: false,
  acceptsOutcalls: false,
  address: "",
  latitude: null,
  longitude: null,
  serviceDescription: "",
  selectedPlan: "free",
  email: "",
  phone: "",
  acceptTerms: false,
};

const TOTAL_STEPS = 3;
const PHONE_PREFIXES = ["+56", "+57", "+58", "+51"];
const MAX_GALLERY = 6;

export default function PublicateClient() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch })),
    [],
  );

  const handleGalleryAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_GALLERY - data.galleryFiles.length;
    const toAdd = files.slice(0, remaining);
    update({
      galleryFiles: [...data.galleryFiles, ...toAdd],
      galleryPreviews: [...data.galleryPreviews, ...toAdd.map((f) => URL.createObjectURL(f))],
    });
    e.target.value = "";
  };

  const removeGalleryItem = (idx: number) => {
    update({
      galleryFiles: data.galleryFiles.filter((_, i) => i !== idx),
      galleryPreviews: data.galleryPreviews.filter((_, i) => i !== idx),
    });
  };

  const toggleTag = (field: "profileTags" | "serviceTags", tag: string) => {
    const current = data[field];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    update({ [field]: next } as any);
  };

  /* ── Validation per step ── */
  const isStep1Valid =
    data.displayName.trim().length >= 2 &&
    data.primaryCategory.length > 0 &&
    data.galleryFiles.length >= 3;
  const isStep2Valid =
    data.profileTags.length >= 1 &&
    data.serviceTags.length >= 1 &&
    Number(data.baseRate) > 0 &&
    data.address.trim().length >= 6 &&
    data.latitude !== null &&
    data.longitude !== null &&
    data.serviceDescription.trim().length >= 3;
  const isStep3Valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    /^\+\d{8,15}$/.test(data.phone) &&
    data.acceptTerms;

  const validByStep = [false, isStep1Valid, isStep2Valid, isStep3Valid];
  const canAdvance = validByStep[step] ?? false;

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
      fd.append("email", data.email.trim().toLowerCase());
      fd.append("phone", data.phone);
      fd.append("acceptTerms", "true");
      fd.append("selectedPlan", data.selectedPlan);

      for (const file of data.galleryFiles) fd.append("gallery", file);

      if (data.bio.trim()) fd.append("bio", data.bio.trim());
      if (data.profileTags.length) fd.append("profileTags", JSON.stringify(data.profileTags));
      if (data.serviceTags.length) fd.append("serviceTags", JSON.stringify(data.serviceTags));
      if (data.baseRate) fd.append("baseRate", data.baseRate);
      if (data.minDurationMinutes) fd.append("minDurationMinutes", data.minDurationMinutes);
      fd.append("acceptsIncalls", String(data.acceptsIncalls));
      fd.append("acceptsOutcalls", String(data.acceptsOutcalls));

      const res = await apiFetch<{ ok: boolean; paymentUrl?: string }>("/auth/quick-register", { method: "POST", body: fd });

      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }

      setDone(true);
    } catch (err: any) {
      const msg = err?.body?.message || err?.message || "Ocurrió un error. Intenta nuevamente.";
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
        <h1 className="text-2xl font-bold text-white">Tu perfil fue creado exitosamente</h1>
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

  /* ── Shared styles ── */
  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-fuchsia-500/40 focus:bg-white/[0.06]";
  const selectClass = inputClass + " [color-scheme:dark] [&>option]:bg-[#0c0a14] [&>option]:text-white";
  const labelClass = "mb-1.5 block text-xs font-medium text-white/60";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
          <Sparkles className="h-6 w-6 text-fuchsia-400" />
        </div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">Publícate en UZEED</h1>
        <p className="mt-1 text-xs text-white/40">Crea tu perfil en minutos — sin registro previo</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-fuchsia-500" : "bg-white/10"}`}
          />
        ))}
      </div>

      {/* ═══ STEP 1: Perfil + Fotos ═══ */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-white">Tu perfil</h2>

          {/* Display name */}
          <div>
            <label className={labelClass}>Nombre artístico *</label>
            <input type="text" className={inputClass} placeholder="Ej: Valentina" maxLength={50} value={data.displayName} onChange={(e) => update({ displayName: e.target.value })} />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Categoría *</label>
            <select className={selectClass} value={data.primaryCategory} onChange={(e) => update({ primaryCategory: e.target.value })}>
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug || c.name}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {/* Bio */}
          <div>
            <label className={labelClass}>Descripción / Bio</label>
            <textarea
              className={inputClass + " min-h-[70px] resize-none"}
              placeholder="Cuéntale a tus clientes sobre ti..."
              maxLength={500}
              value={data.bio}
              onChange={(e) => update({ bio: e.target.value })}
            />
          </div>

          {/* Gallery */}
          <div>
            <label className={labelClass}>Tus fotos * <span className="font-normal text-white/30">— mínimo 3, hasta {MAX_GALLERY}</span></label>
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: MAX_GALLERY }).map((_, idx) => {
                const hasPhoto = idx < data.galleryPreviews.length;
                return (
                  <div key={idx} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    {hasPhoto ? (
                      <>
                        <img src={data.galleryPreviews[idx]} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(idx)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-red-500/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/20 transition-colors hover:text-fuchsia-400/60"
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
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryAdd}
            />
            {data.galleryFiles.length > 0 && (
              <p className="mt-2 text-xs text-white/30">{data.galleryFiles.length} de {MAX_GALLERY} fotos</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Tu servicio ═══ */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Profile tags */}
          <div>
            <h2 className="text-base font-semibold text-white">¿Cómo te defines? *</h2>
            <p className="mb-3 text-xs text-white/40">Toca las que mejor te describen</p>
            <div className="flex flex-wrap gap-2">
              {PROFILE_TAGS.map((tag) => {
                const active = data.profileTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag("profileTags", tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      active
                        ? "border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,0.15)]"
                        : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service tags */}
          <div>
            <h2 className="text-base font-semibold text-white">Servicios que ofrezco *</h2>
            <p className="mb-3 text-xs text-white/40">Selecciona todos los que apliquen</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TAGS.map((tag) => {
                const active = data.serviceTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag("serviceTags", tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      active
                        ? "border-violet-500/50 bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                        : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rates */}
          <div>
            <h2 className="text-base font-semibold text-white">Tarifas</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tarifa base (CLP) *</label>
                <input type="number" className={inputClass} placeholder="Ej: 50000" min={0} value={data.baseRate} onChange={(e) => update({ baseRate: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Duración mín. (min)</label>
                <input type="number" className={inputClass} placeholder="Ej: 60" min={0} value={data.minDurationMinutes} onChange={(e) => update({ minDurationMinutes: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              <label className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-colors ${data.acceptsIncalls ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 text-white/45"}`}>
                <input type="checkbox" className="accent-fuchsia-500" checked={data.acceptsIncalls} onChange={(e) => update({ acceptsIncalls: e.target.checked })} />
                Recibe en su lugar
              </label>
              <label className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-colors ${data.acceptsOutcalls ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 text-white/45"}`}>
                <input type="checkbox" className="accent-fuchsia-500" checked={data.acceptsOutcalls} onChange={(e) => update({ acceptsOutcalls: e.target.checked })} />
                Se desplaza
              </label>
            </div>
          </div>

          {/* Location */}
          <div>
            <h2 className="text-base font-semibold text-white">Ubicación *</h2>
            <div className="mt-3">
              <MapboxAddressAutocomplete
                label=""
                value={data.address}
                placeholder="Ej: Providencia, Santiago"
                required
                onChange={(v) => update({ address: v })}
                onSelect={(s) => update({ address: s.placeName, latitude: s.latitude, longitude: s.longitude })}
              />
              {data.latitude && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400/70">
                  <MapPin className="h-3 w-3" /> Ubicación verificada
                </p>
              )}
            </div>
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
        </div>
      )}

      {/* ═══ STEP 3: Plan + Datos ═══ */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Plan selection */}
          <div>
            <h2 className="text-base font-semibold text-white">Elige tu plan</h2>
            <div className="mt-3 grid gap-3">
              {/* Free plan */}
              <button
                type="button"
                onClick={() => update({ selectedPlan: "free" })}
                className={`relative rounded-2xl border p-5 text-left transition-all ${
                  data.selectedPlan === "free"
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                {data.selectedPlan === "free" && (
                  <div className="absolute right-4 top-4">
                    <CheckCircle2 className="h-5 w-5 text-white/60" />
                  </div>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-white/40" />
                  <span className="text-sm font-bold text-white">Gratis</span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">SILVER</span>
                </div>
                <ul className="space-y-1.5 text-xs text-white/45">
                  <li>• 90 días gratis</li>
                  <li>• Visibilidad básica</li>
                  <li>• Apareces debajo de perfiles Gold</li>
                </ul>
              </button>

              {/* Gold plan */}
              <button
                type="button"
                onClick={() => update({ selectedPlan: "gold" })}
                className={`relative rounded-2xl border p-5 text-left transition-all ${
                  data.selectedPlan === "gold"
                    ? "border-amber-500/40 bg-amber-500/[0.08] shadow-[0_0_30px_rgba(245,158,11,0.06)]"
                    : "border-amber-500/15 bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                }`}
              >
                {data.selectedPlan === "gold" && (
                  <div className="absolute right-4 top-4">
                    <CheckCircle2 className="h-5 w-5 text-amber-400" />
                  </div>
                )}
                <div className="mb-1 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">Gold</span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">RECOMENDADO</span>
                </div>
                <p className="mb-3 text-lg font-bold text-amber-400">$14.990 <span className="text-xs font-normal text-white/40">/ 7 días</span></p>
                <ul className="space-y-1.5 text-xs text-white/60">
                  <li className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /> x5 más visibilidad</li>
                  <li className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /> x5 más contactos</li>
                  <li className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /> Badge Gold en tu perfil</li>
                  <li className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /> Apareces primero en búsquedas</li>
                </ul>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Contact data */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Tus datos</h2>
            {data.selectedPlan === "gold" && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/80">
                Tu correo se usará para procesar el pago de <strong>$14.990</strong> con Flow.
              </div>
            )}

            {/* Email */}
            <div>
              <label className={labelClass}>Correo electrónico *</label>
              <input type="email" className={inputClass} placeholder="tu@correo.com" value={data.email} onChange={(e) => update({ email: e.target.value })} />
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Teléfono *</label>
              <div className="flex gap-2">
                <select
                  className="w-20 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-sm text-white outline-none transition-colors focus:border-fuchsia-500/40 [color-scheme:dark]"
                  value={data.phone.match(/^\+\d{2}/)?.[0] || "+56"}
                  onChange={(e) => {
                    const digits = data.phone.replace(/^\+\d{2}/, "");
                    update({ phone: e.target.value + digits });
                  }}
                >
                  {PHONE_PREFIXES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  className={inputClass}
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
                <button type="button" className="text-fuchsia-400 underline" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>
                  términos y condiciones
                </button>
              </span>
            </label>
          </div>
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
            onClick={() => { setStep((s) => s - 1); setError(null); }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => { setStep((s) => s + 1); setError(null); }}
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
              <><Loader2 className="h-4 w-4 animate-spin" /> {data.selectedPlan === "gold" ? "Procesando..." : "Creando perfil..."}</>
            ) : data.selectedPlan === "gold" ? (
              <><Crown className="h-4 w-4" /> Pagar y publicar — $14.990</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Crear mi perfil</>
            )}
          </button>
        )}
      </div>

      {/* Terms modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={() => { update({ acceptTerms: true }); setShowTerms(false); }}
        type="business"
      />
    </div>
  );
}
