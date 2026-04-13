"use client";

import { useState } from "react";
import { ChevronDown, DollarSign, Tag, Sparkles, User, Clock } from "lucide-react";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";
import ExamsUploader from "./ExamsUploader";
import { PROFILE_TAGS_CATALOG, SERVICE_TAGS_CATALOG } from "../../../../../components/DirectoryPage";

const PRIMARY_CATEGORY_OPTIONS = [
  { value: "",           label: "Sin categoría principal" },
  { value: "escort",     label: "Escort / Acompañante" },
  { value: "masajes",    label: "Masajista" },
  { value: "trans",      label: "Trans" },
  { value: "despedidas", label: "Despedidas de soltero" },
  { value: "videollamadas", label: "Videollamadas" },
];

/* ── Section header with icon ── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/20">
        <Icon className="h-4 w-4 text-fuchsia-400" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-white/90">{title}</h4>
        {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ── Optional collapsible (only for minor details) ── */
function MinorSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition hover:bg-white/[0.02]"
      >
        <span className="text-xs text-white/50">{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/25 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-3">{children}</div>}
    </div>
  );
}

export default function ProfileEditor() {
  const { state, setField } = useDashboardForm();

  return (
    <div className="space-y-4">

      {/* ─── 1. LO BÁSICO ─── */}
      <EditorCard delay={0}>
        <SectionHeader icon={User} title="Lo básico" subtitle="Tu nombre y presentación" />
        <div className="space-y-3">
          <FloatingInput
            label="Nombre visible"
            value={state.displayName}
            onChange={(v) => setField("displayName", v)}
            placeholder="Tu nombre o alias"
          />
          <FloatingSelect
            label="Categoría principal"
            value={state.primaryCategory}
            onChange={(v) => setField("primaryCategory", v)}
            options={PRIMARY_CATEGORY_OPTIONS}
          />
          <FloatingTextarea
            label="Sobre mí"
            value={state.bio}
            onChange={(v) => setField("bio", v)}
            placeholder="Cuéntale a tus clientes sobre ti..."
            rows={3}
          />
          <FloatingTextarea
            label="Mis servicios"
            value={state.serviceDescription}
            onChange={(v) => setField("serviceDescription", v)}
            placeholder="Describe lo que ofreces..."
            rows={3}
          />
        </div>
      </EditorCard>

      {/* ─── 2. CÓMO DEFINES TU PERFIL (Tags) ─── */}
      <EditorCard delay={0.05}>
        <SectionHeader icon={Sparkles} title="¿Cómo te defines?" subtitle="Toca las que mejor te describen — aparecen en tu perfil" />
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
                    : "border-white/10 text-white/45 hover:border-fuchsia-500/30 hover:text-white/70 hover:bg-fuchsia-500/5"
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

      {/* ─── 3. SERVICIOS QUE OFREZCO (Tags) ─── */}
      <EditorCard delay={0.1}>
        <SectionHeader icon={Tag} title="Servicios que ofrezco" subtitle="Selecciona todos los que apliquen" />
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
                    : "border-white/10 text-white/45 hover:border-violet-500/30 hover:text-white/70 hover:bg-violet-500/5"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        {state.serviceTags.length > 0 && (
          <p className="mt-2 text-[11px] text-violet-400/60">
            {state.serviceTags.length} seleccionado{state.serviceTags.length !== 1 ? "s" : ""}
          </p>
        )}
      </EditorCard>

      {/* ─── 4. TARIFAS Y DISPONIBILIDAD ─── */}
      <EditorCard delay={0.15}>
        <SectionHeader icon={DollarSign} title="Tarifas y disponibilidad" subtitle="Precios y horarios" />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput label="Tarifa base (CLP)" value={state.baseRate} onChange={(v) => setField("baseRate", v)} type="number" min="0" />
            <FloatingInput label="Duración mínima (min)" value={state.minDurationMinutes} onChange={(v) => setField("minDurationMinutes", v)} type="number" min="0" />
          </div>

          <FloatingTextarea label="Disponibilidad" value={state.availabilityNote} onChange={(v) => setField("availabilityNote", v)} rows={2} placeholder="Solo agenda / Solo hotel / A domicilio" />

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 cursor-pointer transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5">
              <input type="checkbox" checked={state.acceptsIncalls} onChange={(e) => setField("acceptsIncalls", e.target.checked)} className="accent-fuchsia-500 h-4 w-4" />
              Recibe en su lugar
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 cursor-pointer transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5">
              <input type="checkbox" checked={state.acceptsOutcalls} onChange={(e) => setField("acceptsOutcalls", e.target.checked)} className="accent-fuchsia-500 h-4 w-4" />
              Se desplaza
            </label>
          </div>

          <FloatingInput label="Estilo / tags" value={state.serviceStyleTags} onChange={(v) => setField("serviceStyleTags", v)} placeholder="GFE, VIP, discreto" />
        </div>
      </EditorCard>

      {/* ─── 5. EXÁMENES DE SALUD ─── */}
      <EditorCard delay={0.18}>
        <ExamsUploader />
      </EditorCard>

      {/* ─── 6. DATOS PERSONALES (minor, collapsible) ─── */}
      <EditorCard delay={0.2}>
        <MinorSection title="Datos personales (opcional)">
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
            />
            <FloatingInput
              label="Fecha de nacimiento"
              value={state.birthdate}
              onChange={(v) => setField("birthdate", v)}
              type="date"
              max={new Date().toISOString().split("T")[0]}
              hint="Debes ser mayor de 18 años."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput label="Estatura (cm)" value={state.heightCm} onChange={(v) => setField("heightCm", v)} type="number" min="0" />
            <FloatingInput label="Peso (kg)" value={state.weightKg} onChange={(v) => setField("weightKg", v)} type="number" min="0" />
          </div>
          <FloatingInput label="Medidas" value={state.measurements} onChange={(v) => setField("measurements", v)} placeholder="Ej: 90-60-90" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput label="Cabello" value={state.hairColor} onChange={(v) => setField("hairColor", v)} />
            <FloatingInput label="Piel" value={state.skinTone} onChange={(v) => setField("skinTone", v)} />
          </div>
          <FloatingInput label="Idiomas" value={state.languages} onChange={(v) => setField("languages", v)} placeholder="Español, Inglés" />
        </MinorSection>
      </EditorCard>

    </div>
  );
}
