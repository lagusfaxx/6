"use client";

import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";

export default function ProfileEditor() {
  const { state, setField } = useDashboardForm();

  return (
    <EditorCard title="Informacion del perfil" subtitle="Datos visibles para clientes y buscadores." delay={0}>
      <div className="grid gap-4">
        <FloatingInput
          label="Nombre visible"
          value={state.displayName}
          onChange={(v) => setField("displayName", v)}
          placeholder="Tu nombre o alias"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingSelect
            label="Genero"
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
            hint="Debes ser mayor de 18 anos."
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Estado en tiempo real</p>
              <p className="text-xs text-white/55">Activa o pausa tu visibilidad en Servicios y Disponibles ahora.</p>
            </div>
            <button
              type="button"
              onClick={() => setField("profileIsActive", !state.profileIsActive)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${state.profileIsActive ? "bg-emerald-500/70" : "bg-white/20"}`}
              aria-pressed={state.profileIsActive}
              aria-label="Cambiar visibilidad"
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${state.profileIsActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        <FloatingTextarea
          label="Descripcion general"
          value={state.bio}
          onChange={(v) => setField("bio", v)}
          placeholder="Cuentale a tus clientes sobre ti..."
          rows={4}
        />

        <FloatingTextarea
          label="Descripcion de servicios"
          value={state.serviceDescription}
          onChange={(v) => setField("serviceDescription", v)}
          placeholder="Describe lo que ofreces..."
          rows={4}
        />

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
        <FloatingInput label="Estilo / tags" value={state.serviceStyleTags} onChange={(v) => setField("serviceStyleTags", v)} placeholder="GFE, VIP, discreto" />
        <FloatingTextarea label="Disponibilidad" value={state.availabilityNote} onChange={(v) => setField("availabilityNote", v)} rows={2} placeholder="Solo agenda / Solo hotel / A domicilio" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingInput label="Tarifa base (CLP)" value={state.baseRate} onChange={(v) => setField("baseRate", v)} type="number" min="0" />
          <FloatingInput label="Duración mínima (min)" value={state.minDurationMinutes} onChange={(v) => setField("minDurationMinutes", v)} type="number" min="0" />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-white/70">
          <label className="flex items-center gap-2"><input type="checkbox" checked={state.acceptsIncalls} onChange={(e) => setField("acceptsIncalls", e.target.checked)} /> Recibe</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={state.acceptsOutcalls} onChange={(e) => setField("acceptsOutcalls", e.target.checked)} /> Se desplaza</label>
        </div>
      </div>
    </EditorCard>
  );
}
