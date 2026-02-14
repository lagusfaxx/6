"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveMediaUrl } from "../../../../lib/api";
import type { DashboardFormState } from "../../../../hooks/useDashboardForm";

type Props = {
  state: DashboardFormState;
  user: any;
};

function LivePreviewShop({ state, user }: Props) {
  const coverUrl = resolveMediaUrl(state.coverPreview || user?.coverUrl) ?? null;
  const avatarUrl = resolveMediaUrl(state.avatarPreview || user?.avatarUrl) ?? null;
  const displayName = state.displayName || "Tu tienda";
  const bio = state.bio || "Agrega una descripcion para tu tienda...";

  return (
    <div className="space-y-4">
      {/* Header label */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-medium tracking-wide text-white/30 uppercase">
          Vista previa en vivo
        </span>
      </div>

      {/* Hero section */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-studio-card">
        <div className="relative h-48 w-full overflow-hidden group">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Portada"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-purple-900/20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.12),transparent_50%)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          {/* Avatar */}
          {avatarUrl && (
            <div className="absolute left-5 top-5">
              <img
                src={avatarUrl}
                alt="Logo"
                className="h-14 w-14 rounded-2xl border-2 border-white/20 bg-black/40 object-cover shadow-2xl"
              />
            </div>
          )}

          {/* Store info */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs text-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Abierto
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.h1
                key={displayName}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-2xl font-bold tracking-tight"
              >
                {displayName}
              </motion.h1>
            </AnimatePresence>
            {state.address && (
              <p className="mt-1 text-xs text-white/60">{state.address}{state.city ? `, ${state.city}` : ""}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.p
              key={bio.slice(0, 30)}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-white/60 leading-relaxed"
            >
              {bio}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Products preview */}
      {state.products.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-studio-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Productos</h3>
          <div className="grid grid-cols-2 gap-3">
            {state.products.slice(0, 4).map((p) => {
              const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
                >
                  <div className="aspect-square bg-white/[0.03]">
                    {img ? (
                      <img src={img} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white/20 text-xs">
                        Sin imagen
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-white/70 line-clamp-1">{p.name}</p>
                    <p className="text-sm font-bold text-white mt-1">${p.price?.toLocaleString("es-CL") ?? 0}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
}

export default memo(LivePreviewShop);
