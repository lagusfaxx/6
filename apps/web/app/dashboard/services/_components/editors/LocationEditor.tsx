"use client";

import { useDashboardForm } from "../../../../../hooks/useDashboardForm";
import EditorCard from "../EditorCard";
import FloatingInput from "../FloatingInput";
import MapboxMap from "../../../../../components/MapboxMap";
import MapboxAddressAutocomplete from "../../../../../components/MapboxAddressAutocomplete";

type Props = {
  profileType: string;
  user: any;
  onGeocodeProfileAddress: () => Promise<void>;
};

export default function LocationEditor({
  profileType,
  user,
  onGeocodeProfileAddress,
}: Props) {
  const { state, setField } = useDashboardForm();
  /* La comuna es obligatoria para publicar: se marca acá igual que en la
     pestaña de perfil, y la lista de requisitos salta directo a ella. */
  const cityComplete = !!state.city.trim();
  const requiresMapboxLocation =
    profileType === "PROFESSIONAL" ||
    profileType === "ESTABLISHMENT" ||
    profileType === "SHOP";

  return (
    <EditorCard
      title="Ubicación"
      subtitle="Dónde te ubica el cliente en el mapa."
      delay={0}
    >
      <div className="grid gap-4">
        {requiresMapboxLocation ? (
          <MapboxAddressAutocomplete
            label="Dirección"
            value={state.address}
            onChange={(v) => {
              setField("address", v);
              setField("profileLocationVerified", false);
            }}
            onSelect={(selection) => {
              setField("address", selection.placeName);
              setField("city", selection.city || "");
              setField("profileLatitude", String(selection.latitude));
              setField("profileLongitude", String(selection.longitude));
              setField("profileLocationVerified", true);
              setField("lastProfileGeocoded", selection.placeName);
            }}
            placeholder="Busca y selecciona tu dirección"
            required
          />
        ) : (
          <FloatingInput
            label="Dirección"
            value={state.address}
            onChange={(v) => setField("address", v)}
          />
        )}
        <FloatingInput
          fieldKey="city"
          label="Comuna"
          value={state.city}
          onChange={(v) => setField("city", v)}
          placeholder="Las Condes"
          hint="Se completa sola al elegir la dirección en el buscador."
          required
          complete={cityComplete}
        />

        {requiresMapboxLocation && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onGeocodeProfileAddress}
                disabled={state.profileGeocodeBusy}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] transition"
              >
                {state.profileGeocodeBusy
                  ? "Buscando..."
                  : "Verificar dirección en mapa"}
              </button>
              <span className="text-[11px] text-white/25">
                Buscamos automáticamente mientras escribes.
              </span>
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
                    name: state.displayName || user?.username || "Perfil",
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
                Verifica la dirección en el mapa para sobrescribir tu ubicación
                anterior.
              </div>
            )}
          </>
        )}
      </div>
    </EditorCard>
  );
}
