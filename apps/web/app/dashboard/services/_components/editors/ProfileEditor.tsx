"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";
import { PROFILE_TAGS_CATALOG, SERVICE_TAGS_CATALOG } from "../../../../../components/DirectoryPage";

const PRIMARY_CATEGORY_OPTIONS = [
  { value: "",           label: "Sin categoría principal" },
  { value: "escort",     label: "Escort / Acompañante" },
  { value: "masajes",    label: "Masajista" },
  { value: "trans",      label: "Trans" },
  { value: "despedidas", label: "Despedidas de soltero" },
  { value: "videollamadas", label: "Videollamadas" },
];

/* ── Collapsible section ── */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <span className="text-xs font-semibold text-white/70">{title}</span>
        <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function ProfileEditor() {
  const { state, setField } = useDashboardForm();

  return (
    <EditorCard title="Mi perfil" subtitle="Lo básico para que te encuentren." delay={0}>
      <div className="space-y-3">

        {/* ── Esenciales (siempre visible) ── */}
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

        {/* ── Datos personales ── */}
        <Section title="Datos personales">
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput label="Estatura (cm)" value={state.heightCm} onChange={(v) => setField("heightCm", v)} type="number" min="0" />
            <FloatingInput label="Peso (kg)" value={state.weightKg} onChange={(v) => setField("weightKg", v)} type="number" min="0" />
          </div>
          <FloatingInput label="Medidas" value={state.measurements} onChange={(v) => setField("measurements", v)} placeholder="Ej: 90-60-90" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput label="Cabello" value={state.hairColor} onChange={(v) => setField("hairColor", v)} />
            <FloatingInput label="Piel" value={state.skinTone} onChange={(v) => setField("skinTone", v)} />
          </div>
          <FloatingInput label="Idiomas" value={state.languages} onChange={(v) => setField("languages", v)} placeholder="Español, Inglés" />
        </Section>

        {/* ── Tarifas y disponibilidad ── */}
        <Section title="Tarifas y disponibilidad">
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput label="Tarifa base (CLP)" value={state.baseRate} onChange={(v) => setField("baseRate", v)} type="number" min="0" />
            <FloatingInput label="Duración mínima (min)" value={state.minDurationMinutes} onChange={(v) => setField("minDurationMinutes", v)} type="number" min="0" />
          </div>
          <FloatingTextarea label="Disponibilidad" value={state.availabilityNote} onChange={(v) => setField("availabilityNote", v)} rows={2} placeholder="Solo agenda / Solo hotel / A domicilio" />
          <div className="flex flex-wrap gap-4 text-xs text-white/70">
            <label className="flex items-center gap-2"><input type="checkbox" checked={state.acceptsIncalls} onChange={(e) => setField("acceptsIncalls", e.target.checked)} className="accent-fuchsia-500" /> Recibe</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={state.acceptsOutcalls} onChange={(e) => setField("acceptsOutcalls", e.target.checked)} className="accent-fuchsia-500" /> Se desplaza</label>
          </div>
          <FloatingInput label="Estilo / tags" value={state.serviceStyleTags} onChange={(v) => setField("serviceStyleTags", v)} placeholder="GFE, VIP, discreto" />
        </Section>

        {/* ── Etiquetas de perfil ── */}
        <Section title="¿Cómo defines tu perfil?">
          <p className="text-[11px] text-white/35">Toca las que mejor te describen</p>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                    active
                      ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300"
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Servicios que ofrezco ── */}
        <Section title="Servicios que ofrezco">
          <p className="text-[11px] text-white/35">Selecciona todos los que apliquen</p>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                    active
                      ? "border-violet-500 bg-violet-500/15 text-violet-300"
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </Section>

      </div>
    </EditorCard>
  );
}
