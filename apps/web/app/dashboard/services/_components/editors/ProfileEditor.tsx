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
      </div>
    </EditorCard>
  );
}
