export type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: number[];
  bbox?: number[];
  context?: Array<{ id?: string; text?: string }>;
};

const COMMUNE_LEVEL_TYPES = new Set([
  "place",
  "locality",
  "neighborhood",
  "district",
]);

export function isCommuneLevelFeature(
  feature: MapboxFeature | null | undefined,
): boolean {
  if (!feature) return false;
  const types = Array.isArray(feature.place_type) ? feature.place_type : [];
  if (types.length === 0) return false;
  return types.every((t) => COMMUNE_LEVEL_TYPES.has(String(t)));
}

export function extractCityFromFeature(
  feature: MapboxFeature | null | undefined,
): string | null {
  if (!feature) return null;
  if (isCommuneLevelFeature(feature) && feature.text) {
    const text = String(feature.text).trim();
    if (text) return text;
  }
  const context = Array.isArray(feature.context) ? feature.context : [];
  const findByIdPrefix = (prefix: string) =>
    context.find((c) => String(c?.id || "").startsWith(prefix))?.text;
  const candidate =
    findByIdPrefix("place.") ||
    findByIdPrefix("locality.") ||
    findByIdPrefix("neighborhood.") ||
    findByIdPrefix("district.");
  const trimmed = candidate ? String(candidate).trim() : "";
  return trimmed || null;
}

export function jitterWithinBbox(
  bbox: number[] | undefined | null,
  center: number[],
  fraction = 0.6,
): [number, number] | null {
  if (!Array.isArray(center) || center.length < 2) return null;
  const centerLng = Number(center[0]);
  const centerLat = Number(center[1]);
  if (!Number.isFinite(centerLng) || !Number.isFinite(centerLat)) return null;
  if (!Array.isArray(bbox) || bbox.length < 4) return [centerLng, centerLat];
  const minLng = Number(bbox[0]);
  const minLat = Number(bbox[1]);
  const maxLng = Number(bbox[2]);
  const maxLat = Number(bbox[3]);
  if (
    ![minLng, minLat, maxLng, maxLat].every((n) => Number.isFinite(n)) ||
    maxLng <= minLng ||
    maxLat <= minLat
  ) {
    return [centerLng, centerLat];
  }
  const halfSpanLng = ((maxLng - minLng) * fraction) / 2;
  const halfSpanLat = ((maxLat - minLat) * fraction) / 2;
  const rndLng = centerLng + (Math.random() * 2 - 1) * halfSpanLng;
  const rndLat = centerLat + (Math.random() * 2 - 1) * halfSpanLat;
  return [
    Math.max(minLng, Math.min(maxLng, rndLng)),
    Math.max(minLat, Math.min(maxLat, rndLat)),
  ];
}

export function extractMapboxLocation(
  feature: MapboxFeature | null | undefined,
): {
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isCommuneLevel: boolean;
} {
  if (
    !feature ||
    !Array.isArray(feature.center) ||
    feature.center.length < 2
  ) {
    return {
      city: null,
      latitude: null,
      longitude: null,
      isCommuneLevel: false,
    };
  }
  const isCommune = isCommuneLevelFeature(feature);
  const city = extractCityFromFeature(feature);
  let coords: [number, number] = [
    Number(feature.center[0]),
    Number(feature.center[1]),
  ];
  if (isCommune) {
    const jittered = jitterWithinBbox(feature.bbox, feature.center);
    if (jittered) coords = jittered;
  }
  return {
    city,
    latitude: coords[1],
    longitude: coords[0],
    isCommuneLevel: isCommune,
  };
}

export function extractCommuneFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const first = String(address).split(",")[0]?.trim();
  if (!first) return null;
  if (/^\d+\s/.test(first) || /\s\d+$/.test(first) || /\d{3,}/.test(first)) {
    return null;
  }
  return first;
}
