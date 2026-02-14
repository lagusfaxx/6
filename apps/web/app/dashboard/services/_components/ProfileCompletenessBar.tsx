"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useDashboardForm, type DashboardFormState } from "../../../../hooks/useDashboardForm";

type Check = { label: string; complete: boolean; weight: number };

function computeChecks(state: DashboardFormState, user: any, profileType: string): Check[] {
  const checks: Check[] = [
    { label: "Nombre visible", complete: !!state.displayName.trim(), weight: 15 },
    { label: "Foto de perfil", complete: !!(state.avatarPreview || user?.avatarUrl), weight: 15 },
    { label: "Foto de portada", complete: !!(state.coverPreview || user?.coverUrl), weight: 10 },
    { label: "Descripcion", complete: !!state.bio.trim(), weight: 15 },
    { label: "Descripcion de servicios", complete: !!state.serviceDescription.trim(), weight: 10 },
    { label: "Fecha de nacimiento", complete: !!state.birthdate, weight: 5 },
    { label: "Ubicacion", complete: !!(state.address.trim() && state.city.trim()), weight: 10 },
    { label: "Galeria (3+ fotos)", complete: state.gallery.length >= 3, weight: 10 },
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

  const checks = useMemo(() => computeChecks(state, user, profileType), [state, user, profileType]);

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.filter((c) => c.complete).reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((earned / totalWeight) * 100);

  const firstIncomplete = checks.find((c) => !c.complete);

  return (
    <div className="editor-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/80">
          Perfil {percentage}% completo
        </span>
        {firstIncomplete && percentage < 100 && (
          <span className="text-[11px] text-white/30">
            Falta: {firstIncomplete.label}
          </span>
        )}
        {percentage === 100 && (
          <span className="text-[11px] text-emerald-400/70">Completo</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
