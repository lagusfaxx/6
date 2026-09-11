"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import { missingProfileFields } from "../../../../lib/profileCompletion";
import ProfileCompletenessBar from "./ProfileCompletenessBar";
import StudioWelcome from "./StudioWelcome";
import ProfileEditor from "./editors/ProfileEditor";
import CoverAvatarEditor from "./editors/CoverAvatarEditor";
import ProductsEditor from "./editors/ProductsEditor";
import GalleryEditor from "./editors/GalleryEditor";
import LocationEditor from "./editors/LocationEditor";

type Props = {
  profileType: string;
  user: any;
};

/* ── Pill-style tab button ──
   Lleva cuántos obligatorios faltan en esa pestaña: sin eso, cambiar de
   pestaña era la única forma de descubrir que quedaban datos pendientes. */
function TabButton({
  active,
  label,
  pending = 0,
  onClick,
}: {
  active: boolean;
  label: string;
  pending?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white shadow-[0_2px_12px_rgba(168,85,247,0.25)]"
          : "text-white/45 hover:bg-white/[0.06] hover:text-white/70"
      }`}
    >
      {label}
      {pending > 0 && (
        <span
          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            active ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-300"
          }`}
          title={`${pending} dato${pending !== 1 ? "s" : ""} obligatorio${pending !== 1 ? "s" : ""} sin completar`}
        >
          {pending}
        </span>
      )}
    </button>
  );
}

export default function EditorPanel({ profileType, user }: Props) {
  const { state, setField } = useDashboardForm();
  const ctx = useDashboardForm() as any;

  const pendingByTab = useMemo(() => {
    if (profileType !== "PROFESSIONAL") return {} as Record<string, number>;
    return missingProfileFields(state).reduce<Record<string, number>>((acc, field) => {
      acc[field.tab] = (acc[field.tab] ?? 0) + 1;
      return acc;
    }, {});
  }, [profileType, state]);

  const tabs = useMemo(
    () => [
      { key: "perfil", label: "Mi Perfil" },
      ...(profileType === "SHOP" ? [{ key: "productos", label: "Productos" }] : []),
      { key: "galeria", label: "Fotos" },
      { key: "ubicacion", label: "Mapa" },
    ],
    [profileType]
  );

  return (
    <div className="space-y-4">
      <StudioWelcome />
      <ProfileCompletenessBar user={user} profileType={profileType} />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1.5">
        {tabs.map((t) => (
          <TabButton
            key={t.key}
            active={state.tab === t.key}
            label={t.label}
            pending={pendingByTab[t.key] ?? 0}
            onClick={() => setField("tab", t.key)}
          />
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {state.tab === "perfil" && (
            <div className="space-y-4">
              <CoverAvatarEditor user={user} onUpload={ctx.onUploadProfileImage} />
              <ProfileEditor />
            </div>
          )}

          {state.tab === "productos" && (
            <ProductsEditor
              onSaveProduct={ctx.onSaveProduct}
              onRemoveProduct={ctx.onRemoveProduct}
              onStartEditProduct={ctx.onStartEditProduct}
              onCreateShopCategory={ctx.onCreateShopCategory}
              onRemoveShopCategory={ctx.onRemoveShopCategory}
              onUploadProductMedia={ctx.onUploadProductMedia}
              onRemoveProductMedia={ctx.onRemoveProductMedia}
            />
          )}

          {state.tab === "galeria" && (
            <GalleryEditor
              onUploadGallery={ctx.onUploadGallery}
              onRemoveGalleryItem={ctx.onRemoveGalleryItem}
            />
          )}

          {state.tab === "ubicacion" && (
            <LocationEditor
              profileType={profileType}
              user={user}
              onGeocodeProfileAddress={ctx.onGeocodeProfileAddress}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
