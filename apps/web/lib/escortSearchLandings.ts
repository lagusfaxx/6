/**
 * Contenido SEO del lado DEMANDA para /escorts/[tag] y /escorts/[ciudad].
 *
 * Sale del Keyword Strategy Builder de Semrush (topics "escorts a domicilio y
 * hoteles", "escorts en santiago de chile", "escorts para hombres", "escorts
 * trans", "escorts milf y maduras"…). Antes todas las landings de tag usaban
 * la misma plantilla con el nombre del tag cambiado: Google las veía como
 * contenido duplicado y casi no les daba impresiones. Cada entrada de acá
 * tiene su título, H1, texto y FAQ propios, escritos para la búsqueda que
 * ataca, y el filtro real con el que se arma el listado.
 *
 * Quedaron fuera a propósito keywords del export que no corresponden:
 * "putas de 18" / "putitas de 18 años" / "escort chiquitita" (pueden leerse
 * como menores de edad) y el cluster de videos porno (otra intención).
 *
 * Consumido por app/escorts/[tag]/page.tsx y por el sitemap.
 */

export type SeoFaq = { question: string; answer: string };

/** Filtro de la API /directory/search con el que se arma el listado. */
export type TagFilter = {
  profileTags?: string[];
  serviceTags?: string[];
  gender?: "FEMALE" | "MALE" | "OTHER";
  /** Sólo quienes atienden a domicilio u hotel (acceptsOutcalls). */
  outcalls?: boolean;
  /** Edad >= 40, calculada por la API (nunca es un tag manual). */
  maduras?: boolean;
};

export type SeoCopy = {
  /** <title> sin el sufijo " | UZEED" (lo agrega el template del layout). */
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  paragraphs: string[];
  faq: SeoFaq[];
  /** Enlaces internos a landings relacionadas (ruta completa + texto). */
  related: { href: string; label: string }[];
};

export type TagLanding = SeoCopy & {
  slug: string;
  /** Nombre corto: título del listado y del breadcrumb. */
  name: string;
  filter: TagFilter;
};

const ADULTS_ONLY =
  "UZEED es sólo para mayores de 18 años: todas las profesionales son adultas y verifican su identidad antes de publicar.";

export const TAG_LANDINGS: TagLanding[] = [
  {
    slug: "a-domicilio",
    name: "Escorts a domicilio",
    filter: { outcalls: true, gender: "FEMALE" },
    title: "Escort a Domicilio y Hoteles en Santiago y Chile",
    description:
      "Escorts a domicilio verificadas: atienden en tu departamento u hotel en Santiago y todo Chile. Fotos reales, tarifas claras y contacto directo por WhatsApp.",
    keywords: [
      "escort a domicilio",
      "putas a domicilio",
      "sexo a domicilio",
      "prostitutas a domicilio",
      "servicios sexuales a domicilio",
      "escort hotel santiago",
      "escort sin conserje",
    ],
    h1: "Escorts a domicilio y en hoteles",
    paragraphs: [
      "En esta página están sólo las escorts que marcaron en su ficha que atienden a domicilio: van a tu departamento, casa u hotel. Cada perfil está verificado, con fotos reales, tarifa, duración mínima y horario, así que sabes lo que vas a encontrar antes de escribir.",
      "Si estás en un hotel, avisa el nombre y la comuna al contactarla: muchas piden confirmar la reserva o prefieren hoteles sin conserje o con acceso directo. En un departamento, comparte la dirección aproximada para que te confirme si llega a tu zona y cuánto cobra por el traslado.",
      "Las escorts a domicilio se concentran en Santiago (Las Condes, Providencia, Santiago Centro, Ñuñoa), Viña del Mar y Concepción. Usa el filtro de ubicación para ver primero las que están más cerca.",
    ],
    faq: [
      {
        question: "¿Cómo contrato una escort a domicilio?",
        answer:
          "Elige un perfil de esta lista, revisa su tarifa y horario y escríbele por WhatsApp o por el chat de UZEED con tu comuna y la hora. Ella confirma si llega a tu zona y el valor final.",
      },
      {
        question: "¿Las escorts a domicilio cobran traslado?",
        answer:
          "Depende de cada una. Algunas incluyen el traslado dentro de Santiago y otras suman un valor según la distancia. Pregúntalo al contactarla: la tarifa publicada en el perfil es la de la sesión.",
      },
      {
        question: "¿Atienden en hoteles y moteles?",
        answer:
          "Las que marcan \"se desplaza\" van a domicilio y a hoteles o moteles. Algunas prefieren hoteles sin conserje o con acceso directo: confírmalo al escribirle. En UZEED también puedes ver el directorio de moteles por comuna.",
      },
      {
        question: "¿Es seguro pedir una escort a domicilio por UZEED?",
        answer: `Los perfiles publicados pasan por verificación de identidad y fotos. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/las-condes", label: "Escorts en Las Condes" },
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/moteles", label: "Moteles por comuna" },
    ],
  },
  {
    slug: "hombres",
    name: "Escorts hombres",
    filter: { gender: "MALE" },
    title: "Escort Hombres y Escort Gay en Santiago",
    description:
      "Escorts hombres y acompañantes masculinos verificados en Santiago, Viña del Mar y Chile. Escort gay, para mujeres y parejas. Fotos reales y contacto directo.",
    keywords: [
      "escort gay",
      "escort hombres",
      "escort gay santiago",
      "escort masculino chile",
      "escort hombres en santiago",
      "escort gay viña del mar",
    ],
    h1: "Escorts hombres y acompañantes masculinos",
    paragraphs: [
      "Perfiles de escorts hombres verificados en Chile: acompañantes masculinos que atienden a hombres (escort gay), a mujeres y a parejas. Cada ficha indica a quién atiende, sus servicios, tarifa y si recibe en su lugar o va a domicilio.",
      "Activa tu ubicación para ver primero a los que están más cerca, en Santiago, Viña del Mar o regiones, y escríbeles directo por WhatsApp o por el chat de UZEED.",
    ],
    faq: [
      {
        question: "¿Hay escorts gay en Santiago?",
        answer:
          "Sí. En esta página están los escorts hombres publicados en UZEED; en cada perfil se indica si atiende a hombres, mujeres o parejas.",
      },
      {
        question: "¿Hay escorts gay en Viña del Mar?",
        answer:
          "Sí, hay perfiles en Viña del Mar y Valparaíso. Activa el filtro de ubicación o entra a la sección de Viña del Mar y cambia el filtro a Hombres.",
      },
      {
        question: "¿Los escorts hombres están verificados?",
        answer: `Sí, igual que las escorts mujeres: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/trans", label: "Escorts trans" },
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  {
    slug: "trans",
    name: "Escorts trans",
    filter: { gender: "OTHER" },
    title: "Escorts Trans y Travestis en Santiago",
    description:
      "Escorts trans y travestis verificadas en Santiago y todo Chile. Fotos reales, servicios y tarifas en cada perfil, y contacto directo por WhatsApp.",
    keywords: [
      "escort travesti",
      "escorts trans",
      "escort trans santiago",
      "escort travesti santiago",
      "escort trans chile",
    ],
    h1: "Escorts trans y travestis",
    paragraphs: [
      "Perfiles de escorts trans verificadas en Chile, con fotos reales, servicios, tarifa y horario. Cada ficha indica si recibe en su departamento o atiende a domicilio y en hoteles.",
      "Si buscas en una ciudad o comuna específica, activa el filtro de ubicación: la lista se ordena por cercanía.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts trans en Santiago?",
        answer:
          "En esta página están las escorts trans publicadas en UZEED, ordenadas por cercanía si activas tu ubicación. Contacta directo desde cada perfil.",
      },
      {
        question: "¿Las escorts trans están verificadas?",
        answer: `Sí, pasan la misma verificación de identidad y fotos que el resto. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/hombres", label: "Escorts hombres" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  {
    slug: "maduras",
    name: "Escorts maduras",
    filter: { maduras: true },
    title: "Escorts Maduras y MILF en Santiago",
    description:
      "Escorts maduras y MILF verificadas en Santiago y Chile: mujeres de 40 años o más, con experiencia y fotos reales. Contacto directo y disponibilidad hoy.",
    keywords: [
      "escort milf",
      "maduras escort",
      "escort maduras santiago",
      "milf santiago",
      "putas maduras en santiago",
    ],
    h1: "Escorts maduras y MILF",
    paragraphs: [
      "Escorts maduras de 40 años o más, calculado según la fecha de nacimiento verificada de cada perfil (no es una etiqueta que se ponga cada una). Mujeres con experiencia, trato cercano y discreción.",
      "Revisa en cada ficha si recibe en su lugar o va a domicilio, su tarifa y horario. Activa tu ubicación para verlas ordenadas por cercanía.",
    ],
    faq: [
      {
        question: "¿Qué significa escort MILF o madura?",
        answer:
          "En UZEED son escorts de 40 años o más. La edad sale de la fecha de nacimiento verificada, así que no hay perfiles jóvenes etiquetados como maduras.",
      },
      {
        question: "¿Hay escorts maduras en Santiago?",
        answer:
          "En esta página están todas las escorts maduras publicadas en UZEED. Activa tu ubicación para ver primero las de Santiago o la comuna donde estés.",
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
      { href: "/escorts/culona", label: "Escorts culonas" },
    ],
  },
  {
    slug: "culona",
    name: "Escorts culonas",
    filter: { profileTags: ["culona"] },
    title: "Escort Culona en Santiago - Fotos Reales",
    description:
      "Escorts culonas y voluptuosas verificadas en Santiago y Chile. Fotos reales, medidas, servicios y tarifa en cada perfil. Contacto directo por WhatsApp.",
    keywords: ["escort culona", "escort voluptuosa", "mujeres de compañía", "escort culona santiago"],
    h1: "Escorts culonas y voluptuosas",
    paragraphs: [
      "Escorts que se describen como culonas en su perfil, con fotos reales verificadas. En cada ficha verás medidas, estatura, servicios, tarifa y si atiende en su lugar o a domicilio.",
      "Filtra por ubicación para ver primero las que están en tu comuna: hay perfiles en Santiago Centro, Las Condes, Providencia y regiones.",
    ],
    faq: [
      {
        question: "¿Las fotos de las escorts culonas son reales?",
        answer: `Sí. Las fotos de cada perfil se revisan en la verificación. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/tetona", label: "Escorts tetonas" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
];

const TAG_BY_SLUG = new Map(TAG_LANDINGS.map((t) => [t.slug, t]));

export function getTagLanding(slug: string): TagLanding | undefined {
  return TAG_BY_SLUG.get(slug.toLowerCase());
}

/**
 * Tags que viven en `serviceTags` (lo que ofrece) y no en `profileTags` (cómo
 * es). Las landings de servicio (/escorts/anal, /escorts/trios…) filtraban por
 * profileTags y salían siempre vacías.
 */
const SERVICE_TAGS = new Set([
  "anal", "trios", "packs", "videollamada", "masaje-erotico", "despedidas",
  "discapacitados", "fetiches", "bdsm", "sexo-oral", "lluvia-dorada", "rol",
  "nuru", "tantra",
]);

/** Filtro de la API para cualquier /escorts/{tag} que no sea ciudad. */
export function tagFilter(tag: string): TagFilter {
  const curated = getTagLanding(tag);
  if (curated) return curated.filter;
  if (tag === "maduras") return { maduras: true };
  return SERVICE_TAGS.has(tag) ? { serviceTags: [tag] } : { profileTags: [tag] };
}

/** Parámetros de /directory/search para un filtro. */
export function tagFilterParams(filter: TagFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.profileTags?.length) params.profileTags = filter.profileTags.join(",");
  if (filter.serviceTags?.length) params.serviceTags = filter.serviceTags.join(",");
  if (filter.gender) params.gender = filter.gender;
  if (filter.outcalls) params.outcalls = "true";
  if (filter.maduras) params.maduras = "true";
  return params;
}

/* ────────────────────────────────────────────────────────────────────────
   Ciudades con copy propio. Santiago concentra casi todo el volumen del
   export ("escort santiago" 110k, "escort santiago centro" 8,1k, "escort las
   condes" 1,9k) y las búsquedas nombran estaciones de metro y barrios, así
   que el texto los menciona. Las demás ciudades siguen con la plantilla.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * `title` y `description` son opcionales: Santiago, Las Condes y Providencia
 * ya rankean con los de plantilla ("Escorts en X - Verificadas Hoy"; sus
 * clics vienen de "escort verificada(s)" y "escort las condes"), así que se
 * conservan tal cual y sólo se suma texto. Cambiar un título que ya funciona
 * puede mover la posición para cualquier lado.
 */
export type CitySeoCopy = Omit<SeoCopy, "title" | "description"> & {
  title?: string;
  description?: string;
};

export const CITY_SEO: Record<string, CitySeoCopy> = {
  santiago: {
    keywords: ["escort santiago", "escorts santiago", "putas santiago", "escort santiago centro", "escorts en santiago de chile"],
    h1: "Escorts en Santiago de Chile",
    paragraphs: [
      "Directorio de escorts verificadas en Santiago con fotos reales, tarifa, horario y contacto directo por WhatsApp. Las que están conectadas o disponibles hoy aparecen primero.",
      "Las comunas con más perfiles publicados son Santiago Centro, Las Condes y Providencia. Si buscas cerca de un metro en particular (Plaza de Armas, Santa Lucía, Baquedano, Los Leones, Tobalaba, Manquehue), activa tu ubicación y la lista se ordena por distancia. Cada ficha dice si recibe en su departamento o atiende a domicilio y en hoteles.",
      "¿Buscas algo específico? Revisa las escorts a domicilio, maduras o las que atienden en tu comuna desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde hay más escorts en Santiago?",
        answer:
          "Las comunas con más perfiles publicados son Santiago Centro, Las Condes y Providencia. También hay escorts en Estación Central, Ñuñoa, La Florida, Maipú y otras comunas, y varias se desplazan a domicilio.",
      },
      {
        question: "¿Hay escorts en Santiago disponibles hoy?",
        answer:
          "Sí. Ordena por \"disponible ahora\" para ver sólo las que están atendiendo en este momento, y escríbeles directo por WhatsApp.",
      },
      {
        question: "¿Las escorts de Santiago están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/las-condes", label: "Escorts en Las Condes" },
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
    ],
  },
  "santiago-centro": {
    title: "Escort Santiago Centro y Plaza de Armas",
    description:
      "Escorts en Santiago Centro verificadas: Plaza de Armas, metro Santa Lucía, Toesca y Baquedano. Fotos reales, tarifas y contacto directo por WhatsApp.",
    keywords: ["escort santiago centro", "escort plaza de armas", "escort metro toesca", "escort baquedano", "escort metro baquedano"],
    h1: "Escorts en Santiago Centro",
    paragraphs: [
      "Escorts verificadas en Santiago Centro, ordenadas por cercanía: primero las del centro y después las de comunas vecinas. Cada perfil muestra fotos reales, tarifa y si recibe en su departamento.",
      "Si buscas cerca de un metro del centro (Plaza de Armas, Santa Lucía, Universidad de Chile, Toesca o Baquedano), activa tu ubicación y la lista se ordena por distancia. La dirección exacta la entrega cada escort al contactarla por WhatsApp.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de Plaza de Armas?",
        answer:
          "Santiago Centro es la comuna con más escorts publicadas en UZEED. Activa tu ubicación para ver primero las más cercanas a Plaza de Armas; la dirección exacta la entrega cada una al contactarla.",
      },
      {
        question: "¿Y cerca de metro Baquedano o Toesca?",
        answer:
          "También. Activa tu ubicación y la lista se ordena por distancia a donde estás.",
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "las-condes": {
    keywords: ["escort las condes", "escort manquehue", "putas las condes", "escort metro manquehue"],
    h1: "Escorts en Las Condes",
    paragraphs: [
      "Escorts verificadas en Las Condes, con fotos reales, tarifa y horario. Algunas reciben en departamento privado y la mayoría de las publicadas en la comuna se desplaza a domicilio y a hoteles del sector (Manquehue, El Golf, Alcántara, Tobalaba).",
      "La lista se ordena por cercanía: primero Las Condes y después Providencia, Vitacura y Ñuñoa.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Manquehue?",
        answer:
          "Activa tu ubicación y la lista se ordena por distancia a donde estás. La dirección exacta la entrega cada escort al contactarla.",
      },
      {
        question: "¿Atienden en hoteles de Las Condes?",
        answer:
          "Sí, la mayoría de las escorts publicadas en Las Condes marca que se desplaza. Revisa en el perfil si atiende a domicilio u hotel, o entra a la sección de escorts a domicilio.",
      },
    ],
    related: [
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  providencia: {
    keywords: ["escort providencia", "escort tobalaba", "escort metro tobalaba", "escort metro los leones", "escort parque bustamante"],
    h1: "Escorts en Providencia",
    paragraphs: [
      "Escorts verificadas en Providencia, con fotos reales, tarifa y horario. Si buscas cerca de metro Tobalaba, Los Leones, Pedro de Valdivia o Parque Bustamante, activa tu ubicación y la lista se ordena por distancia.",
      "La lista se ordena por cercanía: primero Providencia y después Santiago Centro, Ñuñoa y Las Condes. En cada ficha verás si recibe en su lugar o va a domicilio.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Tobalaba o Los Leones?",
        answer:
          "Providencia es una de las comunas con más escorts publicadas en UZEED. Activa tu ubicación para ver primero las más cercanas; la dirección exacta la entrega cada una al contactarla.",
      },
    ],
    related: [
      { href: "/escorts/las-condes", label: "Escorts en Las Condes" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
    ],
  },

  /* ── Comunas del Gran Santiago con más tráfico (San Bernardo, Puente Alto
     y Maipú son las tres landings con más clics del sitio) y regiones. El
     texto no promete cantidades: la oferta cambia y en varias ciudades aún
     hay pocas o ninguna, y la página muestra entonces las más cercanas. ── */
  "san-bernardo": localCopy({
    name: "San Bernardo",
    keywords: ["escort san bernardo", "escorts en san bernardo", "putas san bernardo"],
    local:
      "Si estás en San Bernardo, en el centro, cerca de la Plaza de Armas, por Avenida Eyzaguirre o en Nos, la forma más rápida es buscar escorts que se desplazan: van a tu casa, departamento o motel. También verás perfiles de comunas vecinas como El Bosque, La Cisterna, Buin y Calera de Tango, ordenados por distancia.",
    near: [["puente-alto", "Puente Alto"], ["maipu", "Maipú"], ["santiago", "Santiago"]],
  }),
  "puente-alto": localCopy({
    name: "Puente Alto",
    keywords: ["escort puente alto", "escorts en puente alto", "putas puente alto"],
    local:
      "En Puente Alto la lista incluye escorts de la comuna y de las vecinas, como La Florida, La Pintana y San José de Maipo, ordenadas por distancia. Si estás cerca de la Plaza de Puente Alto o de la Línea 4 del metro (Hospital Sótero del Río, Elisa Correa, Las Mercedes), activa tu ubicación para ver primero a las más cercanas, o busca a las que se desplazan hasta tu casa u hotel.",
    near: [["san-bernardo", "San Bernardo"], ["nunoa", "Ñuñoa"], ["santiago", "Santiago"]],
  }),
  maipu: localCopy({
    name: "Maipú",
    keywords: ["escort maipu", "escorts en maipu", "putas maipu", "escort en maipú"],
    local:
      "En Maipú la lista suma escorts de la comuna y de las vecinas, como Estación Central, Cerrillos, Pudahuel y Padre Hurtado, ordenadas por distancia. Si estás cerca de la Plaza de Maipú o de la Línea 5 del metro (Santiago Bueras, Del Sol, Monte Tabor, Las Parcelas), activa tu ubicación; también puedes buscar a las que se desplazan a tu casa u hotel.",
    near: [["santiago", "Santiago"], ["san-bernardo", "San Bernardo"], ["santiago-centro", "Santiago Centro"]],
  }),
  nunoa: localCopy({
    name: "Ñuñoa",
    keywords: ["escort ñuñoa", "escorts ñuñoa", "escort nunoa"],
    local:
      "Ñuñoa limita con Providencia, Macul, Peñalolén y La Reina, así que la lista mezcla escorts de la comuna y de esas vecinas, ordenadas por distancia. Si estás cerca de Plaza Ñuñoa, Irarrázaval o de las líneas 3 y 6 del metro (Chile España, Ñuñoa, Estadio Nacional), activa tu ubicación para ver primero a las más cercanas.",
    near: [["providencia", "Providencia"], ["las-condes", "Las Condes"], ["santiago-centro", "Santiago Centro"]],
  }),
  temuco: localCopy({
    name: "Temuco",
    keywords: ["escort temuco", "escorts en temuco", "acompañantes temuco"],
    local:
      "Escorts y acompañantes en Temuco y alrededores, como Padre Las Casas y Labranza. Hay perfiles en el centro y en otros sectores de la ciudad; cada ficha dice si recibe en su departamento o se desplaza a tu casa, hotel o motel.",
    near: [["los-angeles", "Los Ángeles"], ["osorno", "Osorno"], ["puerto-montt", "Puerto Montt"]],
  }),
  "los-angeles": localCopy({
    name: "Los Ángeles",
    keywords: ["escort los angeles", "acompañantes los angeles", "escorts en los angeles"],
    local:
      "Escorts y acompañantes en Los Ángeles, Región del Biobío, y comunas cercanas como Nacimiento, Mulchén y Cabrero. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos, con su ciudad y distancia reales, en vez de dejarte una lista vacía.",
    near: [["concepcion", "Concepción"], ["chillan", "Chillán"], ["temuco", "Temuco"]],
  }),
  "vina-del-mar": localCopy({
    name: "Viña del Mar",
    keywords: ["escort viña del mar", "escorts viña del mar", "escort viña"],
    local:
      "Escorts y acompañantes en Viña del Mar y el Gran Valparaíso: el centro de Viña, Reñaca, Recreo, Valparaíso, Concón, Quilpué y Villa Alemana. La lista se ordena por distancia y cada ficha dice si recibe en su departamento o se desplaza a tu hotel en la costa.",
    near: [["valparaiso", "Valparaíso"], ["santiago", "Santiago"], ["hombres", "Escorts hombres"]],
  }),
  valparaiso: localCopy({
    name: "Valparaíso",
    keywords: ["escort valparaiso", "acompañantes valparaíso", "escorts en valparaiso"],
    local:
      "Escorts y acompañantes en Valparaíso, en el plan y los cerros, y en las comunas vecinas de Viña del Mar, Quilpué y Villa Alemana. La lista se ordena por distancia: primero Valparaíso y después el resto del Gran Valparaíso.",
    near: [["vina-del-mar", "Viña del Mar"], ["santiago", "Santiago"]],
  }),
  concepcion: localCopy({
    name: "Concepción",
    keywords: ["escort concepcion", "escort conce", "escorts en concepcion"],
    local:
      "Escorts y acompañantes en Concepción (Conce) y el Gran Concepción: Talcahuano, San Pedro de la Paz, Chiguayante y Hualpén. Hay perfiles en el centro de la ciudad; cada ficha dice si recibe en su departamento o se desplaza a tu casa u hotel.",
    near: [["los-angeles", "Los Ángeles"], ["chillan", "Chillán"], ["temuco", "Temuco"]],
  }),
  osorno: localCopy({
    name: "Osorno",
    keywords: ["escort osorno", "escorts osorno"],
    local:
      "Escorts y acompañantes en Osorno y la Región de Los Lagos. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos (como Puerto Montt), con su ciudad y distancia reales.",
    near: [["puerto-montt", "Puerto Montt"], ["temuco", "Temuco"]],
  }),
  calama: localCopy({
    name: "Calama",
    keywords: ["escort calama", "escorts calama", "acompañantes calama"],
    local:
      "Escorts y acompañantes en Calama, Región de Antofagasta. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos, como Antofagasta, con su distancia real.",
    near: [["antofagasta", "Antofagasta"], ["iquique", "Iquique"]],
  }),
  antofagasta: localCopy({
    name: "Antofagasta",
    keywords: ["escort antofagasta", "escorts en antofagasta"],
    local:
      "Escorts y acompañantes en Antofagasta, en el centro y a lo largo de la costanera. Cada ficha dice si recibe en su departamento o se desplaza a tu casa u hotel.",
    near: [["calama", "Calama"], ["iquique", "Iquique"]],
  }),
  rancagua: localCopy({
    name: "Rancagua",
    keywords: ["escort rancagua", "escorts rancagua", "acompañantes rancagua"],
    local:
      "Escorts y acompañantes en Rancagua y alrededores, como Machalí y Graneros. La lista se ordena por distancia: primero Rancagua y después las comunas vecinas de O'Higgins.",
    near: [["santiago", "Santiago"], ["talca", "Talca"]],
  }),
  talca: localCopy({
    name: "Talca",
    keywords: ["escort talca", "acompañantes en talca"],
    local:
      "Escorts y acompañantes en Talca, Región del Maule. Si hay pocos perfiles publicados en la ciudad, la lista suma los más cercanos, como Curicó, con su distancia real.",
    near: [["curico", "Curicó"], ["rancagua", "Rancagua"]],
  }),
  chillan: localCopy({
    name: "Chillán",
    keywords: ["escort chillan", "escorts chillan"],
    local:
      "Escorts y acompañantes en Chillán y Chillán Viejo, Región de Ñuble. Si hay pocos perfiles publicados en la ciudad, la lista suma los más cercanos, como Concepción, con su distancia real.",
    near: [["concepcion", "Concepción"], ["los-angeles", "Los Ángeles"]],
  }),
  iquique: localCopy({
    name: "Iquique",
    keywords: ["escort iquique", "acompañantes en iquique"],
    local:
      "Escorts y acompañantes en Iquique y Alto Hospicio, Región de Tarapacá. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos con su distancia real.",
    near: [["arica", "Arica"], ["antofagasta", "Antofagasta"]],
  }),
  "puerto-montt": localCopy({
    name: "Puerto Montt",
    keywords: ["escort puerto montt", "escorts en puerto montt"],
    local:
      "Escorts y acompañantes en Puerto Montt y Puerto Varas, Región de Los Lagos. Cada ficha dice si recibe en su departamento o se desplaza a tu casa u hotel.",
    near: [["osorno", "Osorno"], ["temuco", "Temuco"]],
  }),
  curico: localCopy({
    name: "Curicó",
    keywords: ["escort curico", "escort en curico"],
    local:
      "Escorts y acompañantes en Curicó, Región del Maule. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos, como Talca, con su distancia real.",
    near: [["talca", "Talca"], ["rancagua", "Rancagua"]],
  }),
  copiapo: localCopy({
    name: "Copiapó",
    keywords: ["escort copiapo", "escort copiapó"],
    local:
      "Escorts y acompañantes en Copiapó, Región de Atacama. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos con su distancia real.",
    near: [["la-serena", "La Serena"], ["antofagasta", "Antofagasta"]],
  }),
  "la-serena": localCopy({
    name: "La Serena",
    keywords: ["escort la serena", "escort coquimbo"],
    local:
      "Escorts y acompañantes en La Serena y Coquimbo, Región de Coquimbo. La lista se ordena por distancia y cada ficha dice si recibe en su departamento o se desplaza a tu hotel.",
    near: [["copiapo", "Copiapó"], ["santiago", "Santiago"]],
  }),
  "punta-arenas": localCopy({
    name: "Punta Arenas",
    keywords: ["escort punta arenas", "acompañante punta arenas"],
    local:
      "Escorts y acompañantes en Punta Arenas, Región de Magallanes. Cada ficha dice si recibe en su departamento o se desplaza a tu casa u hotel.",
    near: [["puerto-montt", "Puerto Montt"]],
  }),
  arica: localCopy({
    name: "Arica",
    keywords: ["escort arica", "escorts en arica"],
    local:
      "Escorts y acompañantes en Arica, Región de Arica y Parinacota. Si todavía no hay perfiles publicados en la ciudad, la página muestra los más cercanos, como Iquique, con su distancia real.",
    near: [["iquique", "Iquique"]],
  }),
};

/**
 * Copy de una comuna o ciudad: un párrafo local propio (sectores, comunas
 * vecinas, metro) y la parte común. Así cada landing tiene texto distinto sin
 * inventar datos que la página no puede respaldar.
 */
function localCopy({
  name,
  keywords,
  local,
  near,
}: {
  name: string;
  keywords: string[];
  local: string;
  near: [string, string][];
}): CitySeoCopy {
  return {
    keywords,
    h1: `Dónde encontrar escorts en ${name}`,
    paragraphs: [
      local,
      `Todas las escorts de UZEED están verificadas: identidad y fotos reales. En cada perfil verás tarifa, horario, servicios y el botón para escribirle directo por WhatsApp o por el chat de UZEED.`,
    ],
    faq: [
      {
        question: `¿Hay escorts que se desplacen en ${name}?`,
        answer: `Las escorts que marcan "se desplaza" en su perfil van a tu casa, departamento, hotel o motel. Entra a la sección de escorts a domicilio y activa tu ubicación en ${name} para ver primero a las más cercanas.`,
      },
      {
        question: `¿Cómo contacto a una escort en ${name}?`,
        answer:
          "Desde su perfil, por WhatsApp o por el chat de UZEED. Cuéntale en qué sector estás y a qué hora: ella te confirma si llega y la tarifa final.",
      },
    ],
    related: [
      ...near.map(([slug, label]) => ({
        href: `/escorts/${slug}`,
        label: slug === "hombres" ? label : `Escorts en ${label}`,
      })),
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  };
}
