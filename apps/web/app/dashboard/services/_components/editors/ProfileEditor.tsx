"use client";

import { useMemo, useState } from "react";
import { ChevronDown, DollarSign, Tag, Sparkles, User, Ruler, Check, AlertCircle } from "lucide-react";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import {
  fieldAnchor,
  requiredFieldsByKey,
  MIN_PROFILE_BIO_LENGTH,
} from "../../../../../lib/profileCompletion";
import EditorCard from "../EditorCard";
import SectionHeader from "../SectionHeader";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";
import PhoneField from "./PhoneField";
import NameField from "./NameField";
import { PROFILE_TAGS_CATALOG, SERVICE_TAGS_CATALOG } from "../../../../../components/DirectoryPage";

const PRIMARY_CATEGORY_OPTIONS = [
  { value: "",           label: "Sin categoría principal" },
  { value: "escort",     label: "Escort / Acompañante" },
  { value: "masajes",    label: "Masajista" },
  { value: "trans",      label: "Trans" },
  { value: "despedidas", label: "Despedidas de soltero" },
  { value: "videollamadas", label: "Videollamadas" },
];

const HAIR_COLOR_OPTIONS = [
  { value: "Negro", label: "Negro" },
  { value: "Castaño", label: "Castaño" },
  { value: "Rubio", label: "Rubio" },
  { value: "Pelirrojo", label: "Pelirrojo" },
  { value: "Colorido", label: "Colorido / fantasía" },
];

const SKIN_TONE_OPTIONS = [
  { value: "Clara", label: "Clara" },
  { value: "Trigueña", label: "Trigueña" },
  { value: "Morena", label: "Morena" },
  { value: "Negra", label: "Negra" },
];

/* ── Sección plegable: sólo para lo que de verdad es opcional ── */
function OptionalSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/60">{title}</span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/35">
            Opcional
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/25 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-3 px-3.5 pb-3.5">{children}</div>
      ) : (
        subtitle && <p className="px-3.5 pb-3 text-[11px] text-white/25">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * Elección rápida con sugerencias.
 *
 * Estatura, peso, cabello y piel son obligatorios y estaban escondidos: además
 * de sacarlos a la vista, se responden de un toque. Escribir sigue disponible
 * para quien no se ve en ninguna de las opciones.
 */
function SuggestionRow({
  options,
  value,
  onPick,
}: {
  options: { value: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.trim().toLowerCase() === opt.value.toLowerCase();
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(active ? "" : opt.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              active
                ? "border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-300"
                : "border-white/10 text-white/40 hover:border-fuchsia-500/30 hover:text-white/70"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfileEditor() {
  const { state, setField } = useDashboardForm();
  const req = useMemo(() => requiredFieldsByKey(state), [state]);
  const isDone = (key: string) => Boolean(req[key]?.complete);
  const countDone = (keys: string[]) => keys.filter(isDone).length;

  const bioLeft = MIN_PROFILE_BIO_LENGTH - state.bio.trim().length;

  const serviceTagsDone = isDone("serviceTags");

  return (
    <div className="space-y-4">

      {/* ─── 1. LO BÁSICO ─── */}
      <EditorCard delay={0}>
        <SectionHeader
          icon={User}
          title="Lo básico"
          subtitle="Cómo te presentas y por dónde te escriben"
          required={3}
          done={countDone(["phone", "birthdate", "bio"])}
        />
        <div className="space-y-3">
          {/* El nombre sigue la misma regla que el teléfono: una vez fijado,
              cambiarlo pasa por una solicitud que revisa el equipo. */}
          <NameField
            value={state.displayName}
            onChange={(v) => setField("displayName", v)}
          />

          <div id={fieldAnchor("phone")}>
            <PhoneField
              value={state.phone}
              onChange={(v) => setField("phone", v)}
              required
              complete={isDone("phone")}
            />
          </div>

          <FloatingInput
            id={fieldAnchor("birthdate")}
            label="Fecha de nacimiento"
            value={state.birthdate}
            onChange={(v) => setField("birthdate", v)}
            type="date"
            max={new Date().toISOString().split("T")[0]}
            hint="Debes ser mayor de 18 años. El cliente sólo ve tu edad, no la fecha."
            required
            complete={isDone("birthdate")}
          />

          <FloatingTextarea
            id={fieldAnchor("bio")}
            label="Descripción del perfil"
            value={state.bio}
            onChange={(v) => setField("bio", v)}
            placeholder="Cuenta en dos o tres líneas cómo atiendes: es lo que se lee antes de escribirte."
            rows={3}
            required
            complete={isDone("bio")}
            hint={
              bioLeft > 0
                ? `Faltan ${bioLeft} caracteres (mínimo ${MIN_PROFILE_BIO_LENGTH}).`
                : undefined
            }
          />

          <FloatingSelect
            label="Categoría principal"
            value={state.primaryCategory}
            onChange={(v) => setField("primaryCategory", v)}
            options={PRIMARY_CATEGORY_OPTIONS}
            hint="Define en qué listado apareces primero."
          />
        </div>
      </EditorCard>

      {/* ─── 2. TUS DATOS (obligatorios: ya no viven escondidos) ─── */}
      <EditorCard delay={0.05}>
        <SectionHeader
          icon={Ruler}
          title="Tus datos"
          subtitle="Es lo primero que el cliente mira en la ficha"
          required={5}
          done={countDone(["heightCm", "weightKg", "measurements", "hairColor", "skinTone"])}
        />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput
              id={fieldAnchor("heightCm")}
              label="Estatura (cm)"
              value={state.heightCm}
              onChange={(v) => setField("heightCm", v)}
              type="number"
              min="0"
              placeholder="165"
              required
              complete={isDone("heightCm")}
            />
            <FloatingInput
              id={fieldAnchor("weightKg")}
              label="Peso (kg)"
              value={state.weightKg}
              onChange={(v) => setField("weightKg", v)}
              type="number"
              min="0"
              placeholder="58"
              required
              complete={isDone("weightKg")}
            />
          </div>

          <FloatingInput
            id={fieldAnchor("measurements")}
            label="Medidas"
            value={state.measurements}
            onChange={(v) => setField("measurements", v)}
            placeholder="90-60-90"
            required
            complete={isDone("measurements")}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <FloatingInput
                id={fieldAnchor("hairColor")}
                label="Color de cabello"
                value={state.hairColor}
                onChange={(v) => setField("hairColor", v)}
                placeholder="Castaño"
                required
                complete={isDone("hairColor")}
              />
              <SuggestionRow
                options={HAIR_COLOR_OPTIONS}
                value={state.hairColor}
                onPick={(v) => setField("hairColor", v)}
              />
            </div>
            <div className="space-y-2">
              <FloatingInput
                id={fieldAnchor("skinTone")}
                label="Tono de piel"
                value={state.skinTone}
                onChange={(v) => setField("skinTone", v)}
                placeholder="Trigueña"
                required
                complete={isDone("skinTone")}
              />
              <SuggestionRow
                options={SKIN_TONE_OPTIONS}
                value={state.skinTone}
                onPick={(v) => setField("skinTone", v)}
              />
            </div>
          </div>
        </div>
      </EditorCard>

      {/* ─── 3. TARIFA (obligatoria) ─── */}
      <EditorCard delay={0.1}>
        <SectionHeader
          icon={DollarSign}
          title="Tarifa"
          subtitle="Sin tarifa el perfil sale como “a consultar” y pierde contactos"
          required={1}
          done={countDone(["baseRate"])}
        />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput
              id={fieldAnchor("baseRate")}
              label="Tarifa base (CLP)"
              value={state.baseRate}
              onChange={(v) => setField("baseRate", v)}
              type="number"
              min="1000"
              placeholder="40000"
              hint="Monto completo, sin puntos. Mínimo $1.000."
              required
              complete={isDone("baseRate")}
            />
            <FloatingInput
              label="Duración mínima (min)"
              value={state.minDurationMinutes}
              onChange={(v) => setField("minDurationMinutes", v)}
              type="number"
              min="0"
              placeholder="60"
              optional
            />
          </div>
        </div>
      </EditorCard>

      {/* ─── 4. SERVICIOS QUE OFREZCO (obligatorio) ─── */}
      <EditorCard delay={0.15} className={serviceTagsDone ? "" : "ring-1 ring-amber-500/20"}>
        <div id={fieldAnchor("serviceTags")} tabIndex={-1} className="outline-none">
          <SectionHeader
            icon={Tag}
            title="Servicios que ofrezco"
            subtitle="Sin al menos uno, tu perfil no sale en los filtros que usa el cliente"
            required={1}
            done={countDone(["serviceTags"])}
          />
          <div className="flex flex-wrap gap-2">
            {SERVICE_TAGS_CATALOG.map((tag) => {
              const active = state.serviceTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setField(
                      "serviceTags",
                      active ? state.serviceTags.filter((t) => t !== tag) : [...state.serviceTags, tag],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-all ${
                    active
                      ? "border-violet-500/50 bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                      : "border-white/10 text-white/45 hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-white/70"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${serviceTagsDone ? "text-violet-400/60" : "text-amber-300/80"}`}>
            {serviceTagsDone ? (
              <>
                <Check className="h-3 w-3" />
                {state.serviceTags.length} seleccionado{state.serviceTags.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Selecciona al menos uno.
              </>
            )}
          </p>
        </div>
      </EditorCard>

      {/* ─── 5. CÓMO TE DEFINES (suma, no bloquea) ─── */}
      <EditorCard delay={0.2}>
        <SectionHeader
          icon={Sparkles}
          title="¿Cómo te defines?"
          subtitle="Toca las que mejor te describen — aparecen en tu perfil"
        />
        <div className="flex flex-wrap gap-2">
          {PROFILE_TAGS_CATALOG.map((tag) => {
            const active = state.profileTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setField(
                    "profileTags",
                    active ? state.profileTags.filter((t) => t !== tag) : [...state.profileTags, tag],
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-all ${
                  active
                    ? "border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,0.15)]"
                    : "border-white/10 text-white/45 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 hover:text-white/70"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        {state.profileTags.length > 0 && (
          <p className="mt-2 text-[11px] text-fuchsia-400/60">
            {state.profileTags.length} seleccionada{state.profileTags.length !== 1 ? "s" : ""}
          </p>
        )}
      </EditorCard>

      {/* ─── 6. LO OPCIONAL DE VERDAD ─── */}
      <EditorCard delay={0.25}>
        <OptionalSection
          title="Disponibilidad y detalles"
          subtitle="Horarios, idiomas y estilo. Suman, pero no bloquean la publicación."
        >
          <FloatingTextarea
            label="Disponibilidad"
            value={state.availabilityNote}
            onChange={(v) => setField("availabilityNote", v)}
            rows={2}
            placeholder="Solo agenda / Solo hotel / A domicilio"
            optional
          />

          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5">
              <input type="checkbox" checked={state.acceptsIncalls} onChange={(e) => setField("acceptsIncalls", e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
              Recibe en su lugar
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5">
              <input type="checkbox" checked={state.acceptsOutcalls} onChange={(e) => setField("acceptsOutcalls", e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
              Se desplaza
            </label>
          </div>

          <FloatingTextarea
            label="Mis servicios (texto libre)"
            value={state.serviceDescription}
            onChange={(v) => setField("serviceDescription", v)}
            placeholder="Describe con tus palabras lo que ofreces..."
            rows={3}
            optional
          />

          <FloatingInput
            label="Estilo / tags"
            value={state.serviceStyleTags}
            onChange={(v) => setField("serviceStyleTags", v)}
            placeholder="GFE, VIP, discreto"
            optional
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingSelect
              label="Género"
              value={state.gender}
              onChange={(v) => setField("gender", v)}
              options={[
                { value: "FEMALE", label: "Mujer" },
                { value: "MALE", label: "Hombre" },
                { value: "OTHER", label: "Otro" },
              ]}
              optional
            />
            <FloatingInput
              label="Idiomas"
              value={state.languages}
              onChange={(v) => setField("languages", v)}
              placeholder="Español, Inglés"
              optional
            />
          </div>
        </OptionalSection>
      </EditorCard>

    </div>
  );
}
