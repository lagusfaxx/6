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
          "Sí, la mayoría atiende en hoteles y moteles. Algunas prefieren hoteles sin conserje o con acceso directo; en UZEED también puedes ver el directorio de moteles por comuna.",
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
      "La mayoría está en Santiago, pero también hay escorts gay en Viña del Mar y Valparaíso. Filtra por ubicación para ver primero a los que están más cerca y escríbeles directo por WhatsApp o por el chat de UZEED.",
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
      "La mayoría atiende en Santiago. Si buscas en otra ciudad, activa el filtro de ubicación: la lista se ordena por cercanía.",
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
      "La mayoría atiende en Santiago. Revisa en cada ficha si recibe en su lugar o va a domicilio, su tarifa y horario.",
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
          "Sí, la mayoría de las escorts maduras de UZEED atiende en Santiago. Activa tu ubicación para verlas ordenadas por cercanía.",
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
  /* ── Semrush oct 2026: categorías con filtro real y sin tráfico previo en
     Search Console (antes usaban la plantilla genérica). ── */
  {
    slug: "gordita",
    name: "Escorts gorditas",
    filter: { profileTags: ["gordita"] },
    title: "Escort Gordita y Putas Gorditas en Santiago",
    description:
      "Escorts gorditas y rellenitas verificadas en Santiago y Chile. Fotos reales, medidas, servicios y tarifa en cada perfil. Contacto directo por WhatsApp.",
    keywords: [
      "escort gordita",
      "putas gorditas",
      "gordas putas",
      "escort gordita santiago",
      "sexo gordita santiago",
      "escort rellenita",
    ],
    h1: "Escorts gorditas y rellenitas",
    paragraphs: [
      "Escorts que se describen como gorditas en su perfil, con fotos reales verificadas. En cada ficha verás medidas, estatura, servicios, tarifa y si atiende en su departamento o a domicilio.",
      "La mayoría atiende en Santiago. Activa tu ubicación para ver primero las que están más cerca de tu comuna.",
    ],
    faq: [
      {
        question: "¿Las fotos de las escorts gorditas son reales?",
        answer: `Sí. Las fotos de cada perfil se revisan en la verificación. ${ADULTS_ONLY}`,
      },
      {
        question: "¿Dónde hay escorts gorditas en Santiago?",
        answer:
          "En esta página están todas las que publican en UZEED. Ordénalas por cercanía con tu ubicación y escríbeles directo desde su perfil.",
      },
    ],
    related: [
      { href: "/escorts/culona", label: "Escorts culonas" },
      { href: "/escorts/tetona", label: "Escorts tetonas" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  {
    slug: "anal",
    name: "Escorts con anal",
    filter: { serviceTags: ["anal"] },
    title: "Escort Anal en Santiago - Perfiles Verificados",
    description:
      "Escorts que ofrecen sexo anal en Santiago y Chile. Perfiles verificados con fotos reales, servicios y tarifas claras. Contacto directo por WhatsApp.",
    keywords: ["escort anal", "escort anal santiago", "sexo anal santiago", "anal santiago", "putas anal"],
    h1: "Escorts que ofrecen anal",
    paragraphs: [
      "Escorts que marcaron el servicio anal en su ficha. Cada perfil muestra fotos reales, la lista completa de servicios, la tarifa y si el anal tiene un valor adicional.",
      "Confirma siempre el servicio y el precio al escribirle: cada profesional decide qué ofrece y en qué condiciones. La mayoría atiende en Santiago Centro, Providencia y Las Condes.",
    ],
    faq: [
      {
        question: "¿El anal tiene un costo extra?",
        answer:
          "Depende de cada escort. Algunas lo incluyen en la tarifa y otras lo cobran aparte: revisa su perfil o pregúntale al contactarla.",
      },
      {
        question: "¿Las escorts de esta lista están verificadas?",
        answer: `Sí, identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/trios", label: "Escorts para tríos" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  {
    slug: "masaje-erotico",
    name: "Masajes eróticos",
    filter: { serviceTags: ["masaje-erotico"] },
    title: "Masajes Eróticos y Sensitivos en Santiago",
    description:
      "Escorts que ofrecen masajes eróticos, sensitivos y con final feliz en Santiago y Chile. Perfiles verificados, fotos reales y contacto directo por WhatsApp.",
    keywords: [
      "masajes sexuales",
      "masajes sensitivos",
      "masajes eroticos santiago",
      "masajes con final feliz en santiago",
      "masajes sensitivos providencia",
      "masaje erotico",
    ],
    h1: "Masajes eróticos y sensitivos",
    paragraphs: [
      "Escorts que ofrecen masaje erótico entre sus servicios: masajes sensitivos, de cuerpo completo y con final feliz. Cada ficha muestra fotos reales, tarifa, duración y si atiende en su lugar o a domicilio.",
      "Las zonas con más perfiles son Santiago Centro, Providencia y Las Condes. Si buscas sólo masajes, revisa también el directorio de masajistas.",
    ],
    faq: [
      {
        question: "¿Qué es un masaje sensitivo?",
        answer:
          "Es un masaje de relajación con contacto sensual en todo el cuerpo. Qué incluye exactamente (por ejemplo, final feliz) lo define cada profesional en su perfil: confírmalo al escribirle.",
      },
      {
        question: "¿Dónde hay masajes eróticos en Santiago?",
        answer:
          "En esta página y en el directorio de masajistas de UZEED. Activa tu ubicación para verlas ordenadas por cercanía.",
      },
      {
        question: "¿Las masajistas están verificadas?",
        answer: `Sí, identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/masajistas", label: "Masajistas" },
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
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
      "Las zonas con más perfiles son Santiago Centro (Plaza de Armas, metro Santa Lucía, Toesca y Baquedano), Providencia (Los Leones, Tobalaba, Parque Bustamante) y Las Condes (Manquehue, El Golf). Cada ficha dice si recibe en su departamento o atiende a domicilio y en hoteles.",
      "¿Buscas algo específico? Revisa las escorts a domicilio, maduras o las que atienden en tu comuna desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde hay más escorts en Santiago?",
        answer:
          "En Santiago Centro, Providencia y Las Condes, cerca de las estaciones de metro Santa Lucía, Baquedano, Los Leones, Tobalaba y Manquehue.",
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
      "Muchas atienden a pasos del metro: Plaza de Armas, Santa Lucía, Universidad de Chile, Toesca y Baquedano. Pregúntale la dirección exacta al contactarla por WhatsApp.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de Plaza de Armas?",
        answer:
          "Sí, varias escorts de Santiago Centro reciben cerca de Plaza de Armas y metro Santa Lucía. La dirección exacta la entrega ella al contactarla.",
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
      "Escorts verificadas en Las Condes, con fotos reales, tarifa y horario. Muchas reciben en departamentos privados cerca de metro Manquehue, El Golf, Alcántara y Tobalaba; otras atienden a domicilio y en hoteles del sector.",
      "La lista se ordena por cercanía: primero Las Condes y después Providencia, Vitacura y Ñuñoa.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Manquehue?",
        answer:
          "Sí, es una de las zonas de Las Condes con más perfiles. La dirección exacta la entrega cada escort al contactarla.",
      },
      {
        question: "¿Atienden en hoteles de Las Condes?",
        answer:
          "Muchas sí. Revisa en el perfil si atiende a domicilio u hotel, o entra a la sección de escorts a domicilio.",
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
      "Escorts verificadas en Providencia, con fotos reales, tarifa y horario. Las zonas con más perfiles están cerca de metro Tobalaba, Los Leones, Pedro de Valdivia y Parque Bustamante.",
      "La lista se ordena por cercanía: primero Providencia y después Santiago Centro, Ñuñoa y Las Condes. En cada ficha verás si recibe en su lugar o va a domicilio.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Tobalaba o Los Leones?",
        answer:
          "Sí, son de las zonas de Providencia con más perfiles. La dirección exacta la entrega la escort al contactarla.",
      },
    ],
    related: [
      { href: "/escorts/las-condes", label: "Escorts en Las Condes" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
    ],
  },
  // ── Ciudades agregadas con Semrush (oct 2026) ──
  "la-florida": {
    keywords: ["escort la florida", "putas en la florida", "sexo en la florida", "escort metro la florida"],
    h1: "Escorts en La Florida",
    paragraphs: [
      "Escorts verificadas en La Florida con fotos reales, tarifa, horario y contacto directo por WhatsApp. Muchas reciben cerca de metro Bellavista de La Florida, Mirador y Vicente Valdés.",
      "La lista se ordena por cercanía: primero La Florida y después Puente Alto, Macul y Ñuñoa. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Bellavista de La Florida?",
        answer:
          "Sí. Activa tu ubicación y la lista se ordena por distancia; la dirección exacta la entrega cada escort al contactarla.",
      },
      {
        question: "¿Las escorts de La Florida están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/puente-alto", label: "Escorts en Puente Alto" },
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  "estacion-central": {
    keywords: ["escort estacion central", "putas estacion central", "sexo en estación central"],
    h1: "Escorts en Estación Central",
    paragraphs: [
      "Escorts verificadas en Estación Central con fotos reales, tarifa y contacto directo por WhatsApp. Muchas reciben cerca de metro Estación Central, Universidad de Santiago y San Alberto Hurtado.",
      "La lista se ordena por cercanía: primero Estación Central y después Santiago Centro y Maipú. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Estación Central?",
        answer:
          "Sí, es una zona con perfiles que reciben en su departamento. Pregúntale la dirección exacta al contactarla.",
      },
      {
        question: "¿Las escorts de Estación Central están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/maipu", label: "Escorts en Maipú" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  "la-cisterna": {
    keywords: ["escort la cisterna", "putas la cisterna", "sexo la cisterna"],
    h1: "Escorts en La Cisterna",
    paragraphs: [
      "Escorts verificadas en La Cisterna con fotos reales, tarifa, horario y contacto directo por WhatsApp. Varias reciben cerca de metro La Cisterna y Lo Ovalle.",
      "La lista se ordena por cercanía: primero La Cisterna y después San Miguel, San Bernardo y Santiago Centro. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro La Cisterna?",
        answer:
          "Sí. Activa tu ubicación para ver las más cercanas y escríbeles directo desde su perfil.",
      },
      {
        question: "¿Las escorts de La Cisterna están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/san-bernardo", label: "Escorts en San Bernardo" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  "san-antonio": {
    keywords: ["escort san antonio", "putas san antonio", "damas de compañia san antonio", "sexo san antonio"],
    h1: "Escorts en San Antonio",
    paragraphs: [
      "Escorts y damas de compañía verificadas en San Antonio, en el litoral central, con fotos reales, tarifa y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero San Antonio y después Cartagena, Santo Domingo y el resto de la Región de Valparaíso. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts a domicilio en San Antonio?",
        answer:
          "Algunas atienden a domicilio u hotel en el litoral. Revisa en cada perfil si va a domicilio y pregúntale por el traslado.",
      },
      {
        question: "¿Las escorts de San Antonio están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/valparaiso", label: "Escorts en Valparaíso" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "coquimbo": {
    keywords: ["putas coquimbo", "escort coquimbo", "prostitutas coquimbo", "sexo coquimbo"],
    h1: "Escorts en Coquimbo",
    paragraphs: [
      "Escorts verificadas en Coquimbo con fotos reales, tarifa, horario y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Coquimbo y después La Serena, que está a pocos minutos. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Las escorts de La Serena atienden en Coquimbo?",
        answer:
          "Muchas sí, por la cercanía entre ambas ciudades. Revisa en su perfil si atiende a domicilio u hotel.",
      },
      {
        question: "¿Las escorts de Coquimbo están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/la-serena", label: "Escorts en La Serena" },
      { href: "/escorts/ovalle", label: "Escorts en Ovalle" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "ovalle": {
    keywords: ["escort en ovalle", "putas en ovalle", "servicios sexuales ovalle"],
    h1: "Escorts en Ovalle",
    paragraphs: [
      "Escorts verificadas en Ovalle, Región de Coquimbo, con fotos reales, tarifa y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Ovalle y después Coquimbo y La Serena. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts en Ovalle hoy?",
        answer:
          "Ordena por \"disponible ahora\" para ver las que están atendiendo en este momento cerca de Ovalle.",
      },
      {
        question: "¿Las escorts de Ovalle están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/coquimbo", label: "Escorts en Coquimbo" },
      { href: "/escorts/la-serena", label: "Escorts en La Serena" },
    ],
  },
  "san-fernando": {
    keywords: ["escort san fernando", "sexo san fernando", "putas san fernando"],
    h1: "Escorts en San Fernando",
    paragraphs: [
      "Escorts verificadas en San Fernando, Región de O'Higgins, con fotos reales, tarifa, horario y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero San Fernando y después Santa Cruz, Rancagua y Curicó. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts entre San Fernando y Rancagua?",
        answer:
          "Sí. Activa tu ubicación y verás primero las más cercanas a ti en el valle de Colchagua y Cachapoal.",
      },
      {
        question: "¿Las escorts de San Fernando están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santa-cruz", label: "Escorts en Santa Cruz" },
      { href: "/escorts/rancagua", label: "Escorts en Rancagua" },
      { href: "/escorts/curico", label: "Escorts en Curicó" },
    ],
  },
  "santa-cruz": {
    keywords: ["escort en santa cruz", "sexo santa cruz", "damas de compañia santa cruz"],
    h1: "Escorts en Santa Cruz",
    paragraphs: [
      "Escorts y damas de compañía verificadas en Santa Cruz, en el valle de Colchagua, con fotos reales, tarifa y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Santa Cruz y después San Fernando, Rancagua y Curicó. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Atienden en hoteles de Santa Cruz?",
        answer:
          "Algunas sí. Revisa en el perfil si atiende a domicilio u hotel y pregúntale por el traslado.",
      },
      {
        question: "¿Las escorts de Santa Cruz están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/san-fernando", label: "Escorts en San Fernando" },
      { href: "/escorts/rancagua", label: "Escorts en Rancagua" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "linares": {
    keywords: ["putas en linares", "escort linares chile", "sexo linares"],
    h1: "Escorts en Linares",
    paragraphs: [
      "Escorts verificadas en Linares, Región del Maule, con fotos reales, tarifa y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Linares y después Talca y Chillán. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts entre Linares y Talca?",
        answer:
          "Sí. Activa tu ubicación para ver las más cercanas y escríbeles directo desde su perfil.",
      },
      {
        question: "¿Las escorts de Linares están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/talca", label: "Escorts en Talca" },
      { href: "/escorts/chillan", label: "Escorts en Chillán" },
    ],
  },
  "valdivia": {
    keywords: ["putas valdivia", "prostitutas valdivia", "servicios sexuales valdivia", "escort valdivia"],
    h1: "Escorts en Valdivia",
    paragraphs: [
      "Escorts verificadas en Valdivia, Región de Los Ríos, con fotos reales, tarifa, horario y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Valdivia y después Osorno y Temuco. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts a domicilio en Valdivia?",
        answer:
          "Algunas atienden a domicilio u hotel. Revisa en cada perfil si va a domicilio y su tarifa.",
      },
      {
        question: "¿Las escorts de Valdivia están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/osorno", label: "Escorts en Osorno" },
      { href: "/escorts/temuco", label: "Escorts en Temuco" },
      { href: "/escorts/puerto-montt", label: "Escorts en Puerto Montt" },
    ],
  },
  "chiloe": {
    keywords: ["escort chiloe", "chiloé sexual", "sexo chiloe", "escort en castro"],
    h1: "Escorts en Chiloé",
    paragraphs: [
      "Escorts verificadas en Chiloé (Castro, Ancud y Quellón) con fotos reales, tarifa y contacto directo por WhatsApp.",
      "La lista se ordena por cercanía: primero Castro y el resto de la isla, y después Puerto Montt. Si hoy no hay perfiles publicados en la comuna, la lista muestra primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Hay escorts en Castro?",
        answer:
          "Castro es donde más perfiles hay en la isla. Activa tu ubicación para verlos ordenados por distancia.",
      },
      {
        question: "¿Las escorts de Chiloé están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/puerto-montt", label: "Escorts en Puerto Montt" },
      { href: "/escorts/osorno", label: "Escorts en Osorno" },
    ],
  },
};
