"use client";

import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import MapboxMap from "../../../../../components/MapboxMap";

type Props = {
  profileType: string;
  user: any;
  onGeocodeProfileAddress: () => Promise<void>;
};

export default function LocationEditor({ profileType, user, onGeocodeProfileAddress }: Props) {
  const { state, setField } = useDashboardForm();

  return (
    <EditorCard title="Ubicacion" subtitle="Actualiza tu direccion y ciudad." delay={0}>
      <div className="grid gap-4">
        <FloatingInput
          label="Direccion"
          value={state.address}
          onChange={(v) => {
            setField("address", v);
            if (profileType === "SHOP") setField("profileLocationVerified", false);
          }}
        />
        <FloatingInput
          label="Ciudad"
          value={state.city}
          onChange={(v) => setField("city", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingInput
            label="Latitud"
            value={state.profileLatitude}
            onChange={(v) => {
              setField("profileLatitude", v);
              if (profileType === "SHOP") setField("profileLocationVerified", false);
            }}
            placeholder="-33.45"
          />
          <FloatingInput
            label="Longitud"
            value={state.profileLongitude}
            onChange={(v) => {
              setField("profileLongitude", v);
              if (profileType === "SHOP") setField("profileLocationVerified", false);
            }}
            placeholder="-70.66"
          />
        </div>

        {profileType === "SHOP" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onGeocodeProfileAddress}
                disabled={state.profileGeocodeBusy}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] transition"
              >
                {state.profileGeocodeBusy ? "Buscando..." : "Verificar direccion en mapa"}
              </button>
              <span className="text-[11px] text-white/25">Buscamos automaticamente mientras escribes.</span>
            </div>
            {state.profileGeocodeError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {state.profileGeocodeError}
              </div>
            )}
            {state.profileLocationVerified &&
            Number.isFinite(Number(state.profileLatitude)) &&
            Number.isFinite(Number(state.profileLongitude)) ? (
              <MapboxMap
                markers={[
                  {
                    id: "profile-location",
                    name: state.displayName || user?.username || "Tienda",
                    lat: Number(state.profileLatitude),
                    lng: Number(state.profileLongitude),
                    subtitle: state.city || state.address || null,
                  },
                ]}
                height={180}
                className="rounded-xl"
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-white/30 text-center">
                Verifica la direccion en el mapa para que tu tienda aparezca correctamente.
              </div>
            )}
          </>
        )}
      </div>
    </EditorCard>
  );
}
