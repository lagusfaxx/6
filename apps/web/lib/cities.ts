/**
 * Fuente única de ciudades/comunas para landing pages geo-segmentadas.
 * Usada por la ruta /escorts/[tag] (para renderizar la landing de ciudad con
 * canonical propio y resultados filtrados) y por el sitemap (para emitir URLs
 * limpias /escorts/{slug} en lugar de parámetros ?city= que Google trata como
 * duplicados de /escorts).
 */
export type CityGeo = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** Región, para el texto SEO de la landing. */
  region?: string;
};

export const CITY_LANDINGS: CityGeo[] = [
  { slug: "santiago", name: "Santiago", lat: -33.45, lng: -70.66, region: "Región Metropolitana" },
  { slug: "vina-del-mar", name: "Viña del Mar", lat: -33.02, lng: -71.55, region: "Valparaíso" },
  { slug: "valparaiso", name: "Valparaíso", lat: -33.05, lng: -71.62, region: "Valparaíso" },
  { slug: "concepcion", name: "Concepción", lat: -36.83, lng: -73.05, region: "Biobío" },
  { slug: "antofagasta", name: "Antofagasta", lat: -23.65, lng: -70.4, region: "Antofagasta" },
  { slug: "temuco", name: "Temuco", lat: -38.74, lng: -72.6, region: "La Araucanía" },
  { slug: "rancagua", name: "Rancagua", lat: -34.17, lng: -70.74, region: "O'Higgins" },
  { slug: "la-serena", name: "La Serena", lat: -29.91, lng: -71.25, region: "Coquimbo" },
  { slug: "arica", name: "Arica", lat: -18.47, lng: -70.31, region: "Arica y Parinacota" },
  { slug: "iquique", name: "Iquique", lat: -20.21, lng: -70.15, region: "Tarapacá" },
  { slug: "puerto-montt", name: "Puerto Montt", lat: -41.47, lng: -72.94, region: "Los Lagos" },
  { slug: "talca", name: "Talca", lat: -35.43, lng: -71.66, region: "Maule" },
  { slug: "chillan", name: "Chillán", lat: -36.61, lng: -72.1, region: "Ñuble" },
  { slug: "osorno", name: "Osorno", lat: -40.57, lng: -73.14, region: "Los Lagos" },
  { slug: "punta-arenas", name: "Punta Arenas", lat: -53.16, lng: -70.91, region: "Magallanes" },
  { slug: "copiapo", name: "Copiapó", lat: -27.37, lng: -70.33, region: "Atacama" },
  { slug: "calama", name: "Calama", lat: -22.46, lng: -68.93, region: "Antofagasta" },
  { slug: "los-angeles", name: "Los Ángeles", lat: -37.47, lng: -72.35, region: "Biobío" },
  { slug: "curico", name: "Curicó", lat: -34.98, lng: -71.24, region: "Maule" },
  { slug: "providencia", name: "Providencia", lat: -33.43, lng: -70.61, region: "Región Metropolitana" },
  { slug: "las-condes", name: "Las Condes", lat: -33.41, lng: -70.57, region: "Región Metropolitana" },
  { slug: "nunoa", name: "Ñuñoa", lat: -33.46, lng: -70.6, region: "Región Metropolitana" },
  { slug: "maipu", name: "Maipú", lat: -33.51, lng: -70.76, region: "Región Metropolitana" },
  { slug: "puente-alto", name: "Puente Alto", lat: -33.61, lng: -70.57, region: "Región Metropolitana" },
  { slug: "san-bernardo", name: "San Bernardo", lat: -33.59, lng: -70.7, region: "Región Metropolitana" },
];

const CITY_BY_SLUG = new Map(CITY_LANDINGS.map((c) => [c.slug, c]));

export function getCity(slug: string): CityGeo | undefined {
  return CITY_BY_SLUG.get(slug.toLowerCase());
}

export function isCitySlug(slug: string): boolean {
  return CITY_BY_SLUG.has(slug.toLowerCase());
}
