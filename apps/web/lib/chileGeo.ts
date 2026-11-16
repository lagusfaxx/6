/**
 * Geografía completa de Chile para las landings SEO: las 16 regiones, sus
 * provincias y las 346 comunas, cada una con coordenadas del pueblo o ciudad
 * cabecera.
 *
 * Es la fuente de /escorts/{comuna}, /escorts/region-{region} y de las
 * landings de moteles por comuna (lib/comunas.ts), y del contenido propio de
 * cada página (lib/geoSeo.ts): comunas vecinas, distancia a la capital
 * regional, provincia, etc.
 *
 * Coordenadas: Wikidata (cabecera comunal), corregidas con las de
 * lib/comunas.ts y lib/cities.ts donde ya existían. La comuna de Santiago va
 * con slug "santiago-centro": "santiago" es el Gran Santiago.
 */

export type ChileRegion = {
  /** Clave interna (comunas.region). */
  key: string;
  /** Ruta de la landing: /escorts/{slug}. */
  slug: string;
  /** Nombre corto, el mismo que usan lib/comunas.ts y lib/cities.ts. */
  name: string;
  /** "Región del Biobío", "Región Metropolitana": para títulos y textos. */
  label: string;
  /** Nombre oficial. */
  fullName: string;
  numeral: string;
  /** Slug de la comuna capital regional. */
  capital: string;
  /** Texto propio de la región (2-3 frases). */
  intro: string;
};

export type ChileComuna = {
  slug: string;
  name: string;
  /** ChileRegion.key */
  region: string;
  province: string;
  lat: number;
  lng: number;
};

export const CHILE_REGIONS: ChileRegion[] = [
  {
    key: "arica-y-parinacota",
    label: "Región de Arica y Parinacota",
    slug: "region-arica-y-parinacota",
    name: "Arica y Parinacota",
    fullName: "Región de Arica y Parinacota",
    numeral: "XV",
    capital: "arica",
    intro:
      "La región más al norte de Chile, en la frontera con Perú y Bolivia. Casi toda su población vive en Arica, la ciudad de la eterna primavera, donde se concentran los perfiles; Putre y el altiplano reciben sobre todo turismo.",
  },
  {
    key: "tarapaca",
    label: "Región de Tarapacá",
    slug: "region-tarapaca",
    name: "Tarapacá",
    fullName: "Región de Tarapacá",
    numeral: "I",
    capital: "iquique",
    intro:
      "Iquique y Alto Hospicio reúnen a casi toda la gente de Tarapacá: la Zona Franca, los turnos mineros y el puerto mueven la ciudad todo el año. Pozo Almonte, Pica y Huara quedan en la pampa del Tamarugal, a una hora o más de la costa.",
  },
  {
    key: "antofagasta",
    label: "Región de Antofagasta",
    slug: "region-antofagasta",
    name: "Antofagasta",
    fullName: "Región de Antofagasta",
    numeral: "II",
    capital: "antofagasta",
    intro:
      "La región minera de Chile. Antofagasta y Calama son las dos ciudades con más perfiles, con mucha demanda de trabajadores en turno; Tocopilla, Mejillones, Taltal y San Pedro de Atacama tienen menos oferta y conviene mirar también las ciudades cercanas.",
  },
  {
    key: "atacama",
    label: "Región de Atacama",
    slug: "region-atacama",
    name: "Atacama",
    fullName: "Región de Atacama",
    numeral: "III",
    capital: "copiapo",
    intro:
      "Copiapó, la capital, concentra la mayor parte de los perfiles de Atacama, seguida por Vallenar. Caldera, Chañaral y Diego de Almagro son ciudades chicas: muchas escorts de Copiapó viajan o atienden por videollamada.",
  },
  {
    key: "coquimbo",
    label: "Región de Coquimbo",
    slug: "region-coquimbo",
    name: "Coquimbo",
    fullName: "Región de Coquimbo",
    numeral: "IV",
    capital: "la-serena",
    intro:
      "La Serena y Coquimbo forman una sola conurbación y son el centro de la región, con más movimiento en verano. Ovalle es la tercera ciudad; en el Elqui, Limarí y Choapa (Vicuña, Illapel, Los Vilos) la oferta es más chica.",
  },
  {
    key: "valparaiso",
    label: "Región de Valparaíso",
    slug: "region-valparaiso",
    name: "Valparaíso",
    fullName: "Región de Valparaíso",
    numeral: "V",
    capital: "valparaiso",
    intro:
      "El Gran Valparaíso (Viña del Mar, Valparaíso, Concón, Quilpué y Villa Alemana) es la segunda área urbana más grande de Chile y donde se concentra la oferta de la región. Le siguen San Antonio, Quillota, San Felipe y Los Andes, y en verano el litoral central suma mucha demanda.",
  },
  {
    key: "metropolitana",
    label: "Región Metropolitana",
    slug: "region-metropolitana",
    name: "Región Metropolitana",
    fullName: "Región Metropolitana de Santiago",
    numeral: "RM",
    capital: "santiago-centro",
    intro:
      "La región más poblada y con más perfiles publicados del país. Santiago Centro, Providencia y Las Condes concentran la mayor parte de los perfiles, pero hay oferta en casi todas las comunas del Gran Santiago y en ciudades como Puente Alto, San Bernardo, Colina, Talagante, Buin y Melipilla.",
  },
  {
    key: "ohiggins",
    label: "Región de O'Higgins",
    slug: "region-ohiggins",
    name: "O'Higgins",
    fullName: "Región del Libertador General Bernardo O'Higgins",
    numeral: "VI",
    capital: "rancagua",
    intro:
      "Rancagua y Machalí son el principal núcleo de la región, a una hora de Santiago. En Colchagua destacan San Fernando y Santa Cruz, y en la costa Pichilemu, que se llena en verano.",
  },
  {
    key: "maule",
    label: "Región del Maule",
    slug: "region-maule",
    name: "Maule",
    fullName: "Región del Maule",
    numeral: "VII",
    capital: "talca",
    intro:
      "Talca y Curicó son las dos ciudades grandes del Maule, seguidas por Linares, Constitución y Cauquenes. La Ruta 5 conecta todas las cabeceras, así que es común que una escort atienda en más de una ciudad de la región.",
  },
  {
    key: "nuble",
    label: "Región de Ñuble",
    slug: "region-nuble",
    name: "Ñuble",
    fullName: "Región de Ñuble",
    numeral: "XVI",
    capital: "chillan",
    intro:
      "La región más nueva de Chile (2018). Chillán y Chillán Viejo concentran casi toda la oferta; San Carlos, Bulnes y Quirihue son ciudades chicas a menos de una hora de la capital regional.",
  },
  {
    key: "biobio",
    label: "Región del Biobío",
    slug: "region-biobio",
    name: "Biobío",
    fullName: "Región del Biobío",
    numeral: "VIII",
    capital: "concepcion",
    intro:
      "El Gran Concepción (Concepción, Talcahuano, San Pedro de la Paz, Chiguayante, Hualpén, Coronel) es una de las tres áreas urbanas más grandes de Chile. Los Ángeles es la otra ciudad grande de la región; en la provincia de Arauco la oferta es menor.",
  },
  {
    key: "araucania",
    label: "Región de La Araucanía",
    slug: "region-araucania",
    name: "La Araucanía",
    fullName: "Región de La Araucanía",
    numeral: "IX",
    capital: "temuco",
    intro:
      "Temuco y Padre Las Casas reúnen la mayor parte de los perfiles de La Araucanía. Angol, Victoria y Villarrica le siguen, y Pucón suma demanda en temporada de turismo.",
  },
  {
    key: "los-rios",
    label: "Región de Los Ríos",
    slug: "region-los-rios",
    name: "Los Ríos",
    fullName: "Región de Los Ríos",
    numeral: "XIV",
    capital: "valdivia",
    intro:
      "Valdivia, ciudad universitaria y de río, concentra casi toda la oferta de la región. La Unión, Río Bueno y Panguipulli son las otras ciudades con más habitantes.",
  },
  {
    key: "los-lagos",
    label: "Región de Los Lagos",
    slug: "region-los-lagos",
    name: "Los Lagos",
    fullName: "Región de Los Lagos",
    numeral: "X",
    capital: "puerto-montt",
    intro:
      "Puerto Montt y Osorno son las ciudades con más perfiles, seguidas por Puerto Varas. En Chiloé la oferta está en Castro y Ancud, y la provincia de Palena es la zona más aislada.",
  },
  {
    key: "aysen",
    label: "Región de Aysén",
    slug: "region-aysen",
    name: "Aysén",
    fullName: "Región de Aysén del General Carlos Ibáñez del Campo",
    numeral: "XI",
    capital: "coyhaique",
    intro:
      "La región con menos habitantes de Chile. Coyhaique y Puerto Aysén concentran casi toda la población; el resto son pueblos pequeños a horas de distancia por la Carretera Austral.",
  },
  {
    key: "magallanes",
    label: "Región de Magallanes",
    slug: "region-magallanes",
    name: "Magallanes",
    fullName: "Región de Magallanes y de la Antártica Chilena",
    numeral: "XII",
    capital: "punta-arenas",
    intro:
      "Punta Arenas tiene casi toda la oferta de la región más austral de Chile. Puerto Natales es la segunda ciudad y recibe mucho turismo por Torres del Paine; Porvenir y Puerto Williams son localidades pequeñas.",
  },
];

/** [slug, nombre, región, provincia, lat, lng] */
type Row = [string, string, string, string, number, number];

const ROWS: Row[] = [
  // ── Arica y Parinacota ──
  ["arica", "Arica", "arica-y-parinacota", "Arica", -18.478, -70.312],
  ["camarones", "Camarones", "arica-y-parinacota", "Arica", -19.0167, -69.8667],
  ["putre", "Putre", "arica-y-parinacota", "Parinacota", -18.4287, -69.3116],
  ["general-lagos", "General Lagos", "arica-y-parinacota", "Parinacota", -17.5667, -69.5],
  // ── Tarapacá ──
  ["iquique", "Iquique", "tarapaca", "Iquique", -20.214, -70.152],
  ["alto-hospicio", "Alto Hospicio", "tarapaca", "Iquique", -20.25, -70.1167],
  ["pozo-almonte", "Pozo Almonte", "tarapaca", "Tamarugal", -20.7702, -69.5045],
  ["camina", "Camiña", "tarapaca", "Tamarugal", -19.3, -69.4167],
  ["colchane", "Colchane", "tarapaca", "Tamarugal", -19.2754, -68.6396],
  ["huara", "Huara", "tarapaca", "Tamarugal", -19.9667, -69.7667],
  ["pica", "Pica", "tarapaca", "Tamarugal", -20.5, -69.3333],
  // ── Antofagasta ──
  ["antofagasta", "Antofagasta", "antofagasta", "Antofagasta", -23.65, -70.4],
  ["mejillones", "Mejillones", "antofagasta", "Antofagasta", -23.1, -70.45],
  ["sierra-gorda", "Sierra Gorda", "antofagasta", "Antofagasta", -22.8833, -69.3167],
  ["taltal", "Taltal", "antofagasta", "Antofagasta", -25.4333, -70.4667],
  ["calama", "Calama", "antofagasta", "El Loa", -22.456, -68.929],
  ["ollague", "Ollagüe", "antofagasta", "El Loa", -21.4566, -68.3134],
  ["san-pedro-de-atacama", "San Pedro de Atacama", "antofagasta", "El Loa", -22.9167, -68.2],
  ["tocopilla", "Tocopilla", "antofagasta", "Tocopilla", -22.002, -70.0146],
  ["maria-elena", "María Elena", "antofagasta", "Tocopilla", -22.35, -69.6667],
  // ── Atacama ──
  ["copiapo", "Copiapó", "atacama", "Copiapó", -27.367, -70.332],
  ["caldera", "Caldera", "atacama", "Copiapó", -27.0667, -70.8167],
  ["tierra-amarilla", "Tierra Amarilla", "atacama", "Copiapó", -27.4667, -70.2667],
  ["chanaral", "Chañaral", "atacama", "Chañaral", -26.3737, -70.3383],
  ["diego-de-almagro", "Diego de Almagro", "atacama", "Chañaral", -26.3667, -70.05],
  ["vallenar", "Vallenar", "atacama", "Huasco", -28.5948, -70.6025],
  ["alto-del-carmen", "Alto del Carmen", "atacama", "Huasco", -28.9336, -70.4623],
  ["freirina", "Freirina", "atacama", "Huasco", -28.5, -71.0667],
  ["huasco", "Huasco", "atacama", "Huasco", -28.45, -71.2167],
  // ── Coquimbo ──
  ["la-serena", "La Serena", "coquimbo", "Elqui", -29.904, -71.249],
  ["coquimbo", "Coquimbo", "coquimbo", "Elqui", -29.953, -71.343],
  ["andacollo", "Andacollo", "coquimbo", "Elqui", -30.2167, -71.0833],
  ["la-higuera", "La Higuera", "coquimbo", "Elqui", -29.5, -71.2667],
  ["paihuano", "Paihuano", "coquimbo", "Elqui", -30.0288, -70.5171],
  ["vicuna", "Vicuña", "coquimbo", "Elqui", -30.0167, -70.7],
  ["illapel", "Illapel", "coquimbo", "Choapa", -31.63, -71.17],
  ["canela", "Canela", "coquimbo", "Choapa", -31.4, -71.45],
  ["los-vilos", "Los Vilos", "coquimbo", "Choapa", -31.9, -71.5167],
  ["salamanca", "Salamanca", "coquimbo", "Choapa", -31.7667, -70.9667],
  ["ovalle", "Ovalle", "coquimbo", "Limarí", -30.6, -71.2],
  ["combarbala", "Combarbalá", "coquimbo", "Limarí", -31.1667, -71.05],
  ["monte-patria", "Monte Patria", "coquimbo", "Limarí", -30.6833, -70.9333],
  ["punitaqui", "Punitaqui", "coquimbo", "Limarí", -30.9, -71.2667],
  ["rio-hurtado", "Río Hurtado", "coquimbo", "Limarí", -30.2667, -70.7],
  // ── Valparaíso ──
  ["valparaiso", "Valparaíso", "valparaiso", "Valparaíso", -33.0472, -71.6127],
  ["casablanca", "Casablanca", "valparaiso", "Valparaíso", -33.3167, -71.4167],
  ["concon", "Concón", "valparaiso", "Valparaíso", -32.93, -71.519],
  ["juan-fernandez", "Juan Fernández", "valparaiso", "Valparaíso", -33.6167, -78.8667],
  ["puchuncavi", "Puchuncaví", "valparaiso", "Valparaíso", -32.7176, -71.4111],
  ["quintero", "Quintero", "valparaiso", "Valparaíso", -32.7833, -71.5333],
  ["vina-del-mar", "Viña del Mar", "valparaiso", "Valparaíso", -33.0245, -71.5518],
  ["isla-de-pascua", "Isla de Pascua", "valparaiso", "Isla de Pascua", -27.0833, -109.375],
  ["los-andes", "Los Andes", "valparaiso", "Los Andes", -32.9503, -70.2399],
  ["calle-larga", "Calle Larga", "valparaiso", "Los Andes", -32.85, -70.6333],
  ["rinconada", "Rinconada", "valparaiso", "Los Andes", -32.8333, -70.7],
  ["san-esteban", "San Esteban", "valparaiso", "Los Andes", -32.8, -70.5833],
  ["la-ligua", "La Ligua", "valparaiso", "Petorca", -32.3537, -71.2721],
  ["cabildo", "Cabildo", "valparaiso", "Petorca", -32.4267, -71.0664],
  ["papudo", "Papudo", "valparaiso", "Petorca", -32.5167, -71.45],
  ["petorca", "Petorca", "valparaiso", "Petorca", -32.25, -70.9333],
  ["zapallar", "Zapallar", "valparaiso", "Petorca", -32.59, -71.34],
  ["quillota", "Quillota", "valparaiso", "Quillota", -32.88, -71.25],
  ["la-calera", "La Calera", "valparaiso", "Quillota", -32.7833, -71.2167],
  ["hijuelas", "Hijuelas", "valparaiso", "Quillota", -32.8, -71.1667],
  ["la-cruz", "La Cruz", "valparaiso", "Quillota", -32.8167, -71.2333],
  ["nogales", "Nogales", "valparaiso", "Quillota", -32.7167, -71.2333],
  ["san-antonio", "San Antonio", "valparaiso", "San Antonio", -33.593, -71.621],
  ["algarrobo", "Algarrobo", "valparaiso", "San Antonio", -33.3693, -71.6681],
  ["cartagena", "Cartagena", "valparaiso", "San Antonio", -33.55, -71.6],
  ["el-quisco", "El Quisco", "valparaiso", "San Antonio", -33.4, -71.7],
  ["el-tabo", "El Tabo", "valparaiso", "San Antonio", -33.45, -71.6667],
  ["santo-domingo", "Santo Domingo", "valparaiso", "San Antonio", -33.6333, -71.65],
  ["san-felipe", "San Felipe", "valparaiso", "San Felipe de Aconcagua", -32.75, -70.72],
  ["catemu", "Catemu", "valparaiso", "San Felipe de Aconcagua", -32.6333, -71.0333],
  ["panquehue", "Panquehue", "valparaiso", "San Felipe de Aconcagua", -32.8, -70.8333],
  ["putaendo", "Putaendo", "valparaiso", "San Felipe de Aconcagua", -32.6333, -70.7333],
  ["santa-maria", "Santa María", "valparaiso", "San Felipe de Aconcagua", -32.75, -70.6667],
  ["quilpue", "Quilpué", "valparaiso", "Marga Marga", -33.048, -71.442],
  ["limache", "Limache", "valparaiso", "Marga Marga", -32.9833, -71.2833],
  ["olmue", "Olmué", "valparaiso", "Marga Marga", -33.0, -71.2],
  ["villa-alemana", "Villa Alemana", "valparaiso", "Marga Marga", -33.042, -71.373],
  // ── Metropolitana ──
  ["santiago-centro", "Santiago", "metropolitana", "Santiago", -33.445, -70.653],
  ["cerrillos", "Cerrillos", "metropolitana", "Santiago", -33.4989, -70.716],
  ["cerro-navia", "Cerro Navia", "metropolitana", "Santiago", -33.4227, -70.735],
  ["conchali", "Conchalí", "metropolitana", "Santiago", -33.383, -70.675],
  ["el-bosque", "El Bosque", "metropolitana", "Santiago", -33.562, -70.676],
  ["estacion-central", "Estación Central", "metropolitana", "Santiago", -33.46, -70.7],
  ["huechuraba", "Huechuraba", "metropolitana", "Santiago", -33.367, -70.633],
  ["independencia", "Independencia", "metropolitana", "Santiago", -33.416, -70.665],
  ["la-cisterna", "La Cisterna", "metropolitana", "Santiago", -33.53, -70.664],
  ["la-florida", "La Florida", "metropolitana", "Santiago", -33.522, -70.598],
  ["la-granja", "La Granja", "metropolitana", "Santiago", -33.536, -70.623],
  ["la-pintana", "La Pintana", "metropolitana", "Santiago", -33.583, -70.632],
  ["la-reina", "La Reina", "metropolitana", "Santiago", -33.445, -70.535],
  ["las-condes", "Las Condes", "metropolitana", "Santiago", -33.408, -70.567],
  ["lo-barnechea", "Lo Barnechea", "metropolitana", "Santiago", -33.35, -70.517],
  ["lo-espejo", "Lo Espejo", "metropolitana", "Santiago", -33.521, -70.692],
  ["lo-prado", "Lo Prado", "metropolitana", "Santiago", -33.444, -70.725],
  ["macul", "Macul", "metropolitana", "Santiago", -33.488, -70.599],
  ["maipu", "Maipú", "metropolitana", "Santiago", -33.511, -70.758],
  ["nunoa", "Ñuñoa", "metropolitana", "Santiago", -33.454, -70.604],
  ["pedro-aguirre-cerda", "Pedro Aguirre Cerda", "metropolitana", "Santiago", -33.493, -70.676],
  ["penalolen", "Peñalolén", "metropolitana", "Santiago", -33.486, -70.545],
  ["providencia", "Providencia", "metropolitana", "Santiago", -33.431, -70.61],
  ["pudahuel", "Pudahuel", "metropolitana", "Santiago", -33.44, -70.764],
  ["quilicura", "Quilicura", "metropolitana", "Santiago", -33.36, -70.73],
  ["quinta-normal", "Quinta Normal", "metropolitana", "Santiago", -33.428, -70.697],
  ["recoleta", "Recoleta", "metropolitana", "Santiago", -33.406, -70.64],
  ["renca", "Renca", "metropolitana", "Santiago", -33.404, -70.728],
  ["san-joaquin", "San Joaquín", "metropolitana", "Santiago", -33.496, -70.628],
  ["san-miguel", "San Miguel", "metropolitana", "Santiago", -33.497, -70.651],
  ["san-ramon", "San Ramón", "metropolitana", "Santiago", -33.537, -70.642],
  ["vitacura", "Vitacura", "metropolitana", "Santiago", -33.39, -70.572],
  ["puente-alto", "Puente Alto", "metropolitana", "Cordillera", -33.611, -70.576],
  ["pirque", "Pirque", "metropolitana", "Cordillera", -33.6352, -70.5729],
  ["san-jose-de-maipo", "San José de Maipo", "metropolitana", "Cordillera", -33.6333, -70.3667],
  ["colina", "Colina", "metropolitana", "Chacabuco", -33.2, -70.675],
  ["lampa", "Lampa", "metropolitana", "Chacabuco", -33.286, -70.876],
  ["tiltil", "Tiltil", "metropolitana", "Chacabuco", -33.0833, -70.9333],
  ["san-bernardo", "San Bernardo", "metropolitana", "Maipo", -33.592, -70.699],
  ["buin", "Buin", "metropolitana", "Maipo", -33.732, -70.742],
  ["calera-de-tango", "Calera de Tango", "metropolitana", "Maipo", -33.65, -70.8167],
  ["paine", "Paine", "metropolitana", "Maipo", -33.8167, -70.75],
  ["melipilla", "Melipilla", "metropolitana", "Melipilla", -33.689, -71.215],
  ["alhue", "Alhué", "metropolitana", "Melipilla", -34.0333, -71.1],
  ["curacavi", "Curacaví", "metropolitana", "Melipilla", -33.4, -71.15],
  ["maria-pinto", "María Pinto", "metropolitana", "Melipilla", -33.5333, -71.1333],
  ["san-pedro", "San Pedro", "metropolitana", "Melipilla", -33.9, -71.4667],
  ["talagante", "Talagante", "metropolitana", "Talagante", -33.665, -70.927],
  ["el-monte", "El Monte", "metropolitana", "Talagante", -33.6833, -71.0167],
  ["isla-de-maipo", "Isla de Maipo", "metropolitana", "Talagante", -33.75, -70.9],
  ["padre-hurtado", "Padre Hurtado", "metropolitana", "Talagante", -33.572, -70.815],
  ["penaflor", "Peñaflor", "metropolitana", "Talagante", -33.606, -70.876],
  // ── O'Higgins ──
  ["rancagua", "Rancagua", "ohiggins", "Cachapoal", -34.17, -70.74],
  ["codegua", "Codegua", "ohiggins", "Cachapoal", -34.0333, -70.6667],
  ["coinco", "Coinco", "ohiggins", "Cachapoal", -34.2667, -70.9667],
  ["coltauco", "Coltauco", "ohiggins", "Cachapoal", -34.3, -71.1],
  ["donihue", "Doñihue", "ohiggins", "Cachapoal", -34.2333, -70.9667],
  ["graneros", "Graneros", "ohiggins", "Cachapoal", -34.0646, -70.7265],
  ["las-cabras", "Las Cabras", "ohiggins", "Cachapoal", -34.3, -71.3167],
  ["machali", "Machalí", "ohiggins", "Cachapoal", -34.1826, -70.6511],
  ["malloa", "Malloa", "ohiggins", "Cachapoal", -34.45, -70.95],
  ["mostazal", "Mostazal", "ohiggins", "Cachapoal", -33.9833, -70.7],
  ["olivar", "Olivar", "ohiggins", "Cachapoal", -34.21, -70.8176],
  ["peumo", "Peumo", "ohiggins", "Cachapoal", -34.4, -71.1667],
  ["pichidegua", "Pichidegua", "ohiggins", "Cachapoal", -34.35, -71.3],
  ["quinta-de-tilcoco", "Quinta de Tilcoco", "ohiggins", "Cachapoal", -34.3546, -70.964],
  ["rengo", "Rengo", "ohiggins", "Cachapoal", -34.4069, -70.8625],
  ["requinoa", "Requínoa", "ohiggins", "Cachapoal", -34.2833, -70.8333],
  ["pichilemu", "Pichilemu", "ohiggins", "Cardenal Caro", -34.3841, -71.9107],
  ["la-estrella", "La Estrella", "ohiggins", "Cardenal Caro", -34.2, -71.6667],
  ["litueche", "Litueche", "ohiggins", "Cardenal Caro", -34.1167, -71.7333],
  ["navidad", "Navidad", "ohiggins", "Cardenal Caro", -33.9333, -71.8333],
  ["paredones", "Paredones", "ohiggins", "Cardenal Caro", -34.6481, -71.8992],
  ["san-fernando", "San Fernando", "ohiggins", "Colchagua", -34.59, -70.99],
  ["chepica", "Chépica", "ohiggins", "Colchagua", -34.7333, -71.2833],
  ["chimbarongo", "Chimbarongo", "ohiggins", "Colchagua", -34.7089, -71.0403],
  ["lolol", "Lolol", "ohiggins", "Colchagua", -34.7286, -71.6447],
  ["nancagua", "Nancagua", "ohiggins", "Colchagua", -34.6667, -71.2167],
  ["palmilla", "Palmilla", "ohiggins", "Colchagua", -34.6, -71.3667],
  ["peralillo", "Peralillo", "ohiggins", "Colchagua", -34.4833, -71.4833],
  ["placilla", "Placilla", "ohiggins", "Colchagua", -34.6333, -71.1167],
  ["pumanque", "Pumanque", "ohiggins", "Colchagua", -34.6, -71.6667],
  ["santa-cruz", "Santa Cruz", "ohiggins", "Colchagua", -34.64, -71.37],
  // ── Maule ──
  ["talca", "Talca", "maule", "Talca", -35.426, -71.655],
  ["constitucion", "Constitución", "maule", "Talca", -35.3333, -72.4167],
  ["curepto", "Curepto", "maule", "Talca", -35.0833, -72.0167],
  ["empedrado", "Empedrado", "maule", "Talca", -35.6, -72.2833],
  ["maule", "Maule", "maule", "Talca", -35.5333, -71.7],
  ["pelarco", "Pelarco", "maule", "Talca", -35.3833, -71.45],
  ["pencahue", "Pencahue", "maule", "Talca", -35.4, -71.8167],
  ["rio-claro", "Río Claro", "maule", "Talca", -35.2833, -71.2667],
  ["san-clemente", "San Clemente", "maule", "Talca", -35.55, -71.4833],
  ["san-rafael", "San Rafael", "maule", "Talca", -35.3167, -71.5333],
  ["cauquenes", "Cauquenes", "maule", "Cauquenes", -35.9714, -72.28],
  ["chanco", "Chanco", "maule", "Cauquenes", -35.7333, -72.5333],
  ["pelluhue", "Pelluhue", "maule", "Cauquenes", -35.815, -72.577],
  ["curico", "Curicó", "maule", "Curicó", -34.983, -71.239],
  ["hualane", "Hualañé", "maule", "Curicó", -34.9765, -71.8048],
  ["licanten", "Licantén", "maule", "Curicó", -34.9833, -72.0],
  ["molina", "Molina", "maule", "Curicó", -35.1131, -71.3056],
  ["rauco", "Rauco", "maule", "Curicó", -34.9333, -71.3167],
  ["romeral", "Romeral", "maule", "Curicó", -34.9667, -71.1333],
  ["sagrada-familia", "Sagrada Familia", "maule", "Curicó", -35.0, -71.3833],
  ["teno", "Teno", "maule", "Curicó", -34.8667, -71.1833],
  ["vichuquen", "Vichuquén", "maule", "Curicó", -34.8833, -72.0],
  ["linares", "Linares", "maule", "Linares", -35.85, -71.59],
  ["colbun", "Colbún", "maule", "Linares", -35.7, -71.4167],
  ["longavi", "Longaví", "maule", "Linares", -35.9667, -71.6833],
  ["parral", "Parral", "maule", "Linares", -36.15, -71.8333],
  ["retiro", "Retiro", "maule", "Linares", -36.05, -71.7667],
  ["san-javier", "San Javier", "maule", "Linares", -35.6, -71.73],
  ["villa-alegre", "Villa Alegre", "maule", "Linares", -35.6667, -71.75],
  ["yerbas-buenas", "Yerbas Buenas", "maule", "Linares", -35.75, -71.5833],
  // ── Ñuble ──
  ["chillan", "Chillán", "nuble", "Diguillín", -36.606, -72.103],
  ["bulnes", "Bulnes", "nuble", "Diguillín", -36.7424, -72.2984],
  ["chillan-viejo", "Chillán Viejo", "nuble", "Diguillín", -36.6229, -72.1317],
  ["el-carmen", "El Carmen", "nuble", "Diguillín", -36.9, -72.0333],
  ["pemuco", "Pemuco", "nuble", "Diguillín", -36.9667, -72.1],
  ["pinto", "Pinto", "nuble", "Diguillín", -36.7, -71.9],
  ["quillon", "Quillón", "nuble", "Diguillín", -36.7333, -72.4667],
  ["san-ignacio", "San Ignacio", "nuble", "Diguillín", -36.7998, -72.0304],
  ["yungay", "Yungay", "nuble", "Diguillín", -37.1167, -72.0167],
  ["quirihue", "Quirihue", "nuble", "Itata", -36.2827, -72.5409],
  ["cobquecura", "Cobquecura", "nuble", "Itata", -36.1333, -72.7833],
  ["coelemu", "Coelemu", "nuble", "Itata", -36.4876, -72.7023],
  ["ninhue", "Ninhue", "nuble", "Itata", -36.4, -72.4],
  ["portezuelo", "Portezuelo", "nuble", "Itata", -36.5464, -72.4665],
  ["ranquil", "Ránquil", "nuble", "Itata", -36.65, -72.55],
  ["treguaco", "Treguaco", "nuble", "Itata", -36.4333, -72.6667],
  ["san-carlos", "San Carlos", "nuble", "Punilla", -36.42, -71.96],
  ["coihueco", "Coihueco", "nuble", "Punilla", -36.6167, -71.8333],
  ["niquen", "Ñiquén", "nuble", "Punilla", -36.3, -71.9],
  ["san-fabian", "San Fabián", "nuble", "Punilla", -36.55, -71.55],
  ["san-nicolas", "San Nicolás", "nuble", "Punilla", -36.5, -72.2167],
  // ── Biobío ──
  ["concepcion", "Concepción", "biobio", "Concepción", -36.827, -73.05],
  ["coronel", "Coronel", "biobio", "Concepción", -37.0167, -73.1333],
  ["chiguayante", "Chiguayante", "biobio", "Concepción", -36.92, -73.03],
  ["florida", "Florida", "biobio", "Concepción", -36.8167, -72.6667],
  ["hualqui", "Hualqui", "biobio", "Concepción", -36.9759, -72.9384],
  ["lota", "Lota", "biobio", "Concepción", -37.0944, -73.1563],
  ["penco", "Penco", "biobio", "Concepción", -36.7386, -72.9939],
  ["san-pedro-de-la-paz", "San Pedro de la Paz", "biobio", "Concepción", -36.8408, -73.1031],
  ["santa-juana", "Santa Juana", "biobio", "Concepción", -37.1667, -72.9333],
  ["talcahuano", "Talcahuano", "biobio", "Concepción", -36.725, -73.116],
  ["tome", "Tomé", "biobio", "Concepción", -36.6171, -72.9575],
  ["hualpen", "Hualpén", "biobio", "Concepción", -36.7833, -73.0833],
  ["lebu", "Lebu", "biobio", "Arauco", -37.6778, -73.5906],
  ["arauco", "Arauco", "biobio", "Arauco", -37.2463, -73.3175],
  ["canete", "Cañete", "biobio", "Arauco", -37.8, -73.3833],
  ["contulmo", "Contulmo", "biobio", "Arauco", -38.0, -73.2333],
  ["curanilahue", "Curanilahue", "biobio", "Arauco", -37.4667, -73.35],
  ["los-alamos", "Los Álamos", "biobio", "Arauco", -37.6167, -73.4667],
  ["tirua", "Tirúa", "biobio", "Arauco", -38.3333, -73.5],
  ["los-angeles", "Los Ángeles", "biobio", "Biobío", -37.469, -72.354],
  ["antuco", "Antuco", "biobio", "Biobío", -37.3333, -71.6833],
  ["cabrero", "Cabrero", "biobio", "Biobío", -37.0333, -72.4],
  ["laja", "Laja", "biobio", "Biobío", -37.2667, -72.7],
  ["mulchen", "Mulchén", "biobio", "Biobío", -37.7167, -72.2333],
  ["nacimiento", "Nacimiento", "biobio", "Biobío", -37.5, -72.6667],
  ["negrete", "Negrete", "biobio", "Biobío", -37.5833, -72.5167],
  ["quilaco", "Quilaco", "biobio", "Biobío", -37.6844, -72.0064],
  ["quilleco", "Quilleco", "biobio", "Biobío", -37.4667, -71.9667],
  ["san-rosendo", "San Rosendo", "biobio", "Biobío", -37.2667, -72.7167],
  ["santa-barbara", "Santa Bárbara", "biobio", "Biobío", -37.6667, -72.0167],
  ["tucapel", "Tucapel", "biobio", "Biobío", -37.2833, -71.95],
  ["yumbel", "Yumbel", "biobio", "Biobío", -37.1333, -72.5333],
  ["alto-biobio", "Alto Biobío", "biobio", "Biobío", -38.05, -71.3167],
  // ── Araucanía ──
  ["temuco", "Temuco", "araucania", "Cautín", -38.739, -72.598],
  ["carahue", "Carahue", "araucania", "Cautín", -38.7, -73.1667],
  ["cunco", "Cunco", "araucania", "Cautín", -38.9167, -72.0333],
  ["curarrehue", "Curarrehue", "araucania", "Cautín", -39.35, -71.583],
  ["freire", "Freire", "araucania", "Cautín", -38.95, -72.6333],
  ["galvarino", "Galvarino", "araucania", "Cautín", -38.4, -72.7833],
  ["gorbea", "Gorbea", "araucania", "Cautín", -39.1, -72.6833],
  ["lautaro", "Lautaro", "araucania", "Cautín", -38.5292, -72.435],
  ["loncoche", "Loncoche", "araucania", "Cautín", -39.3667, -72.6333],
  ["melipeuco", "Melipeuco", "araucania", "Cautín", -38.85, -71.7],
  ["nueva-imperial", "Nueva Imperial", "araucania", "Cautín", -38.7333, -72.95],
  ["padre-las-casas", "Padre Las Casas", "araucania", "Cautín", -38.792, -72.5793],
  ["perquenco", "Perquenco", "araucania", "Cautín", -38.4167, -72.3833],
  ["pitrufquen", "Pitrufquén", "araucania", "Cautín", -38.9833, -72.65],
  ["pucon", "Pucón", "araucania", "Cautín", -39.2667, -71.9667],
  ["saavedra", "Saavedra", "araucania", "Cautín", -38.7833, -73.4],
  ["teodoro-schmidt", "Teodoro Schmidt", "araucania", "Cautín", -38.9848, -73.1147],
  ["tolten", "Toltén", "araucania", "Cautín", -39.1786, -73.1656],
  ["vilcun", "Vilcún", "araucania", "Cautín", -39.1183, -72.3794],
  ["villarrica", "Villarrica", "araucania", "Cautín", -39.28, -72.23],
  ["cholchol", "Cholchol", "araucania", "Cautín", -38.6, -72.85],
  ["angol", "Angol", "araucania", "Malleco", -37.7691, -72.7954],
  ["collipulli", "Collipulli", "araucania", "Malleco", -37.95, -72.4333],
  ["curacautin", "Curacautín", "araucania", "Malleco", -38.4333, -71.8833],
  ["ercilla", "Ercilla", "araucania", "Malleco", -38.05, -72.3833],
  ["lonquimay", "Lonquimay", "araucania", "Malleco", -38.4333, -71.2333],
  ["los-sauces", "Los Sauces", "araucania", "Malleco", -37.9667, -72.8333],
  ["lumaco", "Lumaco", "araucania", "Malleco", -38.15, -72.9167],
  ["puren", "Purén", "araucania", "Malleco", -38.0167, -73.0833],
  ["renaico", "Renaico", "araucania", "Malleco", -37.7178, -72.5757],
  ["traiguen", "Traiguén", "araucania", "Malleco", -38.25, -72.6833],
  ["victoria", "Victoria", "araucania", "Malleco", -38.2167, -72.3333],
  // ── Los Ríos ──
  ["valdivia", "Valdivia", "los-rios", "Valdivia", -39.814, -73.246],
  ["corral", "Corral", "los-rios", "Valdivia", -39.8883, -73.4325],
  ["lanco", "Lanco", "los-rios", "Valdivia", -39.5121, -72.6215],
  ["los-lagos", "Los Lagos", "los-rios", "Valdivia", -39.85, -72.8333],
  ["mafil", "Máfil", "los-rios", "Valdivia", -39.65, -72.95],
  ["mariquina", "Mariquina", "los-rios", "Valdivia", -39.5391, -72.9617],
  ["paillaco", "Paillaco", "los-rios", "Valdivia", -40.0706, -72.8727],
  ["panguipulli", "Panguipulli", "los-rios", "Valdivia", -39.7146, -72.0299],
  ["la-union", "La Unión", "los-rios", "Ranco", -40.2952, -73.0822],
  ["futrono", "Futrono", "los-rios", "Ranco", -40.1333, -72.4],
  ["lago-ranco", "Lago Ranco", "los-rios", "Ranco", -40.3167, -72.5],
  ["rio-bueno", "Río Bueno", "los-rios", "Ranco", -40.4959, -72.5357],
  // ── Los Lagos ──
  ["puerto-montt", "Puerto Montt", "los-lagos", "Llanquihue", -41.469, -72.942],
  ["calbuco", "Calbuco", "los-lagos", "Llanquihue", -41.7231, -73.1951],
  ["cochamo", "Cochamó", "los-lagos", "Llanquihue", -41.5, -72.3167],
  ["fresia", "Fresia", "los-lagos", "Llanquihue", -41.1544, -73.6065],
  ["frutillar", "Frutillar", "los-lagos", "Llanquihue", -41.0872, -73.0956],
  ["los-muermos", "Los Muermos", "los-lagos", "Llanquihue", -41.4, -73.4833],
  ["llanquihue", "Llanquihue", "los-lagos", "Llanquihue", -41.25, -73.0167],
  ["maullin", "Maullín", "los-lagos", "Llanquihue", -41.6167, -73.6],
  ["puerto-varas", "Puerto Varas", "los-lagos", "Llanquihue", -41.32, -72.98],
  ["castro", "Castro", "los-lagos", "Chiloé", -42.4824, -73.7643],
  ["ancud", "Ancud", "los-lagos", "Chiloé", -42.0176, -73.8022],
  ["chonchi", "Chonchi", "los-lagos", "Chiloé", -42.6821, -73.9306],
  ["curaco-de-velez", "Curaco de Vélez", "los-lagos", "Chiloé", -42.4267, -73.5787],
  ["dalcahue", "Dalcahue", "los-lagos", "Chiloé", -42.3796, -73.6473],
  ["puqueldon", "Puqueldón", "los-lagos", "Chiloé", -42.5993, -73.6763],
  ["queilen", "Queilén", "los-lagos", "Chiloé", -42.8878, -73.4724],
  ["quellon", "Quellón", "los-lagos", "Chiloé", -43.1, -73.6],
  ["quemchi", "Quemchi", "los-lagos", "Chiloé", -42.1333, -73.5167],
  ["quinchao", "Quinchao", "los-lagos", "Chiloé", -42.5333, -73.4167],
  ["osorno", "Osorno", "los-lagos", "Osorno", -40.574, -73.136],
  ["puerto-octay", "Puerto Octay", "los-lagos", "Osorno", -40.9667, -72.9],
  ["purranque", "Purranque", "los-lagos", "Osorno", -40.9167, -73.1667],
  ["puyehue", "Puyehue", "los-lagos", "Osorno", -40.6667, -72.6167],
  ["rio-negro", "Río Negro", "los-lagos", "Osorno", -40.7961, -73.2161],
  ["san-juan-de-la-costa", "San Juan de la Costa", "los-lagos", "Osorno", -40.5167, -73.4],
  ["san-pablo", "San Pablo", "los-lagos", "Osorno", -40.4, -73.0167],
  ["chaiten", "Chaitén", "los-lagos", "Palena", -42.9193, -72.7088],
  ["futaleufu", "Futaleufú", "los-lagos", "Palena", -43.1812, -72.0071],
  ["hualaihue", "Hualaihué", "los-lagos", "Palena", -42.0167, -72.6833],
  ["palena", "Palena", "los-lagos", "Palena", -43.6824, -71.9834],
  // ── Aysén ──
  ["coyhaique", "Coyhaique", "aysen", "Coyhaique", -45.5539, -71.9913],
  ["lago-verde", "Lago Verde", "aysen", "Coyhaique", -44.2417, -71.8517],
  ["aysen", "Aysén", "aysen", "Aysén", -45.4, -72.7],
  ["cisnes", "Cisnes", "aysen", "Aysén", -44.75, -72.7],
  ["guaitecas", "Guaitecas", "aysen", "Aysén", -43.8833, -73.7333],
  ["cochrane", "Cochrane", "aysen", "Capitán Prat", -47.3601, -72.7418],
  ["o-higgins", "O'Higgins", "aysen", "Capitán Prat", -48.4667, -72.5667],
  ["tortel", "Tortel", "aysen", "Capitán Prat", -47.8333, -73.5667],
  ["chile-chico", "Chile Chico", "aysen", "General Carrera", -46.7668, -72.5847],
  ["rio-ibanez", "Río Ibáñez", "aysen", "General Carrera", -46.3, -71.9333],
  // ── Magallanes ──
  ["punta-arenas", "Punta Arenas", "magallanes", "Magallanes", -53.163, -70.917],
  ["laguna-blanca", "Laguna Blanca", "magallanes", "Magallanes", -52.25, -71.9167],
  ["rio-verde", "Río Verde", "magallanes", "Magallanes", -52.65, -71.4833],
  ["san-gregorio", "San Gregorio", "magallanes", "Magallanes", -52.3167, -69.6833],
  ["cabo-de-hornos", "Cabo de Hornos", "magallanes", "Antártica Chilena", -54.9333, -67.6167],
  ["porvenir", "Porvenir", "magallanes", "Tierra del Fuego", -53.3, -70.3667],
  ["primavera", "Primavera", "magallanes", "Tierra del Fuego", -52.7167, -69.25],
  ["timaukel", "Timaukel", "magallanes", "Tierra del Fuego", -53.6667, -69.9],
  ["natales", "Natales", "magallanes", "Última Esperanza", -51.7333, -72.5167],
  ["torres-del-paine", "Torres del Paine", "magallanes", "Última Esperanza", -51.2667, -72.35],
  // ── Valparaíso ──
  ["llaillay", "Llaillay", "valparaiso", "San Felipe de Aconcagua", -32.8406, -70.9564],
  // ── O'Higgins ──
  ["san-vicente", "San Vicente", "ohiggins", "Cachapoal", -34.4383, -71.0775],
  ["marchihue", "Marchihue", "ohiggins", "Cardenal Caro", -34.3986, -71.6139],
  // ── Magallanes ──
  ["antartica", "Antártica", "magallanes", "Antártica Chilena", -62.2, -58.9667],
];

export const CHILE_COMUNAS: ChileComuna[] = ROWS.map(([slug, name, region, province, lat, lng]) => ({
  slug,
  name,
  region,
  province,
  lat,
  lng,
}));

/**
 * Comunas del Gran Santiago (la ciudad continua). Su "ciudad" es Santiago y
 * el texto las describe como parte de la capital.
 */
export const GRAN_SANTIAGO = new Set([
  "santiago-centro", "cerrillos", "cerro-navia", "conchali", "el-bosque", "estacion-central", "huechuraba",
  "independencia", "la-cisterna", "la-florida", "la-granja", "la-pintana", "la-reina", "las-condes",
  "lo-barnechea", "lo-espejo", "lo-prado", "macul", "maipu", "nunoa", "pedro-aguirre-cerda", "penalolen",
  "providencia", "pudahuel", "quilicura", "quinta-normal", "recoleta", "renca", "san-joaquin", "san-miguel",
  "san-ramon", "vitacura", "puente-alto", "san-bernardo", "padre-hurtado",
]);

const REGION_BY_KEY = new Map(CHILE_REGIONS.map((r) => [r.key, r]));
const REGION_BY_SLUG = new Map(CHILE_REGIONS.map((r) => [r.slug, r]));
const COMUNA_BY_SLUG = new Map(CHILE_COMUNAS.map((c) => [c.slug, c]));

export function getChileRegion(slug: string): ChileRegion | undefined {
  return REGION_BY_SLUG.get(String(slug || "").toLowerCase());
}

export function regionByKey(key: string): ChileRegion | undefined {
  return REGION_BY_KEY.get(key);
}

export function getChileComuna(slug: string): ChileComuna | undefined {
  return COMUNA_BY_SLUG.get(String(slug || "").toLowerCase());
}

export function comunasOfRegion(key: string): ChileComuna[] {
  return CHILE_COMUNAS.filter((c) => c.region === key);
}

/** Provincias de una región en el orden en que aparecen, con sus comunas. */
export function provincesOfRegion(key: string): { name: string; comunas: ChileComuna[] }[] {
  const out = new Map<string, ChileComuna[]>();
  for (const c of comunasOfRegion(key)) out.set(c.province, [...(out.get(c.province) || []), c]);
  return Array.from(out, ([name, comunas]) => ({ name, comunas }));
}

export function geoDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Las `n` comunas más cercanas a un punto (excluye `exclude`). */
export function nearestChileComunas(lat: number, lng: number, n: number, exclude?: string) {
  return CHILE_COMUNAS.filter((c) => c.slug !== exclude)
    .map((c) => ({ comuna: c, km: geoDistanceKm(lat, lng, c.lat, c.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
