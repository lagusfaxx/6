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

function LivePreviewEstablishment({ state, user }: Props) {
  const coverUrl = resolveMediaUrl(state.coverPreview || user?.coverUrl) ?? null;
  const avatarUrl = state.avatarPreview || user?.avatarUrl;
  const displayName = state.displayName || "Tu establecimiento";
  const bio = state.bio || "Agrega una descripcion...";

  return (
    <div className="space-y-4">
      {/* Header label */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-medium tracking-wide text-white/30 uppercase">
          Vista previa en vivo
        </span>
      </div>

      {/* Main card */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Avatar */}
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

          <div className="mt-1 text-sm text-white/50">
            {state.city && <span>{state.city}</span>}
            {state.city && state.address && <span> · </span>}
            {state.address && <span>{state.address}</span>}
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

          {state.serviceDescription && (
            <div className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white/50">
              {state.serviceDescription}
            </div>
          )}

          <div className="mt-4">
            <div className="rounded-xl bg-gradient-to-r from-fuchsia-600/60 to-violet-600/60 px-4 py-2 text-xs text-white/70 inline-block">
              Calificar
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
          <h3 className="text-sm font-semibold text-white/80 mb-3">Habitaciones / Ofertas</h3>
          <div className="space-y-2">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 border border-white/[0.04]"
              >
                <span className="text-sm font-medium text-white/80">{item.title}</span>
                <span className="text-sm text-white/50">${item.price ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(LivePreviewEstablishment);
