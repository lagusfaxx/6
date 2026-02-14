"use client";

import { useMemo } from "react";
import { useDashboardForm, type ServiceItem, type Category } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import FloatingTextarea from "../FloatingTextarea";
import FloatingSelect from "../FloatingSelect";
import MapboxMap from "../../../../../components/MapboxMap";
import { Badge } from "../../../../../components/ui/badge";

type Props = {
  profileType: string;
  onSaveService: () => Promise<void>;
  onRemoveService: (id: string) => Promise<void>;
  onStartEditService: (item: ServiceItem) => void;
  onGeocodeAddress: () => Promise<void>;
};

function categoryLabel(category?: { displayName?: string | null; name?: string | null } | null) {
  return category?.displayName || category?.name || "Sin categoria";
}

export default function ServicesEditor({
  profileType,
  onSaveService,
  onRemoveService,
  onStartEditService,
  onGeocodeAddress,
}: Props) {
  const { state, setField } = useDashboardForm();

  const kindForProfile = profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const categoryOptions = useMemo(
    () => state.categories.filter((c) => c.kind === kindForProfile),
    [state.categories, kindForProfile]
  );

  return (
    <div className="space-y-4">
      {/* Active services list */}
      <EditorCard title="Servicios activos" delay={0}>
        <div className="grid gap-3">
          {state.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:border-white/[0.10]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white/90">{item.title}</span>
                    <Badge className={item.isActive ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100" : ""}>
                      {item.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/40 line-clamp-1">{item.description || "Sin descripcion"}</p>
                  <p className="mt-0.5 text-xs text-white/30">{categoryLabel(item.categoryRel)} · ${item.price ?? "0"}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onStartEditService(item)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06] transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onRemoveService(item.id)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-red-300/70 hover:bg-red-500/10 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!state.items.length && (
            <p className="py-4 text-center text-xs text-white/30">Aun no tienes servicios publicados.</p>
          )}
        </div>
      </EditorCard>

      {/* Create/edit service form */}
      <EditorCard
        title={state.editingServiceId ? "Editar servicio" : "Nuevo servicio"}
        subtitle="Completa los datos para publicar."
        delay={0.05}
      >
        <div className="grid gap-4">
          <FloatingInput
            label="Titulo del servicio"
            value={state.title}
            onChange={(v) => setField("title", v)}
          />
          <FloatingTextarea
            label="Descripcion"
            value={state.description}
            onChange={(v) => setField("description", v)}
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSelect
              label="Categoria"
              value={state.serviceCategoryId}
              onChange={(v) => setField("serviceCategoryId", v)}
              options={categoryOptions.map((c) => ({
                value: c.id,
                label: c.displayName || c.name,
              }))}
              placeholder="Selecciona una categoria"
            />
            <FloatingInput
              label="Precio"
              value={state.price}
              onChange={(v) => setField("price", v)}
              type="number"
              min="0"
            />
          </div>

          <FloatingInput
            label="Direccion"
            value={state.serviceAddress}
            onChange={(v) => {
              setField("serviceAddress", v);
              setField("serviceVerified", false);
            }}
            placeholder="Ej: Av. Providencia 1234, Santiago"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onGeocodeAddress}
              disabled={state.geocodeBusy}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] transition"
            >
              {state.geocodeBusy ? "Buscando..." : "Reintentar busqueda"}
            </button>
            <span className="text-[11px] text-white/25">Buscamos automaticamente mientras escribes.</span>
          </div>

          {state.geocodeError && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {state.geocodeError}
            </div>
          )}

          <FloatingSelect
            label="Area aproximada"
            value={state.serviceApproxArea}
            onChange={(v) => setField("serviceApproxArea", v)}
            options={[
              { value: "300", label: "300 m" },
              { value: "450", label: "450 m" },
              { value: "600", label: "600 m" },
              { value: "800", label: "800 m" },
            ]}
            hint="La ubicacion se muestra como area aproximada."
          />

          {state.serviceVerified &&
          Number.isFinite(Number(state.serviceLatitude)) &&
          Number.isFinite(Number(state.serviceLongitude)) ? (
            <MapboxMap
              markers={[
                {
                  id: "service-location",
                  name: state.title || "Servicio",
                  lat: Number(state.serviceLatitude),
                  lng: Number(state.serviceLongitude),
                  subtitle: state.serviceLocality || state.serviceAddress || null,
                  areaRadiusM: Number(state.serviceApproxArea) || 600,
                },
              ]}
              height={180}
              className="rounded-xl"
            />
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-white/30 text-center">
              Busca y confirma la direccion para previsualizar en el mapa.
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={state.serviceIsActive}
              onChange={(e) => setField("serviceIsActive", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-fuchsia-500"
            />
            Servicio activo (solo uno puede quedar activo)
          </label>

          <button
            disabled={state.busy || !state.serviceVerified}
            onClick={onSaveService}
            className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold shadow-[0_8px_20px_rgba(168,85,247,0.15)] transition hover:brightness-110 disabled:opacity-40 w-full sm:w-fit"
          >
            {state.editingServiceId ? "Guardar cambios" : "Publicar servicio"}
          </button>

          {!state.serviceVerified && (
            <p className="text-[11px] text-amber-200/60">Confirma la direccion en el mapa para habilitar la publicacion.</p>
          )}
        </div>
      </EditorCard>
    </div>
  );
}
