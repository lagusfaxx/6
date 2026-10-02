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
  // Plaza de Armas: "escort santiago centro" busca el centro, no la ciudad.
  { slug: "santiago-centro", name: "Santiago Centro", lat: -33.4378, lng: -70.6505, region: "Región Metropolitana" },
  { slug: "providencia", name: "Providencia", lat: -33.43, lng: -70.61, region: "Región Metropolitana" },
  { slug: "las-condes", name: "Las Condes", lat: -33.41, lng: -70.57, region: "Región Metropolitana" },
  { slug: "nunoa", name: "Ñuñoa", lat: -33.46, lng: -70.6, region: "Región Metropolitana" },
  { slug: "maipu", name: "Maipú", lat: -33.51, lng: -70.76, region: "Región Metropolitana" },
  { slug: "puente-alto", name: "Puente Alto", lat: -33.61, lng: -70.57, region: "Región Metropolitana" },
  { slug: "san-bernardo", name: "San Bernardo", lat: -33.59, lng: -70.7, region: "Región Metropolitana" },
  // Comunas y ciudades que faltaban según Semrush (oct 2026): "escort san
  // antonio" 9,9k, "putas coquimbo" 6,6k, "escort en santa cruz" 6,6k,
  // "escort san fernando" 4,4k, "escort la florida" 4,4k, "escort chiloe" 2,9k…
  { slug: "la-florida", name: "La Florida", lat: -33.52, lng: -70.6, region: "Región Metropolitana" },
  { slug: "estacion-central", name: "Estación Central", lat: -33.46, lng: -70.69, region: "Región Metropolitana" },
  { slug: "la-cisterna", name: "La Cisterna", lat: -33.53, lng: -70.66, region: "Región Metropolitana" },
  { slug: "san-antonio", name: "San Antonio", lat: -33.59, lng: -71.61, region: "Valparaíso" },
  { slug: "coquimbo", name: "Coquimbo", lat: -29.95, lng: -71.34, region: "Coquimbo" },
  { slug: "ovalle", name: "Ovalle", lat: -30.6, lng: -71.2, region: "Coquimbo" },
  { slug: "san-fernando", name: "San Fernando", lat: -34.59, lng: -70.99, region: "O'Higgins" },
  { slug: "santa-cruz", name: "Santa Cruz", lat: -34.64, lng: -71.37, region: "O'Higgins" },
  { slug: "linares", name: "Linares", lat: -35.85, lng: -71.59, region: "Maule" },
  { slug: "valdivia", name: "Valdivia", lat: -39.81, lng: -73.25, region: "Los Ríos" },
  { slug: "chiloe", name: "Chiloé", lat: -42.48, lng: -73.76, region: "Los Lagos" },
  // Segunda tanda (Semrush oct 2026): todas las comunas con búsquedas en el export.
  { slug: "talagante", name: "Talagante", lat: -33.66, lng: -70.93, region: "Región Metropolitana" },
  { slug: "san-miguel", name: "San Miguel", lat: -33.5, lng: -70.65, region: "Región Metropolitana" },
  { slug: "macul", name: "Macul", lat: -33.49, lng: -70.6, region: "Región Metropolitana" },
  { slug: "lo-prado", name: "Lo Prado", lat: -33.44, lng: -70.72, region: "Región Metropolitana" },
  { slug: "penalolen", name: "Peñalolén", lat: -33.48, lng: -70.55, region: "Región Metropolitana" },
  { slug: "quinta-normal", name: "Quinta Normal", lat: -33.43, lng: -70.7, region: "Región Metropolitana" },
  { slug: "renca", name: "Renca", lat: -33.4, lng: -70.73, region: "Región Metropolitana" },
  { slug: "san-ramon", name: "San Ramón", lat: -33.54, lng: -70.64, region: "Región Metropolitana" },
  { slug: "colina", name: "Colina", lat: -33.2, lng: -70.67, region: "Región Metropolitana" },
  { slug: "san-felipe", name: "San Felipe", lat: -32.75, lng: -70.72, region: "Valparaíso" },
  { slug: "quillota", name: "Quillota", lat: -32.88, lng: -71.25, region: "Valparaíso" },
  { slug: "illapel", name: "Illapel", lat: -31.63, lng: -71.17, region: "Coquimbo" },
  { slug: "villarrica", name: "Villarrica", lat: -39.28, lng: -72.23, region: "La Araucanía" },
  { slug: "talcahuano", name: "Talcahuano", lat: -36.72, lng: -73.12, region: "Biobío" },
  { slug: "chiguayante", name: "Chiguayante", lat: -36.92, lng: -73.03, region: "Biobío" },
  { slug: "concon", name: "Concón", lat: -32.93, lng: -71.52, region: "Valparaíso" },
  { slug: "puerto-varas", name: "Puerto Varas", lat: -41.32, lng: -72.98, region: "Los Lagos" },
  { slug: "san-carlos", name: "San Carlos", lat: -36.42, lng: -71.96, region: "Ñuble" },
  { slug: "san-javier", name: "San Javier", lat: -35.6, lng: -71.73, region: "Maule" },
];

const CITY_BY_SLUG = new Map(CITY_LANDINGS.map((c) => [c.slug, c]));

export function getCity(slug: string): CityGeo | undefined {
  return CITY_BY_SLUG.get(slug.toLowerCase());
}

export function isCitySlug(slug: string): boolean {
  return CITY_BY_SLUG.has(slug.toLowerCase());
}
