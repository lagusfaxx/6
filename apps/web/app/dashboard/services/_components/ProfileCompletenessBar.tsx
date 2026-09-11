"use client";

import { useMemo, useState } from "react";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import {
  focusRequiredField,
  requiredProfileFields,
  type RequiredField,
} from "../../../../lib/profileCompletion";
import { ArrowRight, Check, ChevronDown, EyeOff, PartyPopper } from "lucide-react";

type Props = {
  user: any;
  profileType: string;
};

/** Anillo de progreso: el porcentaje se lee de un vistazo, sin leerlo. */
function ProgressRing({ value, tone }: { value: number; tone: string }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-white/[0.08]" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
          className={`${tone} transition-all duration-700 ease-out`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/90">
        {value}%
      </span>
    </div>
  );
}

/**
 * Requisitos para publicar.
 *
 * No es una barra de "completitud" decorativa: son los campos sin los cuales el
 * servidor no publica el perfil (apps/api/src/lib/profileCompletion.ts). Cada
 * campo que falta lleva a la pestaña donde se completa y deja el cursor puesto
 * en él, porque la queja real no es que falte el dato sino no saber dónde se
 * pone.
 *
 * Los perfiles que ya estaban publicados antes de la regla siguen al aire: a
 * ellos el aviso les cambia el tono — es una recomendación, no un bloqueo.
 */
export default function ProfileCompletenessBar({ user, profileType }: Props) {
  const { state, setField } = useDashboardForm();
  const [expanded, setExpanded] = useState(false);

  const isProfessional = profileType === "PROFESSIONAL";
  const fields = useMemo<RequiredField[]>(
    () => (isProfessional ? requiredProfileFields(state) : []),
    [isProfessional, state],
  );

  if (!isProfessional) return null;

  const done = fields.filter((f) => f.complete).length;
  const missing = fields.filter((f) => !f.complete);
  const complete = missing.length === 0;
  const percentage = Math.round((done / fields.length) * 100);
  /* Perfil que ya está al aire (o que ya lo estuvo): el aviso es una
     recomendación, no un bloqueo — a nadie se le baja el anuncio por esto. */
  const grandfathered = Boolean(user?.profileCompletedAt) || user?.isActive === true;

  /** Lleva a la pestaña del campo y deja el cursor ahí mismo. */
  const goToField = (field: RequiredField) => {
    if (state.tab !== field.tab) setField("tab", field.tab);
    focusRequiredField(field.key);
  };

  const tone = complete
    ? { ring: "text-emerald-400", border: "border-emerald-500/20", glow: "from-emerald-500/[0.10]" }
    : grandfathered
      ? { ring: "text-white/50", border: "border-white/10", glow: "from-white/[0.04]" }
      : { ring: "text-amber-400", border: "border-amber-500/25", glow: "from-amber-500/[0.10]" };

  const title = complete
    ? "Ficha completa"
    : grandfathered
      ? `Te faltan ${missing.length} datos en la ficha`
      : "Tu perfil no se publica hasta completar la ficha";

  const subtitle = complete
    ? "El cliente ve todos los datos que busca."
    : grandfathered
      ? "Sigue publicado, pero se ve incompleto frente a los que sí los tienen."
      : `Faltan ${missing.length} de ${fields.length} datos que el cliente mira antes de escribir.`;

  return (
    <div
      className={`relative mb-4 overflow-hidden rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.glow} via-white/[0.02] to-transparent`}
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        {complete ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
            <PartyPopper className="h-5 w-5 text-emerald-300" />
          </span>
        ) : (
          <ProgressRing value={percentage} tone={tone.ring} />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-white/90">{title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/45">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar la lista" : "Ver la lista completa"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* El siguiente paso, a un toque: sin abrir la lista ni adivinar la pestaña. */}
      {!complete && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => goToField(missing[0])}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-left transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.08]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-[11px] font-bold text-fuchsia-300">
              {fields.length - missing.length + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-white/30">
                Sigue con
              </span>
              <span className="block truncate text-sm font-medium text-white/90">
                {missing[0].label}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}

      {(expanded || !complete) && (
        <div className="border-t border-white/[0.06] px-3 py-2.5">
          <ul className="grid gap-0.5">
            {(expanded ? fields : missing).map((field) => (
              <li key={field.key}>
                <button
                  type="button"
                  onClick={() => goToField(field)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
                >
                  {field.undisclosed ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
                      <EyeOff className="h-2.5 w-2.5 text-white/50" />
                    </span>
                  ) : field.complete ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20" />
                  )}

                  <span
                    className={`truncate text-[13px] ${
                      field.complete ? "text-white/40" : "text-white/85"
                    }`}
                  >
                    {field.label}
                  </span>

                  <span className="ml-auto shrink-0 text-[11px] text-white/25 transition group-hover:text-fuchsia-300">
                    {field.undisclosed ? "Sin mostrar" : field.complete ? "Editar" : "Completar"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
