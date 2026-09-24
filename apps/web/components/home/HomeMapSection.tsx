"use client";

/**
 * Mapa de cercanía en el home.
 *
 * Es la diferencia de UZEED frente al resto de los directorios, así que va
 * como banda ancha justo después de Diamond: a la izquierda el mapa y a la
 * derecha cuántas están disponibles cerca, el radio y la leyenda de pines por
 * plan (Diamond con foto y nombre, Gold con foto, Silver como punto).
 *
 * Sigue las pestañas y los filtros del inicio: si se elige "Masajistas" o
 * "Disponibles ahora", el mapa muestra lo mismo que el listado.
 *
 * Coste: mapbox-gl pesa bastante, así que el mapa NO se monta hasta que la
 * sección entra en viewport (IntersectionObserver con margen). Hasta entonces
 * se pinta un placeholder del mismo alto — sin CLS y sin castigar el LCP.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import { spreadOverlapping, tierOrder } from "../../lib/mapMarkers";
import type { MapMarker } from "../MapboxMap";
import { LocateFixed, MapPin } from "lucide-react";
import type { HomeCategory } from "./ProfileCard";
import type { QuickFilter } from "./homeQuery";

const MapboxMap = dynamic(() => import("../MapboxMap"), { ssr: false });
const ProfilePreviewModal = dynamic(() => import("../ProfilePreviewModal"), { ssr: false });

type NearbyProfile = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  realLatitude?: number | null;
  realLongitude?: number | null;
  distance: number | null;
  profileType: "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP";
  serviceCategory: string | null;
  primaryCategory?: string | null;
  profileTags?: string[] | null;
  createdAt?: string | null;
  availableNow?: boolean;
  lastSeen?: string | null;
  userLevel?: "SILVER" | "GOLD" | "DIAMOND";
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  age?: number | null;
  heightCm?: number | null;
  hairColor?: string | null;
  weightKg?: number | null;
  baseRate?: number | null;
  galleryUrls?: string[] | null;
  websiteUrl?: string | null;
  externalOnly?: boolean;
};

const RADIUS_OPTIONS = [5, 10, 25] as const;
const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
const SANTIAGO_FALLBACK: [number, number] = [-33.45, -70.66];
const NEW_MS = 15 * 24 * 60 * 60 * 1000;

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ownerHref(p: NearbyProfile) {
  if (p.externalOnly && p.websiteUrl) return p.websiteUrl;
  return `/profesional/${p.id}`;
}

/* Misma regla que la pestaña del listado. */
function matchesCategory(p: NearbyProfile, category: HomeCategory): boolean {
  const tags = (p.profileTags ?? []).map(norm);
  const cat = `${norm(p.primaryCategory)} ${norm(p.serviceCategory)}`;
  if (category === "trans") return tags.includes("trans");
  if (category === "masajes") return p.gender !== "MALE" && cat.includes("masaj");
  return p.gender !== "MALE" && !cat.includes("masaj");
}

function matchesFilter(p: NearbyProfile, filter: QuickFilter): boolean {
  if (filter === "availableNow") return Boolean(p.availableNow);
  if (filter === "new") {
    const t = Date.parse(p.createdAt || "");
    return Number.isFinite(t) && Date.now() - t <= NEW_MS;
  }
  if (filter === "exams") {
    return (p.profileTags ?? []).some((t) => norm(t) === "profesional con examenes");
  }
  /* "Con video" depende de las historias, que el mapa no trae: se muestra
     todo en vez de un mapa vacío. */
  return true;
}

type Props = {
  category: HomeCategory;
  filter: QuickFilter;
};

export default function HomeMapSection({ category, filter }: Props) {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const center = useMemo<[number, number]>(
    () => effectiveLoc ?? SANTIAGO_FALLBACK,
    [effectiveLoc],
  );

  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [profiles, setProfiles] = useState<NearbyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NearbyProfile | null>(null);
  const fetchRef = useRef(0);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  /* Sin ubicación el mapa cae a Santiago. En ese caso NO se puede hablar de
     cercanía — para alguien en Concepción sería falso. */
  const hasLocation = Boolean(effectiveLoc);

  /* Monta el mapa recién cuando la sección se acerca al viewport. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  /* Los perfiles se piden una sola vez por ubicación, con el radio más amplio;
     pestañas, filtros y radio filtran en el cliente sin volver a pedir. */
  useEffect(() => {
    if (!visible || !hasToken) return;
    const myFetch = ++fetchRef.current;
    setLoading(true);
    setFailed(false);
    const qp = new URLSearchParams();
    qp.set("types", "PROFESSIONAL");
    qp.set("lat", String(center[0]));
    qp.set("lng", String(center[1]));
    qp.set("rangeKm", String(MAX_RADIUS_KM));

    apiFetch<{ profiles: NearbyProfile[] }>(`/services?${qp.toString()}`)
      .then((res) => {
        if (myFetch !== fetchRef.current) return;
        setProfiles(res?.profiles || []);
      })
      .catch(() => {
        if (myFetch !== fetchRef.current) return;
        setFailed(true);
      })
      .finally(() => {
        if (myFetch === fetchRef.current) setLoading(false);
      });
  }, [visible, hasToken, center]);

  const nearby = useMemo(
    () =>
      profiles
        .filter((p) => p.profileType === "PROFESSIONAL")
        .filter((p) => matchesCategory(p, category) && matchesFilter(p, filter))
        .filter((p) => p.distance != null && Number.isFinite(p.distance) && p.distance <= radiusKm)
        .sort((a, b) => {
          const tierDiff = tierOrder(a.userLevel) - tierOrder(b.userLevel);
          if (tierDiff !== 0) return tierDiff;
          return (a.distance ?? 1e9) - (b.distance ?? 1e9);
        }),
    [profiles, category, filter, radiusKm],
  );

  const availableCount = useMemo(
    () => nearby.filter((p) => p.availableNow).length,
    [nearby],
  );

  const markers = useMemo(() => {
    const base = nearby
      .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .slice(0, 80)
      .map((p) => ({
        id: p.id,
        name: p.displayName || p.username,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        realLat: Number(p.realLatitude ?? p.latitude),
        realLng: Number(p.realLongitude ?? p.longitude),
        subtitle: p.serviceCategory || p.city || "Perfil",
        username: p.username,
        href: ownerHref(p),
        avatarUrl: p.avatarUrl,
        coverUrl: p.coverUrl,
        age: p.age ?? null,
        heightCm: p.heightCm ?? null,
        hairColor: p.hairColor ?? null,
        weightKg: p.weightKg ?? null,
        serviceValue: p.baseRate ?? null,
        level: p.userLevel ?? "SILVER",
        lastSeen: p.lastSeen ?? null,
        tier: p.availableNow ? "online" : "offline",
        galleryUrls: p.galleryUrls ?? [],
        areaRadiusM: 400,
      }));
    return spreadOverlapping(base);
  }, [nearby]);

  const handleMarkerSelect = useCallback(
    (marker: MapMarker) => {
      setFocusedId(marker.id);
      const match = profiles.find((p) => p.id === marker.id);
      if (match) setPreview(match);
    },
    [profiles],
  );

  const handleMarkerDeselect = useCallback(() => setFocusedId(null), []);

  /* Sin token de Mapbox no hay nada útil que mostrar: mejor omitir la sección
     que dejar un recuadro de error a la vista del cliente. */
  if (!hasToken) return null;

  let caption: string;
  if (failed) caption = "No pudimos cargar el mapa. Reintenta en unos segundos.";
  else if (loading && !profiles.length) caption = "Buscando perfiles…";
  else if (!hasLocation) caption = `disponibles ahora en Santiago`;
  else caption = `disponibles ahora a menos de ${radiusKm} km`;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-map-title"
      className="mt-[18px] grid overflow-hidden rounded-[14px] border border-sky-400/30 bg-[#0e1220] md:grid-cols-[minmax(0,1fr)_250px]"
    >
      <h2 id="home-map-title" className="sr-only">
        Quién está cerca ahora
      </h2>
      <div className="relative h-[420px] bg-[#10131f]">
        {visible ? (
          <MapboxMap
            userLocation={center}
            markers={markers}
            fill
            rangeKm={radiusKm}
            autoCenterOnDataChange
            showMarkersForArea={false}
            renderHtmlMarkers
            tieredMarkers
            focusMarkerId={focusedId}
            onMarkerSelect={handleMarkerSelect}
            onMarkerDeselect={handleMarkerDeselect}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/25">
            <MapPin className="mr-1.5 h-4 w-4" />
            Cargando mapa…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/[0.08] p-4 md:border-l md:border-t-0">
        <div className="text-[34px] font-extrabold leading-none tabular-nums">
          {failed ? "—" : availableCount}
          <small className="mt-1.5 block text-[12.5px] font-semibold leading-snug text-white/60">
            {caption}
          </small>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white/40">
            Radio
          </div>
          <div className="flex gap-1.5">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                aria-pressed={radiusKm === r}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                  radiusKm === r
                    ? "border-sky-400/60 bg-sky-400/[0.14] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {!hasLocation && (
          <button
            type="button"
            onClick={() => locationCtx?.useCurrentLocation()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Usar mi ubicación
          </button>
        )}

        <div className="grid gap-1.5 text-xs text-white/60">
          <span className="flex items-center gap-2">
            <i className="h-4 w-4 shrink-0 rounded-full bg-uzeed-700 shadow-[0_0_0_2px_#a5b4fc]" />
            Diamond: foto y nombre
          </span>
          <span className="flex items-center gap-2">
            <i className="ml-0.5 h-3 w-3 shrink-0 rounded-full bg-uzeed-700 shadow-[0_0_0_2px_#f5c451]" />
            Gold: foto
          </span>
          <span className="flex items-center gap-2">
            <i className="ml-1 h-2 w-2 shrink-0 rounded-full bg-fuchsia-500" />
            Silver: punto
          </span>
        </div>

        <Link
          href="/cerca"
          className="mt-auto rounded-[9px] bg-sky-400 px-3 py-[9px] text-center text-[13px] font-extrabold text-[#04121c] transition hover:bg-sky-300"
        >
          Abrir mapa completo
        </Link>
      </div>

      {preview && (
        <ProfilePreviewModal profile={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
