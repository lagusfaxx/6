/**
 * Comunas y ciudades del directorio de moteles. Cada una tiene su landing
 * indexable (/moteles/{slug}) para búsquedas como "moteles en Providencia".
 *
 * "santiago" es el Gran Santiago (toda la Región Metropolitana), que es lo que
 * busca quien escribe "moteles en Santiago"; la comuna de Santiago va como
 * "santiago-centro". Las coordenadas son el centro aproximado: sirven para
 * ordenar por cercanía y para ubicar un motel cuya comuna viene vacía o mal
 * escrita.
 */
export type Comuna = {
  slug: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  /** Radio que cubre la landing. El Gran Santiago cubre toda la RM. */
  radiusKm?: number;
  /** Ciudad que agrupa varias comunas (sólo "santiago"). */
  isMetro?: boolean;
};

const RM = "Región Metropolitana";

export const COMUNAS: Comuna[] = [
  { slug: "santiago", name: "Santiago", region: RM, lat: -33.4489, lng: -70.6693, radiusKm: 45, isMetro: true },
  { slug: "santiago-centro", name: "Santiago Centro", region: RM, lat: -33.4450, lng: -70.6530 },
  { slug: "providencia", name: "Providencia", region: RM, lat: -33.4310, lng: -70.6100 },
  { slug: "las-condes", name: "Las Condes", region: RM, lat: -33.4080, lng: -70.5670 },
  { slug: "nunoa", name: "Ñuñoa", region: RM, lat: -33.4540, lng: -70.6040 },
  { slug: "vitacura", name: "Vitacura", region: RM, lat: -33.3900, lng: -70.5720 },
  { slug: "lo-barnechea", name: "Lo Barnechea", region: RM, lat: -33.3500, lng: -70.5170 },
  { slug: "la-reina", name: "La Reina", region: RM, lat: -33.4450, lng: -70.5350 },
  { slug: "penalolen", name: "Peñalolén", region: RM, lat: -33.4860, lng: -70.5450 },
  { slug: "macul", name: "Macul", region: RM, lat: -33.4880, lng: -70.5990 },
  { slug: "la-florida", name: "La Florida", region: RM, lat: -33.5220, lng: -70.5980 },
  { slug: "puente-alto", name: "Puente Alto", region: RM, lat: -33.6110, lng: -70.5760 },
  { slug: "san-miguel", name: "San Miguel", region: RM, lat: -33.4970, lng: -70.6510 },
  { slug: "san-joaquin", name: "San Joaquín", region: RM, lat: -33.4960, lng: -70.6280 },
  { slug: "la-cisterna", name: "La Cisterna", region: RM, lat: -33.5300, lng: -70.6640 },
  { slug: "la-granja", name: "La Granja", region: RM, lat: -33.5360, lng: -70.6230 },
  { slug: "san-ramon", name: "San Ramón", region: RM, lat: -33.5370, lng: -70.6420 },
  { slug: "el-bosque", name: "El Bosque", region: RM, lat: -33.5620, lng: -70.6760 },
  { slug: "la-pintana", name: "La Pintana", region: RM, lat: -33.5830, lng: -70.6320 },
  { slug: "lo-espejo", name: "Lo Espejo", region: RM, lat: -33.5210, lng: -70.6920 },
  { slug: "pedro-aguirre-cerda", name: "Pedro Aguirre Cerda", region: RM, lat: -33.4930, lng: -70.6760 },
  { slug: "san-bernardo", name: "San Bernardo", region: RM, lat: -33.5920, lng: -70.6990 },
  { slug: "estacion-central", name: "Estación Central", region: RM, lat: -33.4600, lng: -70.7000 },
  { slug: "cerrillos", name: "Cerrillos", region: RM, lat: -33.4989, lng: -70.7160 },
  { slug: "maipu", name: "Maipú", region: RM, lat: -33.5110, lng: -70.7580 },
  { slug: "pudahuel", name: "Pudahuel", region: RM, lat: -33.4400, lng: -70.7640 },
  { slug: "lo-prado", name: "Lo Prado", region: RM, lat: -33.4440, lng: -70.7250 },
  { slug: "quinta-normal", name: "Quinta Normal", region: RM, lat: -33.4280, lng: -70.6970 },
  { slug: "cerro-navia", name: "Cerro Navia", region: RM, lat: -33.4227, lng: -70.7350 },
  { slug: "renca", name: "Renca", region: RM, lat: -33.4040, lng: -70.7280 },
  { slug: "independencia", name: "Independencia", region: RM, lat: -33.4160, lng: -70.6650 },
  { slug: "recoleta", name: "Recoleta", region: RM, lat: -33.4060, lng: -70.6400 },
  { slug: "conchali", name: "Conchalí", region: RM, lat: -33.3830, lng: -70.6750 },
  { slug: "huechuraba", name: "Huechuraba", region: RM, lat: -33.3670, lng: -70.6330 },
  { slug: "quilicura", name: "Quilicura", region: RM, lat: -33.3600, lng: -70.7300 },
  { slug: "colina", name: "Colina", region: RM, lat: -33.2000, lng: -70.6750 },
  { slug: "lampa", name: "Lampa", region: RM, lat: -33.2860, lng: -70.8760 },
  { slug: "padre-hurtado", name: "Padre Hurtado", region: RM, lat: -33.5720, lng: -70.8150 },
  { slug: "penaflor", name: "Peñaflor", region: RM, lat: -33.6060, lng: -70.8760 },
  { slug: "talagante", name: "Talagante", region: RM, lat: -33.6650, lng: -70.9270 },
  { slug: "buin", name: "Buin", region: RM, lat: -33.7320, lng: -70.7420 },
  { slug: "melipilla", name: "Melipilla", region: RM, lat: -33.6890, lng: -71.2150 },
  { slug: "vina-del-mar", name: "Viña del Mar", region: "Valparaíso", lat: -33.0245, lng: -71.5518 },
  { slug: "valparaiso", name: "Valparaíso", region: "Valparaíso", lat: -33.0472, lng: -71.6127 },
  { slug: "quilpue", name: "Quilpué", region: "Valparaíso", lat: -33.0480, lng: -71.4420 },
  { slug: "villa-alemana", name: "Villa Alemana", region: "Valparaíso", lat: -33.0420, lng: -71.3730 },
  { slug: "concon", name: "Concón", region: "Valparaíso", lat: -32.9300, lng: -71.5190 },
  { slug: "san-antonio", name: "San Antonio", region: "Valparaíso", lat: -33.5930, lng: -71.6210 },
  { slug: "rancagua", name: "Rancagua", region: "O'Higgins", lat: -34.1700, lng: -70.7400 },
  { slug: "curico", name: "Curicó", region: "Maule", lat: -34.9830, lng: -71.2390 },
  { slug: "talca", name: "Talca", region: "Maule", lat: -35.4260, lng: -71.6550 },
  { slug: "chillan", name: "Chillán", region: "Ñuble", lat: -36.6060, lng: -72.1030 },
  { slug: "concepcion", name: "Concepción", region: "Biobío", lat: -36.8270, lng: -73.0500 },
  { slug: "talcahuano", name: "Talcahuano", region: "Biobío", lat: -36.7250, lng: -73.1160 },
  { slug: "los-angeles", name: "Los Ángeles", region: "Biobío", lat: -37.4690, lng: -72.3540 },
  { slug: "temuco", name: "Temuco", region: "La Araucanía", lat: -38.7390, lng: -72.5980 },
  { slug: "valdivia", name: "Valdivia", region: "Los Ríos", lat: -39.8140, lng: -73.2460 },
  { slug: "osorno", name: "Osorno", region: "Los Lagos", lat: -40.5740, lng: -73.1360 },
  { slug: "puerto-montt", name: "Puerto Montt", region: "Los Lagos", lat: -41.4690, lng: -72.9420 },
  { slug: "punta-arenas", name: "Punta Arenas", region: "Magallanes", lat: -53.1630, lng: -70.9170 },
  { slug: "la-serena", name: "La Serena", region: "Coquimbo", lat: -29.9040, lng: -71.2490 },
  { slug: "coquimbo", name: "Coquimbo", region: "Coquimbo", lat: -29.9530, lng: -71.3430 },
  { slug: "copiapo", name: "Copiapó", region: "Atacama", lat: -27.3670, lng: -70.3320 },
  { slug: "antofagasta", name: "Antofagasta", region: "Antofagasta", lat: -23.6500, lng: -70.4000 },
  { slug: "calama", name: "Calama", region: "Antofagasta", lat: -22.4560, lng: -68.9290 },
  { slug: "iquique", name: "Iquique", region: "Tarapacá", lat: -20.2140, lng: -70.1520 },
  { slug: "arica", name: "Arica", region: "Arica y Parinacota", lat: -18.4780, lng: -70.3120 },
];

/** Comunas elegibles como ubicación de un local (sin el "Gran Santiago"). */
export const SELECTABLE_COMUNAS = COMUNAS.filter((c) => !c.isMetro);

const BY_SLUG = new Map(COMUNAS.map((c) => [c.slug, c]));

export function normalizePlace(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, Comuna>();
for (const c of SELECTABLE_COMUNAS) BY_NAME.set(normalizePlace(c.name), c);
/* "Santiago" escrito a secas en una dirección es la comuna de Santiago. */
BY_NAME.set("santiago", BY_SLUG.get("santiago-centro")!);

export function getComuna(slug: string): Comuna | undefined {
  return BY_SLUG.get(String(slug || "").toLowerCase());
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestComuna(lat: number, lng: number, maxKm = 12): Comuna | undefined {
  let best: Comuna | undefined;
  let bestKm = Infinity;
  for (const c of SELECTABLE_COMUNAS) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d < bestKm) {
      best = c;
      bestKm = d;
    }
  }
  return bestKm <= maxKm ? best : undefined;
}

/**
 * Comuna de un local: primero el texto que cargó (si es una comuna conocida),
 * después la más cercana a sus coordenadas.
 */
export function resolveComuna(city?: string | null, lat?: number | null, lng?: number | null): Comuna | undefined {
  const byText = BY_NAME.get(normalizePlace(city));
  if (byText) return byText;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return nearestComuna(lat, lng);
  return undefined;
}

export function isInMetro(lat?: number | null, lng?: number | null) {
  const metro = BY_SLUG.get("santiago")!;
  if (lat == null || lng == null) return false;
  return distanceKm(lat, lng, metro.lat, metro.lng) <= (metro.radiusKm || 45);
}
