"use client";

import { type ChangeEvent } from "react";
import { resolveMediaUrl } from "../../../../../lib/api";
import { useDashboardForm, type Product } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";

type Props = {
  onSaveProduct: () => Promise<void>;
  onRemoveProduct: (id: string) => Promise<void>;
  onStartEditProduct: (item: Product) => void;
  onCreateShopCategory: () => Promise<void>;
  onRemoveShopCategory: (id: string) => Promise<void>;
  onUploadProductMedia: (productId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveProductMedia: (mediaId: string) => Promise<void>;
};

export default function ProductsEditor({
  onSaveProduct,
  onRemoveProduct,
  onStartEditProduct,
  onCreateShopCategory,
  onRemoveShopCategory,
  onUploadProductMedia,
  onRemoveProductMedia,
}: Props) {
  const { state, setField } = useDashboardForm();

  return (
    <div className="space-y-4">
      {/* Shop categories */}
      <EditorCard title="Categorias de tu tienda" subtitle="Crealas antes de asignarlas a productos." delay={0}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="input-studio flex-1"
            placeholder="Ej: Juguetes premium"
            value={state.newShopCategory}
            onChange={(e) => setField("newShopCategory", e.target.value)}
          />
          <button
            type="button"
            onClick={onCreateShopCategory}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-white/60 hover:bg-white/[0.06] transition whitespace-nowrap"
          >
            Crear categoria
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.shopCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onRemoveShopCategory(cat.id)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06] transition"
            >
              {cat.name} &times;
            </button>
          ))}
          {!state.shopCategories.length && (
            <p className="text-xs text-white/25">Aun no has creado categorias para tu tienda.</p>
          )}
        </div>
      </EditorCard>

      {/* Products list */}
      <EditorCard title="Productos activos" delay={0.05}>
        <div className="grid gap-3">
          {state.products.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:border-white/[0.10]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-white/90">{item.name}</div>
                  <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{item.description || "Sin descripcion"}</p>
                  <p className="mt-0.5 text-xs text-white/30">
                    {item.shopCategory?.name || "Sin categoria"} · ${item.price} · Stock {item.stock}
                  </p>
                  {/* Product media thumbnails */}
                  {item.media && item.media.length > 0 && (
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {item.media.map((m) => (
                        <div key={m.id} className="relative group">
                          <img
                            src={resolveMediaUrl(m.url) ?? undefined}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-white/[0.06]"
                          />
                          <button
                            onClick={() => onRemoveProductMedia(m.id)}
                            className="absolute -right-1 -top-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 text-[8px] text-white"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <label className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 cursor-pointer hover:bg-white/[0.06] transition">
                    {state.uploadingProductId === item.id ? "Subiendo..." : "Fotos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onUploadProductMedia(item.id, e)}
                    />
                  </label>
                  <button
                    onClick={() => onStartEditProduct(item)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06] transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onRemoveProduct(item.id)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-red-300/70 hover:bg-red-500/10 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!state.products.length && (
            <p className="py-4 text-center text-xs text-white/30">Aun no tienes productos publicados.</p>
          )}
        </div>
      </EditorCard>

      {/* Create/edit product form */}
      <EditorCard
        title={state.editingProductId ? "Editar producto" : "Nuevo producto"}
        subtitle="Completa los datos para publicar."
        delay={0.1}
      >
        <div className="grid gap-4">
          <FloatingInput
            label="Nombre"
            value={state.productName}
            onChange={(v) => setField("productName", v)}
          />
          <FloatingTextarea
            label="Descripcion"
            value={state.productDescription}
            onChange={(v) => setField("productDescription", v)}
            rows={3}
          />
          <FloatingSelect
            label="Categoria"
            value={state.productCategoryId}
            onChange={(v) => setField("productCategoryId", v)}
            options={state.shopCategories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            placeholder="Selecciona una categoria de tu tienda"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingInput
              label="Precio"
              value={state.productPrice}
              onChange={(v) => setField("productPrice", v)}
              type="number"
              min="0"
            />
            <FloatingInput
              label="Stock"
              value={state.productStock}
              onChange={(v) => setField("productStock", v)}
              type="number"
              min="0"
            />
          </div>
          <button
            disabled={state.busy}
            onClick={onSaveProduct}
            className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold shadow-[0_8px_20px_rgba(168,85,247,0.15)] transition hover:brightness-110 disabled:opacity-40 w-full sm:w-fit"
          >
            {state.editingProductId ? "Guardar cambios" : "Publicar producto"}
          </button>
        </div>
      </EditorCard>
    </div>
  );
}
