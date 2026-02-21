"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardForm, type DashboardFormState } from "../../../../hooks/useDashboardForm";
import { Check, ChevronDown, Circle } from "lucide-react";

type CheckItem = { label: string; complete: boolean; weight: number };

function computeChecks(state: DashboardFormState, user: any, profileType: string): CheckItem[] {
  const checks: CheckItem[] = [
    { label: "Nombre visible", complete: !!state.displayName.trim(), weight: 15 },
    { label: "Foto de perfil", complete: !!(state.avatarPreview || user?.avatarUrl), weight: 15 },
    { label: "Foto de portada", complete: !!(state.coverPreview || user?.coverUrl), weight: 10 },
    { label: "Descripción", complete: !!state.bio.trim(), weight: 15 },
    { label: "Descripción de servicios", complete: !!state.serviceDescription.trim(), weight: 10 },
    { label: "Fecha de nacimiento", complete: !!state.birthdate, weight: 5 },
    { label: "Ubicación", complete: !!(state.address.trim() && state.city.trim()), weight: 10 },
    { label: "Galería (3+ fotos)", complete: state.gallery.length >= 3, weight: 10 },
  ];

  if (profileType === "SHOP") {
    checks.push({ label: "Productos", complete: state.products.length > 0, weight: 10 });
  } else {
    checks.push({ label: "Servicios", complete: state.items.length > 0, weight: 10 });
  }

  return checks;
}

type Props = {
  user: any;
  profileType: string;
};

export default function ProfileCompletenessBar({ user, profileType }: Props) {
  const { state } = useDashboardForm();
  const [expanded, setExpanded] = useState(false);

  const checks = useMemo(() => computeChecks(state, user, profileType), [state, user, profileType]);

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.filter((c) => c.complete).reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((earned / totalWeight) * 100);

  const completedCount = checks.filter((c) => c.complete).length;
  const isComplete = percentage === 100;

  const barColor = isComplete
    ? "from-emerald-500 to-emerald-400"
    : percentage >= 70
      ? "from-violet-500 to-fuchsia-500"
      : "from-amber-500 to-orange-500";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${
            isComplete
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-violet-500/20 text-violet-300"
          }`}>
            {percentage}%
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">
              Perfil {isComplete ? "completo" : `${completedCount}/${checks.length}`}
            </p>
            {!isComplete && (
              <p className="text-[11px] text-white/35">
                Completa tu perfil para mayor visibilidad
              </p>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Expanded checklist */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="px-4 py-3 space-y-1.5">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center gap-2.5 text-sm">
                  {check.complete ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5">
                      <Circle className="h-3 w-3 text-white/20" />
                    </div>
                  )}
                  <span className={check.complete ? "text-white/50 line-through" : "text-white/70"}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
