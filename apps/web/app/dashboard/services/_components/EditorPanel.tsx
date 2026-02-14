"use client";

import { type ChangeEvent, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardForm, type ServiceItem, type Product } from "../../../../hooks/useDashboardForm";
import { Tabs, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import ProfileCompletenessBar from "./ProfileCompletenessBar";
import ProfileEditor from "./editors/ProfileEditor";
import CoverAvatarEditor from "./editors/CoverAvatarEditor";
import ServicesEditor from "./editors/ServicesEditor";
import ProductsEditor from "./editors/ProductsEditor";
import GalleryEditor from "./editors/GalleryEditor";
import LocationEditor from "./editors/LocationEditor";

type Props = {
  profileType: string;
  user: any;
};

export default function EditorPanel({ profileType, user }: Props) {
  const { state, setField } = useDashboardForm();

  /* Read callbacks from context that orchestrator injects */
  const ctx = useDashboardForm() as any;

  const tabs = useMemo(
    () => [
      { key: "perfil", label: "Perfil" },
      ...(profileType !== "SHOP" ? [{ key: "servicios", label: "Servicios" }] : []),
      ...(profileType === "SHOP" ? [{ key: "productos", label: "Productos" }] : []),
      { key: "galeria", label: "Galeria" },
      { key: "ubicacion", label: "Ubicacion" },
    ],
    [profileType]
  );

  return (
    <div className="space-y-0">
      <ProfileCompletenessBar user={user} profileType={profileType} />

      <Tabs value={state.tab} onValueChange={(v) => setField("tab", v)}>
        <TabsList className="flex flex-wrap gap-1 mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={state.tab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {state.tab === "perfil" && (
              <div className="space-y-4">
                <ProfileEditor />
                <CoverAvatarEditor user={user} onUpload={ctx.onUploadProfileImage} />
              </div>
            )}

            {state.tab === "servicios" && (
              <ServicesEditor
                profileType={profileType}
                onSaveService={ctx.onSaveService}
                onRemoveService={ctx.onRemoveService}
                onStartEditService={ctx.onStartEditService}
                onGeocodeAddress={ctx.onGeocodeAddress}
              />
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
      </Tabs>
    </div>
  );
}
