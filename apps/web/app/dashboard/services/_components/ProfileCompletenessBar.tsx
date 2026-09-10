"use client";

import { useMemo, useState } from "react";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import { requiredProfileFields, type RequiredField } from "../../../../lib/profileCompletion";
import { Check, ChevronDown, Circle } from "lucide-react";

type Props = {
  user: any;
  profileType: string;
};

/**
 * Requisitos para publicar.
 *
 * No es una barra de "completitud" decorativa: son los campos sin los cuales el
 * servidor no publica el perfil (apps/api/src/lib/profileCompletion.ts). Cada
 * campo que falta lleva a la pestaña donde se completa, porque la queja real no
 * es que falte el dato sino no saber dónde se pone.
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
  /* Ya estaba publicado antes de la regla: se le avisa, no se le bloquea. */
  const grandfathered = Boolean(user?.profileCompletedAt);

  const tone = complete
    ? {
        border: "border-emerald-500/20",
        bg: "bg-emerald-500/[0.06]",
        chip: "bg-emerald-500/15 text-emerald-300",
        bar: "bg-emerald-400",
      }
    : grandfathered
      ? {
          border: "border-white/10",
          bg: "bg-white/[0.03]",
          chip: "bg-white/10 text-white/70",
          bar: "bg-white/40",
        }
      : {
          border: "border-amber-500/25",
          bg: "bg-amber-500/[0.07]",
          chip: "bg-amber-500/15 text-amber-200",
          bar: "bg-amber-400",
        };

  const title = complete
    ? "Ficha completa"
    : grandfathered
      ? `Te faltan ${missing.length} datos en la ficha`
      : "Tu perfil no se publica hasta completar la ficha";

  const subtitle = complete
    ? "El cliente ve todos los datos que busca."
    : grandfathered
      ? "Tu perfil sigue publicado, pero se ve incompleto frente a los que sí los tienen."
      : `Faltan ${missing.length} de ${fields.length} datos que el cliente mira antes de escribir.`;

  return (
    <div className={`mb-4 overflow-hidden rounded-2xl border ${tone.border} ${tone.bg}`}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tone.chip}`}
          >
            {percentage}%
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/85">{title}</p>
            <p className="text-[11px] text-white/40">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className="px-4 pb-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {(expanded || (!complete && !grandfathered)) && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <ul className="space-y-1">
            {(expanded ? fields : missing).map((field) => (
              <li key={field.key}>
                <button
                  type="button"
                  onClick={() => setField("tab", field.tab)}
                  disabled={field.complete}
                  className="flex w-full items-center gap-2.5 rounded-lg py-1 text-left text-sm transition disabled:cursor-default"
                >
                  {field.complete ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                      <Circle className="h-3 w-3 text-white/25" />
                    </span>
                  )}
                  <span className={field.complete ? "text-white/40" : "text-white/80"}>
                    {field.label}
                  </span>
                  {!field.complete && (
                    <span className="ml-auto text-[11px] text-white/35 underline underline-offset-4">
                      Completar
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
