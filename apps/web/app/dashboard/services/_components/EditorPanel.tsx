"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import ProfileCompletenessBar from "./ProfileCompletenessBar";
import ProfileEditor from "./editors/ProfileEditor";
import CoverAvatarEditor from "./editors/CoverAvatarEditor";
import ProductsEditor from "./editors/ProductsEditor";
import GalleryEditor from "./editors/GalleryEditor";
import LocationEditor from "./editors/LocationEditor";

type Props = {
  profileType: string;
  user: any;
};

/* ── Pill-style tab button ── */
function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white shadow-[0_2px_12px_rgba(168,85,247,0.25)]"
          : "text-white/45 hover:text-white/70 hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
  );
}

export default function EditorPanel({ profileType, user }: Props) {
  const { state, setField } = useDashboardForm();
  const ctx = useDashboardForm() as any;

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
      <ProfileCompletenessBar user={user} profileType={profileType} />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1.5">
        {tabs.map((t) => (
          <TabButton
            key={t.key}
            active={state.tab === t.key}
            label={t.label}
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
