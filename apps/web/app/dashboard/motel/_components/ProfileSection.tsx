"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, MapPin, Search, X } from "lucide-react";
import { MOTEL_AMENITIES } from "@uzeed/shared/motel";
import { Card, ChipToggle, Field } from "../../../../components/business/ui";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../../lib/api";
import { extractMapboxLocation } from "../../../../lib/mapboxFeature";
import { SELECTABLE_COMUNAS, resolveComuna } from "../../../../lib/comunas";
import type { MotelProfile, Notify } from "./types";

const MapboxMap = dynamic(() => import("../../../../components/MapboxMap"), { ssr: false });

async function putProfile(body: Record<string, unknown>) {
  return apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify(body) });
}

export default function ProfileSection({ profile, reload, notify }: { profile: MotelProfile; reload: () => void; notify: Notify }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Mi ficha</h1>
        <p className="text-[13px] text-white/45">Lo que ven los clientes en el directorio y en tu página de UZEED.</p>
      </div>
      <PhotosCard profile={profile} reload={reload} notify={notify} />
      <DetailsCard profile={profile} reload={reload} notify={notify} />
      <AmenitiesCard profile={profile} reload={reload} notify={notify} />
      <LocationCard profile={profile} reload={reload} notify={notify} />
    </div>
  );
}

function PhotosCard({ profile, reload, notify }: { profile: MotelProfile; reload: () => void; notify: Notify }) {
  const coverRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(kind: "cover" | "avatar" | "media", files: FileList | null) {
    if (!files?.length) return;
    setBusy(kind);
    try {
      const fd = new FormData();
      if (kind === "media") Array.from(files).slice(0, 12).forEach((f) => fd.append("files", f));
      else fd.append("file", files[0]);
      const res = await fetch(`${getApiBase()}/profile/${kind}`, { method: "POST", credentials: "include", body: fd });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "No se pudo subir la imagen.");
      if (payload?.failures?.length) notify(`${payload.failures.length} foto(s) no se pudieron procesar.`, "error");
      else notify(kind === "cover" ? "Portada actualizada." : kind === "avatar" ? "Logo actualizado." : "Fotos agregadas.");
      reload();
    } catch (e: any) {
      notify(e?.message || "No se pudo subir la imagen.", "error");
    } finally {
      setBusy(null);
      [coverRef, logoRef, galleryRef].forEach((r) => r.current && (r.current.value = ""));
    }
  }

  async function removeMedia(id: string) {
    if (!window.confirm("¿Quitar esta foto de tu ficha?")) return;
    try {
      await apiFetch(`/profile/media/${id}`, { method: "DELETE" });
      notify("Foto quitada.");
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    }
  }

  const cover = resolveMediaUrl(profile.coverUrl);
  const logo = resolveMediaUrl(profile.avatarUrl);

  return (
    <Card title="Fotos" description="La portada es la primera foto de tu ficha y de tu tarjeta en el directorio. Suma fotos de la fachada, el estacionamiento y la recepción.">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <button onClick={() => coverRef.current?.click()} className="group relative aspect-[16/9] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="Portada" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-[13px] transition ${cover ? "bg-black/50 opacity-0 group-hover:opacity-100" : "text-white/50"}`}>
            <Camera className="h-5 w-5" /> {busy === "cover" ? "Subiendo..." : cover ? "Cambiar portada" : "Subir portada"}
          </span>
        </button>
        <button onClick={() => logoRef.current?.click()} className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-[12px] text-white/50">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <><Camera className="mb-1 h-5 w-5" /> Logo</>
          )}
          {busy === "avatar" && <span className="absolute inset-0 flex items-center justify-center bg-black/60">Subiendo...</span>}
        </button>
      </div>
      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("cover", e.target.files)} />
      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("avatar", e.target.files)} />

      <p className="mb-2 mt-5 text-[12px] font-medium text-white/55">Fotos del local</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {profile.gallery.map((m) => (
          <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(m.url) || ""} alt="" className="h-full w-full object-cover" />
            <button onClick={() => removeMedia(m.id)} className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1" aria-label="Quitar foto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button onClick={() => galleryRef.current?.click()} disabled={busy === "media"} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-white/45 transition hover:border-fuchsia-400/40 hover:text-white/80">
          <ImagePlus className="h-5 w-5" />
          <span className="text-[11px]">{busy === "media" ? "Subiendo..." : "Agregar"}</span>
        </button>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload("media", e.target.files)} />
      <p className="mt-2 text-[11px] text-white/35">Las fotos de cada habitación se cargan dentro de la habitación.</p>
    </Card>
  );
}

function DetailsCard({ profile, reload, notify }: { profile: MotelProfile; reload: () => void; notify: Notify }) {
  const [d, setD] = useState({ displayName: "", phone: "", schedule: "", rules: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setD({ displayName: profile.displayName || "", phone: profile.phone || "", schedule: profile.schedule || "", rules: profile.rules || "" });
  }, [profile.displayName, profile.phone, profile.schedule, profile.rules]);
  const dirty =
    d.displayName !== (profile.displayName || "") || d.phone !== (profile.phone || "") ||
    d.schedule !== (profile.schedule || "") || d.rules !== (profile.rules || "");

  async function save() {
    setSaving(true);
    try {
      await putProfile(d);
      notify("Datos guardados.");
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Datos del motel"
      action={dirty ? <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? "Guardando..." : "Guardar"}</button> : null}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input value={d.displayName} maxLength={40} onChange={(e) => setD((p) => ({ ...p, displayName: e.target.value }))} className="input-studio" />
        </Field>
        <Field label="Teléfono de recepción" hint="Se muestra a quien ya reservó.">
          <input type="tel" inputMode="tel" value={d.phone} onChange={(e) => setD((p) => ({ ...p, phone: e.target.value }))} placeholder="+56 9 1234 5678" className="input-studio" />
        </Field>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Horario">
          <input value={d.schedule} maxLength={200} onChange={(e) => setD((p) => ({ ...p, schedule: e.target.value }))} placeholder="Abierto 24 horas, todos los días" className="input-studio" />
        </Field>
        <Field label="Descripción" hint="Cuenta qué hace especial a tu motel y las reglas de la casa.">
          <textarea value={d.rules} maxLength={2000} onChange={(e) => setD((p) => ({ ...p, rules: e.target.value }))} placeholder="A pasos del metro, estacionamiento con ingreso directo a la habitación..." className="input-studio min-h-[110px] resize-none" />
        </Field>
      </div>
      {dirty && (
        <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full py-3 text-sm sm:hidden">{saving ? "Guardando..." : "Guardar datos"}</button>
      )}
    </Card>
  );
}

function AmenitiesCard({ profile, reload, notify }: { profile: MotelProfile; reload: () => void; notify: Notify }) {
  const [sel, setSel] = useState<string[]>(profile.amenities);
  const [saving, setSaving] = useState(false);
  useEffect(() => setSel(profile.amenities), [profile.amenities]);
  const dirty = sel.slice().sort().join() !== profile.amenities.slice().sort().join();

  async function save() {
    setSaving(true);
    try {
      await putProfile({ amenities: sel });
      notify("Comodidades guardadas.");
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Comodidades del motel"
      description="Los clientes filtran el directorio por estas opciones: marca todas las que tienes."
      action={dirty ? <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? "Guardando..." : "Guardar"}</button> : null}
    >
      <div className="flex flex-wrap gap-2">
        {MOTEL_AMENITIES.map((a) => (
          <ChipToggle key={a.key} active={sel.includes(a.key)} onClick={() => setSel((p) => (p.includes(a.key) ? p.filter((x) => x !== a.key) : [...p, a.key]))}>
            {a.label}
          </ChipToggle>
        ))}
      </div>
    </Card>
  );
}

function LocationCard({ profile, reload, notify }: { profile: MotelProfile; reload: () => void; notify: Notify }) {
  const initialComuna = resolveComuna(profile.city, profile.latitude, profile.longitude)?.slug || "";
  const [comuna, setComuna] = useState(initialComuna);
  const [address, setAddress] = useState(profile.address || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile.latitude != null && profile.longitude != null ? { lat: profile.latitude, lng: profile.longitude } : null,
  );
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setComuna(resolveComuna(profile.city, profile.latitude, profile.longitude)?.slug || "");
    setAddress(profile.address || "");
    setCoords(profile.latitude != null && profile.longitude != null ? { lat: profile.latitude, lng: profile.longitude } : null);
  }, [profile.city, profile.address, profile.latitude, profile.longitude]);

  const comunaObj = SELECTABLE_COMUNAS.find((c) => c.slug === comuna);
  const dirty =
    address !== (profile.address || "") || comuna !== initialComuna ||
    coords?.lat !== profile.latitude || coords?.lng !== profile.longitude;

  async function search() {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    const q = [address, comunaObj?.name].filter(Boolean).join(", ");
    if (!address.trim()) return notify("Escribe la dirección.", "error");
    if (!token) return notify("El mapa no está disponible ahora.", "error");
    setSearching(true);
    try {
      const prox = comunaObj ? `&proximity=${comunaObj.lng},${comunaObj.lat}` : "";
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=1&language=es&country=cl${prox}`);
      const f = (await res.json())?.features?.[0];
      const loc = f?.center?.length ? extractMapboxLocation(f) : null;
      if (!loc || loc.latitude == null || loc.longitude == null) return notify("No encontramos esa dirección. Prueba con calle, número y comuna.", "error");
      setCoords({ lat: loc.latitude, lng: loc.longitude });
      setAddress(f.place_name || address);
      const found = resolveComuna(loc.city, loc.latitude, loc.longitude);
      if (found && !comuna) setComuna(found.slug);
    } catch {
      notify("No pudimos buscar la dirección.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    if (!comunaObj) return notify("Elige la comuna del motel.", "error");
    if (!coords) return notify("Toca \"Buscar en el mapa\" para ubicar la dirección.", "error");
    setSaving(true);
    try {
      await putProfile({ city: comunaObj.name, address, latitude: coords.lat, longitude: coords.lng });
      notify(`Ubicación guardada. Apareces en Moteles en ${comunaObj.name}.`);
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const regions = Array.from(new Set(SELECTABLE_COMUNAS.map((c) => c.region)));

  return (
    <Card
      title="Ubicación"
      description="La comuna define en qué página del directorio apareces (por ejemplo, Moteles en Providencia)."
      action={dirty ? <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? "Guardando..." : "Guardar"}</button> : null}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_1.6fr]">
        <Field label="Comuna">
          <select value={comuna} onChange={(e) => setComuna(e.target.value)} className="input-studio [color-scheme:dark]">
            <option value="" className="bg-[#161726]">Elige la comuna</option>
            {regions.map((r) => (
              <optgroup key={r} label={r} className="bg-[#161726]">
                {SELECTABLE_COMUNAS.filter((c) => c.region === r).map((c) => (
                  <option key={c.slug} value={c.slug} className="bg-[#161726]">{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Dirección">
          <div className="flex gap-2">
            <input
              value={address}
              onChange={(e) => { setAddress(e.target.value); setCoords(null); }}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Av. Providencia 2130"
              className="input-studio"
            />
            <button onClick={search} disabled={searching} className="btn-secondary shrink-0 px-3 text-sm" aria-label="Buscar en el mapa">
              <Search className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">{searching ? "Buscando..." : "Buscar en el mapa"}</span>
            </button>
          </div>
        </Field>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        {coords ? (
          <MapboxMap height={240} focusMarkerId="motel" markers={[{ id: "motel", name: profile.displayName || "Mi motel", lat: coords.lat, lng: coords.lng, subtitle: address }]} />
        ) : (
          <div className="flex h-[140px] flex-col items-center justify-center gap-1 bg-white/[0.02] text-[13px] text-white/40">
            <MapPin className="h-5 w-5" /> Busca la dirección para fijar el punto en el mapa
          </div>
        )}
      </div>
      {dirty && (
        <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full py-3 text-sm sm:hidden">{saving ? "Guardando..." : "Guardar ubicación"}</button>
      )}
    </Card>
  );
}
