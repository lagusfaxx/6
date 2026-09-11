"use client";

import { useMemo, useState } from "react";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import {
  focusRequiredField,
  requiredProfileFields,
  type RequiredField,
} from "../../../../lib/profileCompletion";
import { ArrowRight, Check, ChevronDown, EyeOff, TrendingUp, Sparkles } from "lucide-react";

type Props = {
  profileType: string;
};

/** Anillo de progreso: el puntaje se lee de un vistazo, sin leerlo. */
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
 * Visibilidad del perfil.
 *
 * Esto fue una lista de requisitos que retenía la publicación. Ya no: el
 * anuncio sale al aire igual, y estos datos son lo que hace que aparezca en
 * más búsquedas y filtros. El tono cambia con eso — es una palanca que ella
 * decide usar, no un peaje. Lo que no quiera publicar lo marca como "prefiero
 * no decirlo" y suma igual.
 */
export default function ProfileCompletenessBar({ profileType }: Props) {
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

  const goToField = (field: RequiredField) => {
    if (state.tab !== field.tab) setField("tab", field.tab);
    focusRequiredField(field.key);
  };

  const tone = complete
    ? { ring: "text-emerald-400", border: "border-emerald-500/20", glow: "from-emerald-500/[0.10]" }
    : percentage >= 60
      ? { ring: "text-fuchsia-400", border: "border-fuchsia-500/20", glow: "from-fuchsia-500/[0.08]" }
      : { ring: "text-violet-400", border: "border-white/10", glow: "from-violet-500/[0.07]" };

  const title = complete
    ? "Perfil al máximo de visibilidad"
    : "Suma visibilidad a tu perfil";

  const subtitle = complete
    ? "Apareces en todas las búsquedas y filtros que usa el cliente."
    : `${missing.length} dato${missing.length !== 1 ? "s" : ""} para aparecer en más búsquedas. Tu perfil ya está publicado.`;

  return (
    <div
      className={`relative mb-4 overflow-hidden rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.glow} via-white/[0.02] to-transparent`}
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        {complete ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </span>
        ) : (
          <ProgressRing value={percentage} tone={tone.ring} />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-white/90">
            {!complete && <TrendingUp className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />}
            {title}
          </p>
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

      {!complete && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => goToField(missing[0])}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-left transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.08]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15">
              <TrendingUp className="h-3.5 w-3.5 text-fuchsia-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-white/30">
                Lo que más suma ahora
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
                    {field.undisclosed ? "Sin mostrar" : field.complete ? "Editar" : "Agregar"}
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
