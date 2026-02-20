import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

export const locationRouter = Router();

/**
 * Reverse geocode lat/lng to city/region using a lightweight approach.
 * For MVP, uses a known cities lookup. In production, replace with Mapbox
 * Geocoding API call.
 */
const KNOWN_CITIES: Array<{
  name: string;
  region: string;
  lat: number;
  lng: number;
}> = [
  { name: "Santiago", region: "Región Metropolitana", lat: -33.4489, lng: -70.6693 },
  { name: "Valparaíso", region: "Valparaíso", lat: -33.0472, lng: -71.6127 },
  { name: "Viña del Mar", region: "Valparaíso", lat: -33.0153, lng: -71.5504 },
  { name: "Concepción", region: "Biobío", lat: -36.827, lng: -73.0503 },
  { name: "La Serena", region: "Coquimbo", lat: -29.9027, lng: -71.2519 },
  { name: "Antofagasta", region: "Antofagasta", lat: -23.6509, lng: -70.3975 },
  { name: "Temuco", region: "La Araucanía", lat: -38.7359, lng: -72.5904 },
  { name: "Rancagua", region: "O'Higgins", lat: -34.1708, lng: -70.7444 },
  { name: "Iquique", region: "Tarapacá", lat: -20.2141, lng: -70.1524 },
  { name: "Puerto Montt", region: "Los Lagos", lat: -41.4693, lng: -72.9424 },
  { name: "Talca", region: "Maule", lat: -35.4264, lng: -71.6554 },
  { name: "Arica", region: "Arica y Parinacota", lat: -18.4783, lng: -70.3126 },
  { name: "Coquimbo", region: "Coquimbo", lat: -29.9533, lng: -71.3395 },
  { name: "Chillán", region: "Ñuble", lat: -36.6066, lng: -72.1034 },
  { name: "Osorno", region: "Los Lagos", lat: -40.5739, lng: -73.1351 },
  { name: "Calama", region: "Antofagasta", lat: -22.4560, lng: -68.9293 },
  { name: "Punta Arenas", region: "Magallanes", lat: -53.1638, lng: -70.9171 },
  { name: "Copiapó", region: "Atacama", lat: -27.3668, lng: -70.3323 },
  { name: "Valdivia", region: "Los Ríos", lat: -39.8196, lng: -73.2452 },
  { name: "Los Ángeles", region: "Biobío", lat: -37.4693, lng: -72.3527 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Max distance (km) to assign a known city via reverse geocoding */
const MAX_CITY_DISTANCE_KM = 100;
const DEFAULT_COUNTRY_NAME = "Chile";

function reverseGeocodeLocal(
  lat: number,
  lng: number,
): { city: string; region: string } {
  let nearest = KNOWN_CITIES[0];
  let minDist = Infinity;
  for (const city of KNOWN_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < minDist) {
      minDist = d;
      nearest = city;
    }
  }
  if (minDist > MAX_CITY_DISTANCE_KM) {
    return { city: DEFAULT_COUNTRY_NAME, region: "" };
  }
  return { city: nearest.name, region: nearest.region };
}

/**
 * PATCH /professionals/:id/location
 * Updates a professional's lat/lng and derives city/region via reverse geocoding.
 */
locationRouter.patch(
  "/professionals/:id/location",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId || userId !== id) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "INVALID_COORDINATES" });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "COORDINATES_OUT_OF_RANGE" });
    }

    const geo = reverseGeocodeLocal(lat, lng);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        latitude: lat,
        longitude: lng,
        city: geo.city,
        regionName: geo.region,
        locationUpdatedAt: new Date(),
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        city: true,
        regionName: true,
        locationUpdatedAt: true,
      },
    });

    return res.json({ professional: updated });
  }),
);

/**
 * GET /cities/with_supply
 * Returns cities that have active professionals, grouped by city name.
 */
locationRouter.get(
  "/cities/with_supply",
  asyncHandler(async (_req, res) => {
    const now = new Date();

    // Group professionals by city
    const cityGroups = await prisma.user.groupBy({
      by: ["city"],
      where: {
        profileType: "PROFESSIONAL",
        isActive: true,
        city: { not: null },
        OR: [
          { membershipExpiresAt: { gt: now } },
          { membershipExpiresAt: null },
        ],
      },
      _count: { id: true },
    });

    const cities = cityGroups
      .filter((g) => g.city)
      .map((g) => {
        const known = KNOWN_CITIES.find(
          (c) =>
            c.name.toLowerCase() === (g.city || "").toLowerCase(),
        );
        return {
          cityName: g.city,
          count: g._count.id,
          centerLat: known?.lat || null,
          centerLng: known?.lng || null,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Fallback: if no data, return popular cities
    if (cities.length === 0) {
      return res.json({
        cities: KNOWN_CITIES.slice(0, 12).map((c) => ({
          cityName: c.name,
          count: 0,
          centerLat: c.lat,
          centerLng: c.lng,
        })),
        source: "fallback",
      });
    }

    return res.json({ cities, source: "database" });
  }),
);
