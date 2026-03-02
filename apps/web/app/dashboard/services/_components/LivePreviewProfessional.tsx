"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveMediaUrl } from "../../../../lib/api";
import Avatar from "../../../../components/Avatar";
import type { DashboardFormState } from "../../../../hooks/useDashboardForm";

type Props = {
  state: DashboardFormState;
  user: any;
};

function LivePreviewProfessional({ state, user }: Props) {
  const coverUrl = resolveMediaUrl(state.coverPreview || user?.coverUrl) ?? null;
  const avatarUrl = state.avatarPreview || user?.avatarUrl;
  const displayName = state.displayName || "Tu nombre";
  const bio = state.bio || "Agrega una descripcion para tu perfil...";
  const serviceDesc = state.serviceDescription || "";
  const genderLabel = state.gender === "FEMALE" ? "Mujer" : state.gender === "MALE" ? "Hombre" : "Otro";

  return (
    <div className="space-y-4">
      {/* Header label */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-medium tracking-wide text-white/30 uppercase">
          Vista previa en vivo
        </span>
      </div>

      {/* Profile card */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-studio-card">
        {/* Cover */}
        <div className="relative h-40 w-full bg-white/[0.04] group overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Portada"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent" />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Online badge */}
          <div className="absolute right-4 top-4">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-100 border border-emerald-400/20">
              Online
            </span>
          </div>

          {/* Avatar overlapping */}
          <div className="absolute -bottom-7 left-5">
            <div
              className="rounded-full p-[2px]"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(217,70,239,0.6))",
                boxShadow: "0 0 20px rgba(139,92,246,0.25)",
              }}
            >
              <div className="rounded-full bg-studio-bg p-[2px]">
                <Avatar src={avatarUrl} alt={displayName} size={72} />
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-5 pb-5 pt-10">
          <AnimatePresence mode="wait">
            <motion.h2
              key={displayName}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-xl font-semibold text-white"
            >
              {displayName}
            </motion.h2>
          </AnimatePresence>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/50">
            <span>Experiencia</span>
            <span className="text-white/20">·</span>
            <span>{genderLabel}</span>
            {state.birthdate && (
              <>
                <span className="text-white/20">·</span>
                <span>{calculateAge(state.birthdate)} anos</span>
              </>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={bio.slice(0, 30)}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="mt-3 text-sm text-white/60 leading-relaxed"
            >
              {bio}
            </motion.p>
          </AnimatePresence>

          {serviceDesc && (
            <AnimatePresence mode="wait">
              <motion.div
                key={serviceDesc.slice(0, 30)}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white/50"
              >
                {serviceDesc}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Action buttons preview */}
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/50">
              Favorito
            </div>
            <div className="rounded-xl bg-gradient-to-r from-fuchsia-600/60 to-violet-600/60 px-4 py-2 text-xs text-white/70">
              Solicitar / reservar
            </div>
          </div>
        </div>
      </div>

      {/* Gallery preview */}
      {state.gallery.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-studio-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Galeria</h3>
          <div className="grid grid-cols-3 gap-2">
            {state.gallery.slice(0, 6).map((g) => (
              <div key={g.id} className="aspect-square overflow-hidden rounded-xl border border-white/[0.06]">
                <img
                  src={resolveMediaUrl(g.url) ?? undefined}
                  alt="Galeria"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services preview */}
      {state.items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-studio-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Servicios</h3>
          <div className="space-y-2">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 border border-white/[0.04]"
              >
                <div>
                  <span className="text-sm font-medium text-white/80">{item.title}</span>
                  {item.categoryRel && (
                    <span className="ml-2 text-xs text-white/30">
                      {item.categoryRel.displayName || item.categoryRel.name}
                    </span>
                  )}
                </div>
                <span className="text-sm text-white/50">${item.price ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location preview */}
      {state.address && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-studio-card">
          <h3 className="text-sm font-semibold text-white/80 mb-2">Ubicacion</h3>
          <p className="text-xs text-white/40">{state.address}{state.city ? `, ${state.city}` : ""}</p>
        </div>
      )}
    </div>
  );
}

function calculateAge(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default memo(LivePreviewProfessional);
