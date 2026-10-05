/**
 * SEO generado desde los exports de Semrush del 1 oct 2026 (Escorts-Santiago,
 * Putas y Publicar-escort: 837 keywords). Cada keyword quedó asignada a una
 * landing; la tabla completa está en docs/seo/semrush-2026-10-cobertura.csv.
 *
 * Regla para no mover lo que ya rankea: ninguna página existente cambia su
 * título, descripción ni texto. Las ciudades sin copy propio reciben texto
 * DEBAJO de la plantilla (CitySeoCopy sin title/description) y las landings
 * curadas existentes sólo suman keywords, párrafos y preguntas al final.
 *
 * Archivo generado: editar el contenido acá está bien, pero si se vuelve a
 * correr el generador con un export nuevo, revisar los cambios a mano.
 */
import type { CitySeoCopy, SeoFaq, TagLanding, SeoCopy } from "./escortSearchLandings";

export const ADULTS_ONLY =
  "UZEED es sólo para mayores de 18 años: todas las profesionales son adultas y verifican su identidad antes de publicar.";

/** Landings /escorts/[tag] nuevas, con copy propio. */
export const SEMRUSH_TAG_LANDINGS: TagLanding[] = [
  {
    slug: "baratas",
    name: "Escorts baratas",
    filter: { maxRate: 40000, gender: "FEMALE" },
    title: "Escorts Baratas en Santiago: Precios y Tarifas Reales",
    description: "Escorts y putas baratas en Santiago y Chile con tarifa de hasta $40.000. Precios reales publicados en cada perfil, fotos verificadas y contacto directo.",
    keywords: [
      "putas baratas",
      "escort baratas",
      "escort 10 mil",
      "escort en promocion",
      "escort 15 mil",
      "escort santiago 15000",
      "putas 10 mil santiago",
      "escort 20 mil la hora",
      "cuanto cuesta una prostituta",
      "escort santiago 10000",
      "cuanto gana una escort",
    ],
    h1: "Escorts baratas y precios reales",
    paragraphs: [
      "En esta página están sólo las escorts que publican una tarifa base de $40.000 o menos. El precio sale de la ficha de cada una, no de un aviso: lo que ves es lo que cobra por su servicio base.",
      "En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026), con una duración mínima típica de una hora. Las tarifas más bajas suelen ser por media hora o por servicios en su departamento; a domicilio u hotel el valor sube.",
      "Búsquedas como \"escort 10 mil\", \"escort 15 mil\" o \"escort 20 mil la hora\" casi nunca corresponden a una hora completa: revisa en cada perfil la duración y qué incluye antes de escribir.",
    ],
    faq: [
      {
        question: "¿Cuánto cuesta una escort o prostituta en Chile?",
        answer: "En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026). El valor depende de la duración, los servicios y si es en su lugar o a domicilio.",
      },
      {
        question: "¿Hay escorts de 10 mil o 15 mil pesos?",
        answer: "Son pocas y suelen ser por media hora o servicios básicos. Esta lista muestra todas las que cobran $40.000 o menos, ordenadas por cercanía si activas tu ubicación.",
      },
      {
        question: "¿Cuánto gana una escort en Chile?",
        answer: "Depende de cuántos clientes atiende y de su tarifa. Con la tarifa más común ($50.000 la hora) y sin intermediarios, todo lo que cobra es para ella: en UZEED no hay comisión por cita.",
      },
      {
        question: "¿Hay escorts en promoción?",
        answer: "Algunas publican promociones en su perfil o en sus historias. Escríbeles para preguntar por valores especiales.",
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
      { href: "/escorts/vip", label: "Escorts VIP" },
    ],
  },
  {
    slug: "whatsapp",
    name: "Escorts con WhatsApp",
    filter: { gender: "FEMALE" },
    title: "Números y WhatsApp de Escorts en Santiago y Chile",
    description: "Escorts con WhatsApp y número de contacto directo en Santiago y todo Chile. Anuncios con fotos reales y perfiles verificados: escríbeles sin intermediarios.",
    keywords: [
      "numeros de putas",
      "whatsapp de putas",
      "anuncios escort",
      "anuncios xxx",
      "whatsapp de prostitutas",
      "escort con whatsapp",
      "avisos sexo",
      "avisos eroticos",
      "anuncios sexo",
      "encuentros xxx",
      "numeros de mujeres calientes",
      "putas santiago whatsapp",
      "wassap de putas",
      "app para buscar putas",
      "conocer mujeres calientes",
      "encuentros con mujeres gratis",
    ],
    h1: "Escorts con WhatsApp y contacto directo",
    paragraphs: [
      "Todas las escorts de UZEED tienen contacto directo: desde cada perfil puedes abrir su WhatsApp o escribirle por el chat de la plataforma. No hay agencias ni números de intermediarios.",
      "A diferencia de los avisos eróticos y anuncios sueltos con un número y una foto, acá cada número es de una profesional verificada, con fotos reales, tarifa y horario publicados.",
      "Para no perder tiempo, escribe con tu comuna, la hora y el servicio que buscas. Muchas tienen respuestas rápidas con su tarifa y ubicación.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro números de WhatsApp de escorts?",
        answer: "En el perfil de cada escort de esta lista. Toca el botón de WhatsApp y le escribes directo, sin intermediarios.",
      },
      {
        question: "¿Los números son reales?",
        answer: `Sí. El número está asociado a una cuenta verificada con identidad y fotos reales. ${ADULTS_ONLY}`,
      },
      {
        question: "¿Es lo mismo que los anuncios eróticos?",
        answer: "No: en UZEED no hay avisos anónimos. Cada anuncio es un perfil verificado, con fotos, tarifa y reseñas.",
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/baratas", label: "Escorts baratas" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
      { href: "/escorts/trans", label: "Escorts trans" },
    ],
  },
  {
    slug: "vip",
    name: "Escorts VIP",
    filter: { gender: "FEMALE" },
    title: "Escort VIP y de Lujo en Santiago y Chile",
    description: "Escorts VIP y de lujo verificadas en Santiago, Viña del Mar, Concepción y todo Chile. Perfiles destacados con fotos reales, discreción y contacto directo.",
    keywords: [
      "escort vip",
      "putas finas",
      "escorts famosas",
      "sexo vip",
      "escort de lujo en chile",
    ],
    h1: "Escorts VIP y de lujo",
    paragraphs: [
      "Los perfiles destacados de UZEED aparecen primero en esta lista: escorts VIP con fotos profesionales verificadas, ficha completa y atención en departamentos privados, hoteles o a domicilio.",
      "Una escort de lujo se distingue por la discreción, la presentación y el tiempo que dedica: muchas ofrecen citas largas, cenas o toda la noche. Revisa en cada perfil su tarifa y qué incluye.",
      "Si buscas escort VIP en Viña del Mar, Concepción, Antofagasta, Talca o La Serena, entra a la página de tu ciudad o activa tu ubicación.",
    ],
    faq: [
      {
        question: "¿Qué es una escort VIP?",
        answer: "Una acompañante de alto nivel: perfil completo, fotos profesionales, discreción y citas sin apuro. En UZEED los perfiles destacados aparecen primero.",
      },
      {
        question: "¿Cuánto cobra una escort VIP?",
        answer: "Más que el promedio ($50.000 la hora en UZEED). Cada una publica su tarifa en el perfil.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/las-condes", label: "Escorts en Las Condes" },
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
    ],
  },
  {
    slug: "chile",
    name: "Escorts en Chile",
    filter: { gender: "FEMALE" },
    title: "Putas en Chile y Servicios Sexuales: Escorts Verificadas",
    description: "Escorts, putas y acompañantes verificadas en todo Chile: Santiago, Viña, Concepción, Antofagasta y más. Qué dice la ley sobre la prostitución en Chile.",
    keywords: [
      "putas chile",
      "servicios sexuales",
      "prostitución en chile",
      "servicios sexuales chile",
      "acompañantes chile",
      "prostitucion en chile",
      "prostitutas de chile",
    ],
    h1: "Escorts y servicios sexuales en Chile",
    paragraphs: [
      "Directorio de escorts, prostitutas y acompañantes independientes de todo Chile, con fotos reales, tarifa y contacto directo. Las ciudades con más perfiles son Santiago, Viña del Mar, Concepción, Antofagasta, Talca y Temuco.",
      "La prostitución en Chile no es delito cuando la ejercen personas adultas por decisión propia. Sí están prohibidos los prostíbulos o casas de tolerancia (Código Sanitario) y son delitos la explotación, la trata y cualquier participación de menores de edad.",
      "Por eso en UZEED sólo publican profesionales independientes, mayores de edad y verificadas, que trabajan por su cuenta y fijan sus propias tarifas.",
    ],
    faq: [
      {
        question: "¿Es legal la prostitución en Chile?",
        answer: "Ejercerla siendo adulta y de forma independiente no es delito. Están prohibidos los prostíbulos y son delitos la explotación, la trata y todo lo que involucre a menores.",
      },
      {
        question: "¿Dónde hay más escorts en Chile?",
        answer: "En Santiago, seguido de Viña del Mar, Concepción, Antofagasta y Talca. Entra a la página de tu ciudad para ver las más cercanas.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
      { href: "/escorts/antofagasta", label: "Escorts en Antofagasta" },
      { href: "/escorts/talca", label: "Escorts en Talca" },
    ],
  },
  {
    slug: "night-club",
    name: "Escorts en vez de night club",
    filter: { gender: "FEMALE" },
    title: "Night Club en Santiago: Alternativa con Escorts Verificadas",
    description: "¿Buscas night club, cabaret o strip club en Santiago? Escorts verificadas que atienden en privado en Providencia, Santiago Centro y Las Condes.",
    keywords: [
      "night club santiago",
      "casa de putas",
      "club nocturno santiago",
      "mejores night club santiago",
      "night club providencia",
      "strip clubs in santiago chile",
      "night club santiago centro",
      "strip clubs in santiago",
      "prostibulos en santiago",
      "prostibulos en chile",
      "cabaret santiago",
      "night club para mujeres santiago",
      "night club santiago chile",
      "toples en santiago",
      "club nocturno providencia",
      "puticlub chile",
      "casa de prostibulo",
      "strip club chile",
    ],
    h1: "Night clubs, cabarets y escorts en Santiago",
    paragraphs: [
      "Muchos buscan un night club, club nocturno, cabaret o strip club en Santiago para conocer chicas. UZEED no es un local: es un directorio de escorts independientes que atienden en privado, en su departamento, en tu hotel o a domicilio.",
      "Los night clubs y toples de Santiago se concentran en Santiago Centro y Providencia. Las escorts de UZEED también: puedes ver perfiles cerca de metro Santa Lucía, Baquedano, Los Leones y Tobalaba, con fotos reales y tarifa publicada.",
      "Los prostíbulos y casas de putas están prohibidos en Chile por el Código Sanitario. Las profesionales de UZEED trabajan de forma independiente y verificada.",
    ],
    faq: [
      {
        question: "¿Cuáles son los mejores night club de Santiago?",
        answer: "UZEED no reseña locales nocturnos. Si lo que buscas es compañía, acá tienes escorts verificadas en Providencia y Santiago Centro, con contacto directo.",
      },
      {
        question: "¿Hay prostíbulos o casas de putas en Santiago?",
        answer: "Los prostíbulos están prohibidos en Chile. Las escorts de UZEED son independientes y atienden en su departamento, hotel o a domicilio.",
      },
      {
        question: "¿Hay night club para mujeres?",
        answer: "Para mujeres y parejas, revisa la sección de escorts hombres: acompañantes masculinos verificados en Santiago.",
      },
    ],
    related: [
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/hombres", label: "Escorts hombres" },
      { href: "/escorts/vip", label: "Escorts VIP" },
    ],
  },
  {
    slug: "encuentros-sexuales",
    name: "Encuentros sexuales",
    filter: { gender: "FEMALE" },
    title: "Encuentros Sexuales y Sexo Casual en Santiago",
    description: "Encuentros sexuales y sexo casual en Santiago y Chile con escorts verificadas: sin apps de citas, sin perfiles falsos, con contacto directo y tarifa clara.",
    keywords: [
      "putas gratis",
      "encuentros sexuales",
      "mujeres sexo",
      "mujeres buscando sexo",
      "sexo gratis santiago",
      "sexo casual santiago",
      "encuentros casuales santiago",
      "encuentros sexuales santiago",
      "sexo gratis chile",
      "busco sexo",
      "sexo casual chile",
      "follar gratis",
      "maduras buscando sexo",
      "encuentros casuales chile",
      "mujer busca sexo santiago",
      "paginas para tener sexo",
      "encuentros sexuales chile",
      "mujeres para sexo",
      "sexo cerca de mi",
      "mujeres que quieren follar",
      "citas sexuales",
      "sexo de chile",
      "app para tener sexo",
      "mujeres buscan sexo gratis",
      "citas para sexo",
      "app para sexo",
      "busco sexo gratis",
      "mujeres para tener sexo",
      "aplicaciones para tener sexo",
      "app sexo",
      "busco sexo casual",
      "citas de sexo",
      "mujeres que quieren sexo",
      "escorts gratis",
      "mujer busca sexo casual",
      "sexso mujeres",
      "mujeres casadas para relacion informal",
      "chilenas en busca de sexo",
      "encuentros porno",
      "páginas para encuentros casuales",
      "app sexo chile",
      "app para tener sexo chile",
      "app de citas hot",
      "paginas de citas calientes",
      "encuentros casuales santiago chile",
      "citas sexuales chile",
      "citas sexo chile",
      "encuentros sexuales gratis",
      "paginas de sexo casual",
      "paginas para encontrar sexo",
      "sitios para sexo",
      "encuentros intimos",
      "citas sexuales en santiago",
      "citas para sexo gratis",
      "citas sexo gratis",
      "aplicacion sexo casual",
      "busco sexo sin compromiso",
    ],
    h1: "Encuentros sexuales y sexo casual",
    paragraphs: [
      "Si buscas encuentros sexuales o sexo casual en Santiago, las apps y páginas de citas están llenas de perfiles falsos y conversaciones que no terminan en nada. En UZEED hablas directo con escorts verificadas que atienden hoy.",
      "Seamos claros: UZEED no es una app de sexo gratis. Las profesionales cobran por su tiempo y lo publican en su perfil. Ver perfiles, escribirles y coordinar no cuesta nada.",
      "Cada perfil muestra fotos reales, servicios, tarifa y si recibe en su departamento o va a domicilio. Filtra por tu comuna para encontrar algo cerca hoy mismo.",
    ],
    faq: [
      {
        question: "¿Cuál es la mejor app para tener sexo en Chile?",
        answer: "Las apps de citas no garantizan nada. Si buscas un encuentro seguro, en UZEED hablas con escorts verificadas, con tarifa y disponibilidad claras.",
      },
      {
        question: "¿Hay sexo gratis en UZEED?",
        answer: "No. Las profesionales cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Puedo tener un encuentro hoy en Santiago?",
        answer: "Sí. Ordena por \"disponible ahora\" y escribe a las que están conectadas en este momento.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/mujer-busca-hombre", label: "Mujer busca hombre" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
    ],
  },
  {
    slug: "mujer-busca-hombre",
    name: "Mujer busca hombre",
    filter: { gender: "FEMALE" },
    title: "Mujer Busca Hombre en Santiago y Chile",
    description: "Mujeres que buscan hombres en Santiago y Chile: escorts y acompañantes verificadas, maduras y jóvenes adultas, con fotos reales y contacto directo.",
    keywords: [
      "mujer busca hombre",
      "mujer busca hombre chile",
      "buscar pareja chile",
      "busco mujer",
      "mujeres maduras solteras buscando pareja",
      "mujeres solteras en santiago",
      "chicas en santiago",
      "parejas chile",
      "mujer mayor busca joven",
      "madura busca hombre",
      "mujer busca hombre en santiago centro",
      "mujer madura busca hombre santiago",
      "mujer busca amistad santiago",
      "mujer busca aventura",
      "mujer casada busca hombre",
      "mujer mayor busca hombre",
      "mujeres en busca de hombres",
      "chica busca chico en chile",
      "mujer busca hombre para sexo",
      "mujeres buscan pareja en chile",
      "mujeres cerca",
      "mujer madura busca joven",
      "mujeres para el momento",
      "dama busca hombre",
      "mujeres q buscan hombres",
      "encontrar pareja en chile",
      "paginas para buscar pareja en chile",
      "mujer busca joven",
    ],
    h1: "Mujer busca hombre en Santiago",
    paragraphs: [
      "Los avisos de \"mujer busca hombre\" en páginas de clasificados casi siempre son falsos o terminan en una estafa. En UZEED las mujeres que publican son acompañantes verificadas: sabes quién es, cuánto cobra y dónde atiende.",
      "Hay perfiles de mujeres maduras, casadas que buscan discreción y chicas que buscan algo casual con hombres mayores o jóvenes. Todas son adultas y profesionales independientes.",
      "Si lo que buscas es pareja estable, UZEED no es una página de citas: es un directorio de acompañantes que cobran por su tiempo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro mujeres que buscan hombres en Santiago?",
        answer: "En esta página: acompañantes verificadas de Santiago, con contacto directo. Activa tu ubicación para ver las más cercanas.",
      },
      {
        question: "¿Hay mujeres maduras que buscan hombres jóvenes?",
        answer: "Sí, revisa la sección de escorts maduras: mujeres de 40 años o más, verificadas.",
      },
      {
        question: "¿Es una página de citas?",
        answer: "No. Es un directorio de acompañantes profesionales que cobran por sus servicios.",
      },
    ],
    related: [
      { href: "/escorts/maduras", label: "Escorts maduras" },
      { href: "/escorts/encuentros-sexuales", label: "Encuentros sexuales" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  {
    slug: "packs",
    name: "Packs y videos de escorts",
    filter: { serviceTags: ["packs"] },
    title: "Videos y Fotos de Escorts Chilenas: Packs Reales",
    description: "Videos, fotos y packs de escorts chilenas reales y verificadas. Compra contenido directo a la creadora, sin páginas falsas ni videos robados.",
    keywords: [
      "putas xxx",
      "videos de putas",
      "porno putas",
      "escort con videos",
      "videos xxx putas",
      "putas follando",
      "porno prostitutas",
      "sexo con putas",
      "putas desnudas",
      "putas culiando",
      "escort chile videos",
      "videos scort",
      "putas chilenas xxx",
      "fotos de putas",
      "videos putasxxx",
      "putas cachondas",
      "prostitutas videos",
      "porno santiago",
      "xxx santiago",
      "videos de escort chilenas",
      "videos putas gratis",
      "damas xxx",
      "fotos de escort",
      "imagenes de putas",
      "putas calientes xxx",
      "videos de maduras com",
      "escort porno",
      "sexo con prostitutas",
      "videos de putas chilenas",
      "escort santiago videos",
      "damas de compañia xxx",
      "putas chilenas culiando",
      "prostitutas desnudas",
      "putas teniendo sexo",
      "xxx putas gratis",
      "prostituta xvideos",
      "putas chilenas follando",
      "puras xxx",
      "putas putas",
      "putas hd",
      "porno putas chilenas",
      "mujeres maduras videos gratis",
      "escort follando",
      "pornografia en santiago",
      "pautas xxx",
      "videosdeputas xxx",
      "videos de maduras gratis",
      "videos de mujeres maduras",
      "prostitutas en accion",
      "escort chilena porno",
      "xxx chicas putas",
      "escort imagenes",
      "ver imagenes de putas",
      "prostitutas teniendo sexo",
      "porno escort chile",
      "xxx chile santiago",
      "putas en accion",
      "videos de prostitutas chilenas",
      "puteros videos",
      "putas follando gratis",
      "mujeres putas sexo",
      "escor xxx",
      "video sexo escort",
      "damas porno",
    ],
    h1: "Videos, fotos y packs de escorts chilenas",
    paragraphs: [
      "Las escorts de esta lista venden packs de fotos y videos propios. Es contenido real, hecho por ellas y vendido directo: no son videos robados ni de páginas porno que usan nombres de escorts chilenas.",
      "Puedes ver las fotos públicas de cada perfil y comprar packs o suscribirte a su contenido en U-Mate, la sección de creadoras de UZEED. Muchas también hacen videollamadas.",
      "Si buscas una escort con videos, revisa la galería de cada perfil: si sube videos, los verás ahí antes de contactarla.",
    ],
    faq: [
      {
        question: "¿Los videos de escorts chilenas son reales?",
        answer: `Sí. Cada pack lo vende la misma escort desde su cuenta verificada. ${ADULTS_ONLY}`,
      },
      {
        question: "¿Dónde veo fotos de escorts sin censura?",
        answer: "Las fotos públicas están en cada perfil. El contenido explícito se vende en packs o por suscripción, directo a la creadora.",
      },
      {
        question: "¿Hay videos de maduras?",
        answer: "Sí, varias escorts maduras venden packs. Revisa también la sección de escorts maduras.",
      },
    ],
    related: [
      { href: "/umate", label: "U-Mate: creadoras" },
      { href: "/escorts/videollamada", label: "Escorts con videollamada" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
      { href: "/escorts/chilena", label: "Escorts chilenas" },
    ],
  },
  {
    slug: "caliente",
    name: "Escorts calientes",
    filter: { profileTags: ["caliente"] },
    title: "Putas Calientes y Ricas en Santiago - Fotos Reales",
    description: "Escorts calientes, ardientes y cachondas en Santiago y Chile. Las mejores putas verificadas, con fotos reales, servicios y contacto directo por WhatsApp.",
    keywords: [
      "putas calientes",
      "putas ricas",
      "las mejores putas",
      "putas ardientes",
      "las putitas mas ricas",
    ],
    h1: "Escorts calientes y ardientes",
    paragraphs: [
      "Escorts que se describen como calientes en su perfil: apasionadas, sin apuro y con buena onda. Cada ficha tiene fotos reales verificadas, servicios, tarifa y reseñas de clientes.",
      "¿Buscas a las mejores? Ordena por destacadas para ver primero las mejor evaluadas, o por \"disponible ahora\" para las que están atendiendo en este momento.",
    ],
    faq: [
      {
        question: "¿Cómo sé cuáles son las mejores escorts?",
        answer: "Mira las reseñas y calificaciones de cada perfil: las dejan clientes que ya la conocieron.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/culona", label: "Escorts culonas" },
      { href: "/escorts/tetona", label: "Escorts tetonas" },
      { href: "/escorts/vip", label: "Escorts VIP" },
    ],
  },
  {
    slug: "tetona",
    name: "Escorts tetonas",
    filter: { profileTags: ["tetona"] },
    title: "Escort Tetona en Santiago - Fotos Reales",
    description: "Escorts tetonas verificadas en Santiago y Chile. Fotos reales, medidas, servicios y tarifa en cada perfil. Contacto directo por WhatsApp.",
    keywords: [
      "escort tetona santiago",
    ],
    h1: "Escorts tetonas",
    paragraphs: [
      "Escorts que se describen como tetonas en su perfil, con fotos reales verificadas. En cada ficha verás medidas, estatura, servicios, tarifa y si atiende en su lugar o a domicilio.",
      "Activa tu ubicación para ver primero las más cercanas.",
    ],
    faq: [
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/culona", label: "Escorts culonas" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/caliente", label: "Escorts calientes" },
    ],
  },
  {
    slug: "trios",
    name: "Escorts para tríos",
    filter: { serviceTags: ["trios"] },
    title: "Escort para Trío y Parejas en Santiago",
    description: "Escorts para tríos, parejas y orgías en Santiago. Escort dual, chicas que atienden parejas y tríos HMM o MHM. Perfiles verificados y contacto directo.",
    keywords: [
      "escort trio",
      "pareja escort",
      "escort dual",
      "escort para trio",
      "orgias en santiago",
      "pareja escort santiago",
      "sexo trío santiago",
      "orgias santiago chile",
    ],
    h1: "Escorts para tríos y parejas",
    paragraphs: [
      "Escorts que marcaron tríos entre sus servicios: atienden parejas, tríos con otra chica (escort dual) o con dos hombres. Cada perfil indica qué tipo de trío hace y la tarifa.",
      "Si buscas pareja escort para una orgía o un encuentro en grupo en Santiago, escríbeles con el detalle: muchas trabajan con una amiga y pueden armar el encuentro.",
    ],
    faq: [
      {
        question: "¿Cuánto cuesta un trío con escort?",
        answer: "Cada escort fija su valor; con dos chicas se paga a cada una. Revisa la tarifa en el perfil y confírmala al escribir.",
      },
      {
        question: "¿Atienden parejas?",
        answer: "Muchas sí: lo indica el perfil, y si no, pregúntalo al contactarla.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/anal", label: "Escorts con anal" },
      { href: "/hombres", label: "Escorts hombres" },
    ],
  },
  {
    slug: "sexo-oral",
    name: "Escorts sexo oral",
    filter: { serviceTags: ["sexo-oral"] },
    title: "Escort Sexo Oral en Santiago",
    description: "Escorts que ofrecen sexo oral en Santiago y Chile. Perfiles verificados con fotos reales, servicios detallados y tarifa. Contacto directo por WhatsApp.",
    keywords: [
      "sexo oral santiago",
      "scort oral",
    ],
    h1: "Escorts con sexo oral",
    paragraphs: [
      "Escorts que marcaron sexo oral entre sus servicios. En cada perfil verás si es con o sin protección, si tiene costo adicional y el resto de sus servicios.",
      "Confirma siempre las condiciones al escribirle: cada profesional decide qué ofrece.",
    ],
    faq: [
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/anal", label: "Escorts con anal" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/trios", label: "Escorts para tríos" },
    ],
  },
  {
    slug: "chilena",
    name: "Escorts chilenas",
    filter: { profileTags: ["chilena"] },
    title: "Putas Chilenas: Escorts Chilenas Verificadas",
    description: "Putas y escorts chilenas verificadas en Santiago y todo Chile. Fotos reales, tarifas claras y contacto directo por WhatsApp.",
    keywords: [
      "putas chilenas",
      "sexo con putas chilenas",
    ],
    h1: "Escorts chilenas",
    paragraphs: [
      "Escorts que se identifican como chilenas en su perfil. Cada una marca su nacionalidad al publicar, así que la lista se va completando a medida que más perfiles la agregan.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts chilenas en Santiago?",
        answer: "Las escorts chilenas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "colombiana",
    name: "Escorts colombianas",
    filter: { profileTags: ["colombiana"] },
    title: "Escorts y Putas Colombianas en Santiago",
    description: "Escorts colombianas verificadas en Santiago y Chile. Fotos reales, servicios y tarifa en cada perfil. Contacto directo por WhatsApp.",
    keywords: [
      "putas colombianas",
      "escort colombianas",
      "escort colombianas en chile",
      "escort colombianas en santiago",
      "putas colombianas en santiago",
      "putas colombianas en chile",
      "prepagos colombianas en chile",
      "putas colombianas en santiago de chile",
    ],
    h1: "Escorts colombianas",
    paragraphs: [
      "Escorts colombianas que viven y atienden en Chile. Cada una marca su nacionalidad en el perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts colombianas en Santiago?",
        answer: "Las escorts colombianas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "venezolana",
    name: "Escorts venezolanas",
    filter: { profileTags: ["venezolana"] },
    title: "Escorts Venezolanas en Santiago y Chile",
    description: "Escorts y putas venezolanas verificadas en Santiago y todo Chile. Fotos reales, servicios, tarifa y contacto directo por WhatsApp.",
    keywords: [
      "putas venezolanas",
      "escort venezolanas en chile",
      "venezolana escort",
      "escort venezolanas en santiago",
      "putas venezolanas chile",
      "chicas escort venezolanas",
    ],
    h1: "Escorts venezolanas",
    paragraphs: [
      "Escorts venezolanas que atienden en Chile. Cada una marca su nacionalidad en el perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts venezolanas en Santiago?",
        answer: "Las escorts venezolanas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "argentina",
    name: "Escorts argentinas",
    filter: { profileTags: ["argentina"] },
    title: "Escorts Argentinas en Santiago de Chile",
    description: "Escorts y putas argentinas verificadas que atienden en Santiago y Chile. Fotos reales, tarifa y contacto directo por WhatsApp.",
    keywords: [
      "escort argentina",
      "putas argentinas",
      "escort argentina en santiago",
      "prostitutas argentinas",
      "escort arg",
      "las mejores putas argentinas",
    ],
    h1: "Escorts argentinas",
    paragraphs: [
      "Escorts argentinas que atienden en Chile. Cada una marca su nacionalidad en el perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts argentinas en Santiago?",
        answer: "Las escorts argentinas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "peruana",
    name: "Escorts peruanas",
    filter: { profileTags: ["peruana"] },
    title: "Escorts Peruanas en Santiago y Chile",
    description: "Escorts y putas peruanas verificadas en Santiago y Chile. Fotos reales, servicios y contacto directo por WhatsApp.",
    keywords: [
      "escort peruanas en chile",
      "escort peruanas en santiago",
      "putas peruanas en santiago",
    ],
    h1: "Escorts peruanas",
    paragraphs: [
      "Escorts peruanas que atienden en Chile. Cada una marca su nacionalidad en el perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts peruanas en Santiago?",
        answer: "Las escorts peruanas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "asiatica",
    name: "Escorts asiáticas",
    filter: { profileTags: ["asiatica"] },
    title: "Escort Asiática y Japonesa en Santiago",
    description: "Escorts asiáticas, japonesas, chinas y orientales verificadas en Santiago y Chile. Fotos reales, tarifa y contacto directo.",
    keywords: [
      "escort japonesa",
      "escort asiatica",
      "escort oriental",
      "escort asiatica chile",
      "escort asiatica santiago",
      "escort japonesa en santiago",
      "putas asiaticas en santiago",
      "escort china en chile",
    ],
    h1: "Escorts asiáticas",
    paragraphs: [
      "Escorts asiáticas y orientales (japonesas, chinas, coreanas) que atienden en Santiago y Chile. Cada una lo marca en su perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts asiáticas en Santiago?",
        answer: "Las escorts asiáticas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "negra",
    name: "Escorts negras",
    filter: { profileTags: ["negra"] },
    title: "Escorts Negras en Chile y Santiago",
    description: "Escorts negras y afrodescendientes verificadas en Santiago y Chile. Fotos reales, servicios, tarifa y contacto directo.",
    keywords: [
      "escort negras",
      "escort negras en chile",
    ],
    h1: "Escorts negras",
    paragraphs: [
      "Escorts negras y afrodescendientes que atienden en Santiago y el resto de Chile. Cada una lo marca en su perfil.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts negras en Santiago?",
        answer: "Las escorts negras publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
  {
    slug: "embarazada",
    name: "Escorts embarazadas",
    filter: { profileTags: ["embarazada"] },
    title: "Escort Embarazada en Santiago",
    description: "Escorts embarazadas verificadas en Santiago. Perfiles con fotos reales, servicios, tarifa y contacto directo por WhatsApp.",
    keywords: [
      "escort embarazada",
      "escort embarazada santiago",
      "putas embarazadas en santiago",
    ],
    h1: "Escorts embarazadas",
    paragraphs: [
      "Escorts embarazadas que atienden en Santiago. Es una búsqueda poco común: cada profesional lo marca en su perfil mientras corresponde.",
      "Todas son adultas y están verificadas: fotos reales, tarifa y contacto directo. Si hoy hay pocas, revisa también el directorio completo de Santiago.",
    ],
    faq: [
      {
        question: "¿Hay escorts embarazadas en Santiago?",
        answer: "Las escorts embarazadas publicadas en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
      {
        question: "¿Los perfiles están verificados?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/whatsapp", label: "Escorts con WhatsApp" },
    ],
  },
];

/** Copy de ciudades que no tenían (se muestra debajo del texto de plantilla). */
export const SEMRUSH_CITY_SEO: Record<string, CitySeoCopy> = {
  "antofagasta": {
    keywords: [
      "escort norte",
      "escort antofagasta",
      "sexo antofagasta",
      "putas antofagasta",
      "damas de compañia antofagasta",
      "servicios sexuales antofagasta",
      "escort norte antofagasta",
      "prostitutas antofagasta",
      "datos escort antofagasta",
      "putas antofa",
      "erotico antofagasta",
      "escort vip antofagasta",
      "chicas escort antofagasta",
      "servicios eróticos antofagasta",
      "servicios personales antofagasta",
      "sexo casual antofagasta",
      "sexo norte antofagasta",
      "escort antofagasta sector sur",
      "sexo ocacional antofagasta",
      "escort madura antofagasta",
      "milf antofagasta",
      "encuentros sexuales antofagasta",
    ],
    h1: "Escorts en Antofagasta",
    paragraphs: [
      "Escorts, putas, prostitutas, damas de compañía y chicas escort verificadas en Antofagasta (antofa, zona norte), Región de Antofagasta: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro, el sector sur (Jardines del Sur, Playa Blanca) y el norte de la ciudad. La lista se ordena por cercanía: primero Antofagasta y después Calama y Copiapó.",
      "¿Buscas algo específico en Antofagasta? Revisa también las escorts VIP y maduras desde los enlaces de abajo.",
      "Si buscas sexo gratis o casual en Antofagasta: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Antofagasta?",
        answer: "En esta página: perfiles verificados de Antofagasta ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Antofagasta?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Antofagasta?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Antofagasta están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/calama", label: "Escorts en Calama" },
      { href: "/escorts/copiapo", label: "Escorts en Copiapó" },
      { href: "/escorts/vip", label: "Escorts VIP" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
    ],
  },
  "talca": {
    keywords: [
      "escort talca",
      "putas talca",
      "sexo talca",
      "damas de compañia talca",
      "prostitutas talca",
      "servicios sexuales talca",
      "sexso talca",
      "eroticos talca",
      "escort vip talca",
      "sexo gratis talca",
      "escort maule",
      "sexo casual talca",
      "mujeres de compañia talca",
      "scord talca",
      "casa de putas talca",
      "mujeres para sexo en talca",
    ],
    h1: "Escorts en Talca",
    paragraphs: [
      "Escorts, putas, prostitutas y damas de compañía verificadas en Talca, Región del Maule: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Talca, el sector oriente y el resto de la Región del Maule. La lista se ordena por cercanía: primero Talca y después Curicó, Linares y San Javier.",
      "¿Buscas algo específico en Talca? Revisa también las escorts VIP desde los enlaces de abajo.",
      "Si buscas sexo gratis o casual en Talca: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Talca?",
        answer: "En esta página: perfiles verificados de Talca ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Talca?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Talca?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Talca están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/curico", label: "Escorts en Curicó" },
      { href: "/escorts/linares", label: "Escorts en Linares" },
      { href: "/escorts/san-javier", label: "Escorts en San Javier" },
      { href: "/escorts/vip", label: "Escorts VIP" },
    ],
  },
  "concepcion": {
    keywords: [
      "escort concepcion",
      "putas conce",
      "putas en concepción",
      "sexo concepcion",
      "prostitutas concepcion",
      "damas de compañia concepcion",
      "escort en conce",
      "sexo conce",
      "servicios sexuales concepcion",
      "escort vip concepcion",
      "escort madura concepcion",
      "acompañantes en concepcion",
      "escort en concepcion chile",
      "damas de compañia conce",
      "encuentros sexuales conce",
      "chicas escort concepcion",
      "chicas sexo concepcion",
      "milf concepcion",
      "scor concepcion",
      "paginas de escort en concepcion",
      "escort bio bio",
      "portal escort concepcion",
      "sexo gratis concepcion",
      "mujeres para sexo en concepcion",
      "servicio escort concepcion",
      "sexo casual concepción",
      "putas concepcion chile",
      "escort a domicilio concepcion",
      "encuentros sexuales concepcion",
    ],
    h1: "Escorts en Concepción",
    paragraphs: [
      "Escorts, putas, prostitutas, damas de compañía, chicas escort y acompañantes verificadas en Concepción (Conce, Bío Bío), Región del Biobío: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Conce, el barrio universitario, Talcahuano, Chiguayante y San Pedro de la Paz. La lista se ordena por cercanía: primero Concepción y después Talcahuano, Chiguayante, Los Ángeles y Chillán.",
      "¿Buscas algo específico en Concepción? Revisa también las escorts VIP, maduras y a domicilio desde los enlaces de abajo.",
      "Si buscas sexo gratis o casual en Concepción: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Concepción?",
        answer: "En esta página: perfiles verificados de Concepción ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Concepción?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Concepción?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Concepción están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/talcahuano", label: "Escorts en Talcahuano" },
      { href: "/escorts/chiguayante", label: "Escorts en Chiguayante" },
      { href: "/escorts/los-angeles", label: "Escorts en Los Ángeles" },
      { href: "/escorts/chillan", label: "Escorts en Chillán" },
      { href: "/escorts/vip", label: "Escorts VIP" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "vina-del-mar": {
    keywords: [
      "escort viña",
      "escort viña del mar",
      "sexo viña",
      "putas viña",
      "escort v region",
      "sexo en viña del mar",
      "escort vina",
      "putas viña del mar",
      "damas de compañia en viña del mar",
      "prostitutas viña del mar",
      "escort quinta region",
      "damas de compañia viña",
      "escort reñaca",
      "escort v",
      "prostitutas en viña",
      "servicios sexuales viña del mar",
      "acompañantes viña del mar",
      "escort vip viña",
      "escort vip viña del mar",
      "escort playa",
      "escort madura viña",
      "servicios escort viña del mar",
      "escort a domicilio viña del mar",
    ],
    h1: "Escorts en Viña del Mar",
    paragraphs: [
      "Escorts, putas, prostitutas, damas de compañía y acompañantes verificadas en Viña del Mar (Viña, V Región, Quinta Región), Región de Valparaíso: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Viña, Reñaca, Concón y el borde costero de la Quinta Región. La lista se ordena por cercanía: primero Viña del Mar y después Valparaíso, Concón, Quillota y San Antonio.",
      "¿Buscas algo específico en Viña del Mar? Revisa también las escorts VIP, maduras y a domicilio desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Viña del Mar?",
        answer: "En esta página: perfiles verificados de Viña del Mar ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Viña del Mar?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Viña del Mar están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/valparaiso", label: "Escorts en Valparaíso" },
      { href: "/escorts/concon", label: "Escorts en Concón" },
      { href: "/escorts/quillota", label: "Escorts en Quillota" },
      { href: "/escorts/san-antonio", label: "Escorts en San Antonio" },
      { href: "/escorts/vip", label: "Escorts VIP" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "valparaiso": {
    keywords: [
      "putas valparaíso",
      "sexo valparaiso",
      "escorts valparaiso",
      "putas valpo",
      "damas de compañia valparaiso",
      "sexo valpo",
      "sexo v region",
      "servicios sexuales valparaiso",
      "prostitutas en valparaiso",
      "escort madura valparaiso",
      "escort playa ancha",
      "encuentros sexuales valparaiso",
      "prostitutas quinta region",
    ],
    h1: "Escorts en Valparaíso",
    paragraphs: [
      "Escorts, putas, prostitutas y damas de compañía verificadas en Valparaíso (Valpo, V Región), Región de Valparaíso: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el plan, Playa Ancha y los cerros de Valpo, y a minutos en Viña del Mar. La lista se ordena por cercanía: primero Valparaíso y después Viña del Mar y Concón.",
      "¿Buscas algo específico en Valparaíso? Revisa también las escorts maduras desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Valparaíso?",
        answer: "En esta página: perfiles verificados de Valparaíso ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Valparaíso?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Valparaíso están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/concon", label: "Escorts en Concón" },
      { href: "/escorts/maduras", label: "Escorts maduras" },
    ],
  },
  "puerto-montt": {
    keywords: [
      "escort puerto montt",
      "sexo puerto montt",
      "putas en puerto montt",
      "prostitutas puerto montt",
      "servicios sexuales puerto montt",
      "eróticos puerto montt",
      "sexo gratis en puerto montt",
      "servicios personales en puerto montt",
      "sexso puerto montt",
    ],
    h1: "Escorts en Puerto Montt",
    paragraphs: [
      "Escorts, putas y prostitutas verificadas en Puerto Montt, Región de Los Lagos: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Puerto Montt, Pelluco y Alerce, y Puerto Varas a 20 minutos. La lista se ordena por cercanía: primero Puerto Montt y después Puerto Varas, Osorno y Chiloé.",
      "Si buscas sexo gratis o casual en Puerto Montt: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Puerto Montt?",
        answer: "En esta página: perfiles verificados de Puerto Montt ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Puerto Montt?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Puerto Montt?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Puerto Montt están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/puerto-varas", label: "Escorts en Puerto Varas" },
      { href: "/escorts/osorno", label: "Escorts en Osorno" },
      { href: "/escorts/chiloe", label: "Escorts en Chiloé" },
    ],
  },
  "curico": {
    keywords: [
      "escort curico",
      "putas curico",
      "prostitutas curico",
      "chicas escort curico",
      "servicios sexuales curico",
      "putas curicanas",
    ],
    h1: "Escorts en Curicó",
    paragraphs: [
      "Escorts, putas, prostitutas y chicas escort verificadas en Curicó, Región del Maule: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Curicó y alrededores, entre Talca y San Fernando. La lista se ordena por cercanía: primero Curicó y después Talca y San Fernando.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Curicó?",
        answer: "En esta página: perfiles verificados de Curicó ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Curicó?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Curicó están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/talca", label: "Escorts en Talca" },
      { href: "/escorts/san-fernando", label: "Escorts en San Fernando" },
    ],
  },
  "temuco": {
    keywords: [
      "putas temuco",
      "prostitutas temuco",
      "chicas sexo temuco",
      "mujer busca sexo temuco",
      "numeros de putas en temuco",
      "mujeres para tener sexo en temuco",
    ],
    h1: "Escorts en Temuco",
    paragraphs: [
      "Escorts, putas y prostitutas verificadas en Temuco, Región de La Araucanía: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en el centro de Temuco, Avenida Alemania y Padre Las Casas. La lista se ordena por cercanía: primero Temuco y después Villarrica, Valdivia y Osorno.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Temuco?",
        answer: "En esta página: perfiles verificados de Temuco ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Temuco?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Temuco están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/villarrica", label: "Escorts en Villarrica" },
      { href: "/escorts/valdivia", label: "Escorts en Valdivia" },
      { href: "/escorts/osorno", label: "Escorts en Osorno" },
    ],
  },
  "rancagua": {
    keywords: [
      "putas rancagua",
      "prostitutas rancagua",
      "rancagua escort",
      "servicios sexuales rancagua",
      "escorts en rancagua",
      "chicas escort rancagua",
      "scord rancagua",
      "mujer busca sexo rancagua",
      "chicas sexo rancagua",
      "escort sexta region",
      "mujeres para sexo en rancagua",
      "sexo a domicilio rancagua",
      "sexo gratis rancagua",
    ],
    h1: "Escorts en Rancagua",
    paragraphs: [
      "Escorts, putas, prostitutas y chicas escort verificadas en Rancagua (sexta región), Región de O'Higgins: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Rancagua, el sector oriente y Machalí, en la sexta región. La lista se ordena por cercanía: primero Rancagua y después San Fernando, Santa Cruz y San Bernardo.",
      "¿Buscas algo específico en Rancagua? Revisa también las escorts a domicilio desde los enlaces de abajo.",
      "Si buscas sexo gratis o casual en Rancagua: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Rancagua?",
        answer: "En esta página: perfiles verificados de Rancagua ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Rancagua?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Rancagua?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Rancagua están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/san-fernando", label: "Escorts en San Fernando" },
      { href: "/escorts/santa-cruz", label: "Escorts en Santa Cruz" },
      { href: "/escorts/san-bernardo", label: "Escorts en San Bernardo" },
      { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    ],
  },
  "la-serena": {
    keywords: [
      "sexo la serena",
      "putas en la serena",
      "damas de compañia la serena",
      "prostitutas la serena",
      "escort en serena",
      "servicios sexuales la serena",
      "escort norte la serena",
      "acompañantes la serena",
      "chicas escort la serena",
      "escort vip la serena",
      "la serena xxx",
      "sexo norte la serena",
      "escort colombiana la serena",
    ],
    h1: "Escorts en La Serena",
    paragraphs: [
      "Escorts, putas, prostitutas, damas de compañía, chicas escort y acompañantes verificadas en La Serena (zona norte), Región de Coquimbo: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de La Serena, la Avenida del Mar y Coquimbo. La lista se ordena por cercanía: primero La Serena y después Coquimbo, Ovalle y Illapel.",
      "¿Buscas algo específico en La Serena? Revisa también las escorts VIP desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en La Serena?",
        answer: "En esta página: perfiles verificados de La Serena ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en La Serena?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de La Serena están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/coquimbo", label: "Escorts en Coquimbo" },
      { href: "/escorts/ovalle", label: "Escorts en Ovalle" },
      { href: "/escorts/illapel", label: "Escorts en Illapel" },
      { href: "/escorts/vip", label: "Escorts VIP" },
    ],
  },
  "chillan": {
    keywords: [
      "putas chillan",
      "prostitutas chillan",
      "sexo chillán",
      "escort chillán",
      "servicios sexuales chillan",
      "sexo gratis en chillan",
      "damas de compañia chillán",
      "acompañantes en chillan",
      "casa de putas en chillan",
    ],
    h1: "Escorts en Chillán",
    paragraphs: [
      "Escorts, putas, prostitutas, damas de compañía y acompañantes verificadas en Chillán, Región de Ñuble: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Chillán y Chillán Viejo. La lista se ordena por cercanía: primero Chillán y después San Carlos, Concepción y Los Ángeles.",
      "Si buscas sexo gratis o casual en Chillán: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Chillán?",
        answer: "En esta página: perfiles verificados de Chillán ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Chillán?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Hay sexo gratis en Chillán?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Chillán están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/san-carlos", label: "Escorts en San Carlos" },
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
      { href: "/escorts/los-angeles", label: "Escorts en Los Ángeles" },
    ],
  },
  "osorno": {
    keywords: [
      "putas en osorno",
      "prostitutas en osorno",
    ],
    h1: "Escorts en Osorno",
    paragraphs: [
      "Escorts, putas y prostitutas verificadas en Osorno, Región de Los Lagos: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en el centro de Osorno y Rahue. La lista se ordena por cercanía: primero Osorno y después Puerto Montt y Valdivia.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Osorno?",
        answer: "En esta página: perfiles verificados de Osorno ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Osorno?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Osorno están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/puerto-montt", label: "Escorts en Puerto Montt" },
      { href: "/escorts/valdivia", label: "Escorts en Valdivia" },
    ],
  },
  "los-angeles": {
    keywords: [
      "putas los angeles",
      "escort los angeles chile",
      "sexo los angeles chile",
      "prostitutas en los angeles",
      "escort en los angeles bio bio",
      "putas los angeles chile",
      "servicios sexuales en los angeles chile",
    ],
    h1: "Escorts en Los Ángeles",
    paragraphs: [
      "Escorts, putas y prostitutas verificadas en Los Ángeles (Bío Bío), Región del Biobío: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Los Ángeles, en la Región del Biobío. La lista se ordena por cercanía: primero Los Ángeles y después Concepción y Chillán.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Los Ángeles?",
        answer: "En esta página: perfiles verificados de Los Ángeles ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Los Ángeles?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Los Ángeles están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
      { href: "/escorts/chillan", label: "Escorts en Chillán" },
    ],
  },
  "calama": {
    keywords: [
      "putas calama",
      "escort norte calama",
      "prostitutas calama",
      "servicios sexuales calama",
      "chicas escort en calama",
    ],
    h1: "Escorts en Calama",
    paragraphs: [
      "Escorts, putas, prostitutas y chicas escort verificadas en Calama (zona norte), Región de Antofagasta: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de Calama y la zona norte. La lista se ordena por cercanía: primero Calama y después Antofagasta.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Calama?",
        answer: "En esta página: perfiles verificados de Calama ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Calama?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Calama están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/antofagasta", label: "Escorts en Antofagasta" },
    ],
  },
  "copiapo": {
    keywords: [
      "sexso norte",
      "escort atacama",
      "escortnorte copiapo",
    ],
    h1: "Escorts en Copiapó",
    paragraphs: [
      "Escorts verificadas en Copiapó (zona norte), Región de Atacama: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en el centro de Copiapó y el resto de Atacama. La lista se ordena por cercanía: primero Copiapó y después Antofagasta y La Serena.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Copiapó?",
        answer: "En esta página: perfiles verificados de Copiapó ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Copiapó están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/antofagasta", label: "Escorts en Antofagasta" },
      { href: "/escorts/la-serena", label: "Escorts en La Serena" },
    ],
  },
  "arica": {
    keywords: [
      "sexo gratis arica",
      "sexo casual arica",
    ],
    h1: "Escorts en Arica",
    paragraphs: [
      "Escorts verificadas en Arica, Región de Arica y Parinacota: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en el centro de Arica y el borde costero. La lista se ordena por cercanía: primero Arica y después Iquique.",
      "Si buscas sexo gratis o casual en Arica: las profesionales de UZEED cobran por sus servicios, pero ver perfiles y escribirles no cuesta nada.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Arica?",
        answer: "En esta página: perfiles verificados de Arica ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Hay sexo gratis en Arica?",
        answer: "No: las escorts cobran por sus servicios. Ver perfiles y escribirles sí es gratis.",
      },
      {
        question: "¿Las escorts de Arica están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/iquique", label: "Escorts en Iquique" },
    ],
  },
  "nunoa": {
    keywords: [
      "escort ñuñoa",
      "putas en ñuñoa",
      "sexo ñuñoa",
      "escort nuñoa",
    ],
    h1: "Escorts en Ñuñoa",
    paragraphs: [
      "Escorts y putas verificadas en Ñuñoa, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Plaza Ñuñoa, Irarrázaval y metro Chile España. La lista se ordena por cercanía: primero Ñuñoa y después Providencia, Macul y La Florida.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Ñuñoa?",
        answer: "En esta página: perfiles verificados de Ñuñoa ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Ñuñoa están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/providencia", label: "Escorts en Providencia" },
      { href: "/escorts/macul", label: "Escorts en Macul" },
      { href: "/escorts/la-florida", label: "Escorts en La Florida" },
    ],
  },
  "puente-alto": {
    keywords: [
      "escort en puente alto",
      "damas de compañia puente alto",
      "putas en puente alto",
      "sexo puente alto",
      "prostitutas puente alto",
      "servicios sexuales puente alto",
      "escort bajos de mena",
    ],
    h1: "Escorts en Puente Alto",
    paragraphs: [
      "Escorts, putas, prostitutas y damas de compañía verificadas en Puente Alto, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en la Plaza de Puente Alto, metro Las Mercedes y Bajos de Mena. La lista se ordena por cercanía: primero Puente Alto y después La Florida y San Bernardo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Puente Alto?",
        answer: "En esta página: perfiles verificados de Puente Alto ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en Puente Alto?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de Puente Alto están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/la-florida", label: "Escorts en La Florida" },
      { href: "/escorts/san-bernardo", label: "Escorts en San Bernardo" },
    ],
  },
  "san-bernardo": {
    keywords: [
      "escort san bernardo",
      "sexo en san bernardo",
      "putas en san bernardo",
      "damas de compañia san bernardo",
      "scor san bernardo",
      "servicios sexuales san bernardo",
    ],
    h1: "Escorts en San Bernardo",
    paragraphs: [
      "Escorts, putas y damas de compañía verificadas en San Bernardo, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en el centro de San Bernardo y Nos. La lista se ordena por cercanía: primero San Bernardo y después La Cisterna, Puente Alto y Talagante.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en San Bernardo?",
        answer: "En esta página: perfiles verificados de San Bernardo ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Cuánto cobra una escort en San Bernardo?",
        answer: "Cada una publica su tarifa en el perfil. En UZEED la mitad de las tarifas publicadas está entre $37.500 y $60.000 la hora (octubre 2026).",
      },
      {
        question: "¿Las escorts de San Bernardo están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/la-cisterna", label: "Escorts en La Cisterna" },
      { href: "/escorts/puente-alto", label: "Escorts en Puente Alto" },
      { href: "/escorts/talagante", label: "Escorts en Talagante" },
    ],
  },
  "talagante": {
    keywords: [
      "escort talagante",
      "sexo en talagante",
      "prostitutas talagante",
      "putas en talagante",
      "damas de compañia talagante",
    ],
    h1: "Escorts en Talagante",
    paragraphs: [
      "Escorts, putas, prostitutas y damas de compañía verificadas en Talagante, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Talagante, Peñaflor, El Monte e Isla de Maipo. La lista se ordena por cercanía: primero Talagante y después Maipú y San Bernardo. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Talagante?",
        answer: "En esta página: perfiles verificados de Talagante ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Talagante están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/maipu", label: "Escorts en Maipú" },
      { href: "/escorts/san-bernardo", label: "Escorts en San Bernardo" },
    ],
  },
  "san-miguel": {
    keywords: [
      "escort en san miguel",
      "putas en san miguel",
      "sexo en san miguel",
      "prostitutas san miguel",
      "damas de compañia san miguel",
    ],
    h1: "Escorts en San Miguel",
    paragraphs: [
      "Escorts, putas, prostitutas y damas de compañía verificadas en San Miguel, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Gran Avenida y metro San Miguel y El Llano. La lista se ordena por cercanía: primero San Miguel y después La Cisterna y Santiago Centro. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en San Miguel?",
        answer: "En esta página: perfiles verificados de San Miguel ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de San Miguel están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/la-cisterna", label: "Escorts en La Cisterna" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
    ],
  },
  "macul": {
    keywords: [
      "escort en macul",
      "putas macul",
      "escort metro macul",
      "servicios sexuales en macul",
    ],
    h1: "Escorts en Macul",
    paragraphs: [
      "Escorts y putas verificadas en Macul, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED. Cada ficha detalla los servicios sexuales y de compañía que ofrece y si atiende en su lugar o a domicilio.",
      "Busca perfiles en metro Macul, Quilín y Avenida Macul. La lista se ordena por cercanía: primero Macul y después Ñuñoa, La Florida y Peñalolén. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Macul?",
        answer: "En esta página: perfiles verificados de Macul ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Macul están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
      { href: "/escorts/la-florida", label: "Escorts en La Florida" },
      { href: "/escorts/penalolen", label: "Escorts en Peñalolén" },
    ],
  },
  "lo-prado": {
    keywords: [
      "escort lo prado",
      "sexo en lo prado",
      "putas san pablo",
      "putas en lo prado",
    ],
    h1: "Escorts en Lo Prado",
    paragraphs: [
      "Escorts y putas verificadas en Lo Prado, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en metro Lo Prado, San Pablo y Blanqueado. La lista se ordena por cercanía: primero Lo Prado y después Quinta Normal y Estación Central. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Lo Prado?",
        answer: "En esta página: perfiles verificados de Lo Prado ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Lo Prado están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/quinta-normal", label: "Escorts en Quinta Normal" },
      { href: "/escorts/estacion-central", label: "Escorts en Estación Central" },
    ],
  },
  "penalolen": {
    keywords: [
      "scort peñalolén",
      "escort en peñalolen",
    ],
    h1: "Escorts en Peñalolén",
    paragraphs: [
      "Escorts verificadas en Peñalolén, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Grecia, Tobalaba y Avenida Consistorial. La lista se ordena por cercanía: primero Peñalolén y después Macul, La Florida y Ñuñoa. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Peñalolén?",
        answer: "En esta página: perfiles verificados de Peñalolén ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Peñalolén están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/macul", label: "Escorts en Macul" },
      { href: "/escorts/la-florida", label: "Escorts en La Florida" },
      { href: "/escorts/nunoa", label: "Escorts en Ñuñoa" },
    ],
  },
  "quinta-normal": {
    keywords: [
      "escort quinta normal",
      "escort metro quinta normal",
    ],
    h1: "Escorts en Quinta Normal",
    paragraphs: [
      "Escorts verificadas en Quinta Normal, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en metro Quinta Normal, Gruta de Lourdes y Matucana. La lista se ordena por cercanía: primero Quinta Normal y después Santiago Centro, Lo Prado y Renca. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Quinta Normal?",
        answer: "En esta página: perfiles verificados de Quinta Normal ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Quinta Normal están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
      { href: "/escorts/lo-prado", label: "Escorts en Lo Prado" },
      { href: "/escorts/renca", label: "Escorts en Renca" },
    ],
  },
  "renca": {
    keywords: [
      "escort renca",
      "putas en renca",
    ],
    h1: "Escorts en Renca",
    paragraphs: [
      "Escorts y putas verificadas en Renca, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Avenida Domingo Santa María y Vicuña Mackenna (Renca). La lista se ordena por cercanía: primero Renca y después Quinta Normal y Santiago Centro. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Renca?",
        answer: "En esta página: perfiles verificados de Renca ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Renca están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/quinta-normal", label: "Escorts en Quinta Normal" },
      { href: "/escorts/santiago-centro", label: "Escorts en Santiago Centro" },
    ],
  },
  "san-ramon": {
    keywords: [
      "escort san ramon",
      "putas en san ramon",
    ],
    h1: "Escorts en San Ramón",
    paragraphs: [
      "Escorts y putas verificadas en San Ramón, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Santa Rosa y metro La Granja. La lista se ordena por cercanía: primero San Ramón y después La Cisterna, San Miguel y La Florida. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en San Ramón?",
        answer: "En esta página: perfiles verificados de San Ramón ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de San Ramón están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/la-cisterna", label: "Escorts en La Cisterna" },
      { href: "/escorts/san-miguel", label: "Escorts en San Miguel" },
      { href: "/escorts/la-florida", label: "Escorts en La Florida" },
    ],
  },
  "colina": {
    keywords: [
      "escort en colina",
      "sexo colina",
    ],
    h1: "Escorts en Colina",
    paragraphs: [
      "Escorts verificadas en Colina, Región Metropolitana: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en el centro de Colina, Chicureo y Esmeralda. La lista se ordena por cercanía: primero Colina y después Santiago. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Colina?",
        answer: "En esta página: perfiles verificados de Colina ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Colina están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
  "san-felipe": {
    keywords: [
      "sexo san felipe",
      "damas de compañia san felipe",
      "putas san felipe",
      "escort aconcagua",
    ],
    h1: "Escorts en San Felipe",
    paragraphs: [
      "Escorts, putas y damas de compañía verificadas en San Felipe (Aconcagua), Región de Valparaíso: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en San Felipe, Los Andes y el valle de Aconcagua. La lista se ordena por cercanía: primero San Felipe y después Quillota y Viña del Mar. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en San Felipe?",
        answer: "En esta página: perfiles verificados de San Felipe ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de San Felipe están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/quillota", label: "Escorts en Quillota" },
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
    ],
  },
  "quillota": {
    keywords: [
      "travestis quillota",
      "transexual quillota",
    ],
    h1: "Escorts en Quillota",
    paragraphs: [
      "Escorts verificadas en Quillota, Región de Valparaíso: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Quillota, La Calera y La Cruz. La lista se ordena por cercanía: primero Quillota y después Viña del Mar y San Felipe. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
      "¿Buscas algo específico en Quillota? Revisa también las escorts trans desde los enlaces de abajo.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Quillota?",
        answer: "En esta página: perfiles verificados de Quillota ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Quillota están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/san-felipe", label: "Escorts en San Felipe" },
      { href: "/escorts/trans", label: "Escorts trans" },
    ],
  },
  "illapel": {
    keywords: [
      "putas illapel",
      "escort illapel",
      "sexo illapel",
    ],
    h1: "Escorts en Illapel",
    paragraphs: [
      "Escorts y putas verificadas en Illapel, Región de Coquimbo: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Illapel y Salamanca, en la provincia de Choapa. La lista se ordena por cercanía: primero Illapel y después Ovalle y La Serena. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Illapel?",
        answer: "En esta página: perfiles verificados de Illapel ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Illapel están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/ovalle", label: "Escorts en Ovalle" },
      { href: "/escorts/la-serena", label: "Escorts en La Serena" },
    ],
  },
  "villarrica": {
    keywords: [
      "escort en villarrica",
      "sexo sur villarrica",
    ],
    h1: "Escorts en Villarrica",
    paragraphs: [
      "Escorts verificadas en Villarrica, Región de La Araucanía: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Villarrica y Pucón, sobre todo en temporada de verano. La lista se ordena por cercanía: primero Villarrica y después Temuco. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Villarrica?",
        answer: "En esta página: perfiles verificados de Villarrica ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Villarrica están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/temuco", label: "Escorts en Temuco" },
    ],
  },
  "talcahuano": {
    keywords: [
      "putas talcahuano",
      "escort talcahuano",
    ],
    h1: "Escorts en Talcahuano",
    paragraphs: [
      "Escorts y putas verificadas en Talcahuano, Región del Biobío: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Talcahuano, Las Higueras y Hualpén. La lista se ordena por cercanía: primero Talcahuano y después Concepción y Chiguayante. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Talcahuano?",
        answer: "En esta página: perfiles verificados de Talcahuano ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Talcahuano están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
      { href: "/escorts/chiguayante", label: "Escorts en Chiguayante" },
    ],
  },
  "chiguayante": {
    keywords: [
      "escort chiguayante",
      "putas chiguayante",
    ],
    h1: "Escorts en Chiguayante",
    paragraphs: [
      "Escorts y putas verificadas en Chiguayante, Región del Biobío: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Chiguayante y el camino a Concepción por Pedro de Valdivia. La lista se ordena por cercanía: primero Chiguayante y después Concepción y Talcahuano. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Chiguayante?",
        answer: "En esta página: perfiles verificados de Chiguayante ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Chiguayante están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/concepcion", label: "Escorts en Concepción" },
      { href: "/escorts/talcahuano", label: "Escorts en Talcahuano" },
    ],
  },
  "concon": {
    keywords: [
      "escort con con",
      "escort concon",
      "putas en con con",
    ],
    h1: "Escorts en Concón",
    paragraphs: [
      "Escorts y putas verificadas en Concón (Con Con), Región de Valparaíso: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Concón, Reñaca y el borde costero. La lista se ordena por cercanía: primero Concón y después Viña del Mar y Valparaíso. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro putas en Concón?",
        answer: "En esta página: perfiles verificados de Concón ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Concón están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/vina-del-mar", label: "Escorts en Viña del Mar" },
      { href: "/escorts/valparaiso", label: "Escorts en Valparaíso" },
    ],
  },
  "puerto-varas": {
    keywords: [
      "escort puerto varas",
      "sexo puerto varas",
    ],
    h1: "Escorts en Puerto Varas",
    paragraphs: [
      "Escorts verificadas en Puerto Varas, Región de Los Lagos: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en Puerto Varas, Llanquihue y Frutillar. La lista se ordena por cercanía: primero Puerto Varas y después Puerto Montt y Osorno. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en Puerto Varas?",
        answer: "En esta página: perfiles verificados de Puerto Varas ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de Puerto Varas están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/puerto-montt", label: "Escorts en Puerto Montt" },
      { href: "/escorts/osorno", label: "Escorts en Osorno" },
    ],
  },
  "san-carlos": {
    keywords: [
      "escort san carlos",
      "sexo sur san carlos",
    ],
    h1: "Escorts en San Carlos",
    paragraphs: [
      "Escorts verificadas en San Carlos, Región de Ñuble: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en San Carlos y el norte de Ñuble. La lista se ordena por cercanía: primero San Carlos y después Chillán. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en San Carlos?",
        answer: "En esta página: perfiles verificados de San Carlos ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de San Carlos están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/chillan", label: "Escorts en Chillán" },
    ],
  },
  "san-javier": {
    keywords: [
      "escort san javier",
      "sexo sur san javier",
    ],
    h1: "Escorts en San Javier",
    paragraphs: [
      "Escorts verificadas en San Javier, Región del Maule: fotos reales, tarifa, horario y contacto directo por WhatsApp o por el chat de UZEED.",
      "Busca perfiles en San Javier y Villa Alegre. La lista se ordena por cercanía: primero San Javier y después Talca y Linares. Si hoy hay pocos perfiles publicados acá, verás primero los más cercanos.",
    ],
    faq: [
      {
        question: "¿Dónde encuentro escorts en San Javier?",
        answer: "En esta página: perfiles verificados de San Javier ordenados por cercanía. Escríbeles directo desde su perfil por WhatsApp o por el chat.",
      },
      {
        question: "¿Las escorts de San Javier están verificadas?",
        answer: `Sí: identidad y fotos reales. ${ADULTS_ONLY}`,
      },
    ],
    related: [
      { href: "/escorts/talca", label: "Escorts en Talca" },
      { href: "/escorts/linares", label: "Escorts en Linares" },
    ],
  },
};

/**
 * Se suman al final de landings que ya existían (curadas o de ciudad). No
 * cambian su título ni su texto: sólo keywords, párrafos y preguntas nuevas.
 */
export const SEMRUSH_ADDITIONS: Record<string, { keywords: string[]; paragraphs?: string[]; faq?: SeoFaq[] }> = {
  "a-domicilio": {
    keywords: [
      "escort a domicilio",
      "putas a domicilio",
      "scort a domicilio",
      "sexo a domicilio",
      "prostitutas a domicilio",
      "escort sin conserje",
      "damas de compañia a domicilio",
      "servicios sexuales a domicilio",
      "escort santiago domicilio",
      "putas 24 horas",
      "escort solo domicilio",
      "chicas a domicilio chile",
      "putas baratas a domicilio",
      "escort baratas a domicilio",
    ],
    faq: [
      {
        question: "¿Hay escorts a domicilio las 24 horas?",
        answer: "Algunas atienden 24/7. Ordena por \"disponible ahora\" para ver las que pueden ir en este momento.",
      },
    ],
  },
  "hombres": {
    keywords: [
      "sexo gay",
      "escort gay",
      "escort hombres",
      "escort gay chile",
      "escort gay santiago",
      "sexo gay chile",
      "escort masculino",
      "gigolo santiago",
      "sexo gay santiago",
      "escort gay talca",
      "gigolo puerto montt",
      "escort gay puerto montt",
      "sexo gay talca",
      "escort masculino chile",
      "hombres chilenos desnudos",
      "escort hombres en santiago",
      "escort masculino santiago",
      "escort gay en viña",
      "escort gay santiago chile",
      "gigolos en chile",
      "hombres de compañia chile",
      "escort chile hombres",
      "escort hombres gay",
      "prostitutos gay",
      "gigolos xxx",
      "seco gay",
      "chile xxx gay",
      "vergones chilenos",
      "escort gay en viña del mar",
      "sexo gay viña",
      "sexo gay viña del mar",
      "sexo pagado gay",
      "gigolos gay en santiago",
      "male escort",
      "hombres prostitutos",
      "acompañantes masculinos",
      "servicios sexuales gay",
      "masajes gay providencia",
      "gigolo gay",
      "male escort santiago",
      "orgias gay chile",
    ],
    paragraphs: [
      "Si buscas gigolós o escorts gay en Viña del Mar, Talca o Puerto Montt, activa tu ubicación: la lista se ordena por cercanía. Todos son mayores de edad y verificados.",
    ],
    faq: [
      {
        question: "¿Hay gigolós para mujeres en Santiago?",
        answer: "Sí: acompañantes masculinos para mujeres y parejas. Revisa en cada perfil a quién atiende.",
      },
      {
        question: "¿Hay escort gay en regiones?",
        answer: "Activa tu ubicación en Viña del Mar, Talca o Puerto Montt y la lista se ordena por cercanía: primero los de tu ciudad y después los más cercanos.",
      },
    ],
  },
  "trans": {
    keywords: [
      "escort travesti",
      "scort trans",
      "escorts trans",
      "escort travesti santiago",
      "escort trans santiago",
      "escort trans chile",
      "shemale santiago",
      "scort trans conce",
      "travestis escort chile",
      "shemale escort",
      "servicios sexuales travestis",
      "travestis concepcion",
      "trans dotada",
      "travestis santiago centro",
      "putas travestis",
      "travestis en santiago de chile",
      "sexo trans santiago",
      "servicio de travestis en santiago",
      "trans busca sexo santiago centro chile",
      "trans a domicilio",
      "transexuales dotados",
      "sexo travesti vip",
      "travestis conce",
      "travestis dotados",
      "número de whatsapp de travestis",
      "travestis a domicilio",
      "trans de compañia",
      "contactos travestis",
    ],
    paragraphs: [
      "Si buscas escorts trans o travestis en Concepción, Quillota u otra ciudad, activa tu ubicación: la lista se ordena por cercanía. Cada perfil tiene WhatsApp directo y describe sus servicios.",
    ],
    faq: [
      {
        question: "¿Hay travestis en Concepción?",
        answer: "Activa tu ubicación en Concepción y la lista se ordena por cercanía: primero las de Conce y después las más cercanas.",
      },
      {
        question: "¿Hay escorts trans a domicilio?",
        answer: "Algunas atienden a domicilio u hotel. Lo indica cada perfil.",
      },
    ],
  },
  "maduras": {
    keywords: [
      "putas maduras",
      "scort madura",
      "escort milf",
      "escort madura santiago",
      "maduras escort",
      "milf santiago",
      "putas maduras santiago",
      "damas de compañia maduras",
      "milf putas",
      "sexo madura santiago",
      "madura busca sexo santiago",
      "escort madura santiago centro",
      "escort milf santiago",
      "escort 60 años",
      "milf escort",
      "prostitutas maduras",
      "escort maduras en chile",
      "scort vieja",
      "escort viejas",
      "viejas dan sexo en santiago de chile",
      "maduras acompañantes",
      "escorts ancianas",
      "maduras para sexo",
    ],
    paragraphs: [
      "Si buscas escorts maduras en Concepción, Valparaíso, Viña del Mar o Antofagasta, activa tu ubicación: la lista se ordena por cercanía.",
    ],
    faq: [
      {
        question: "¿Hay escorts de 50 o 60 años?",
        answer: "Si las hay, aparecen en esta lista: la edad se calcula desde la fecha de nacimiento verificada y todas tienen 40 años o más. Cada perfil muestra su edad.",
      },
    ],
  },
  "culona": {
    keywords: [
      "mujeres de compañia",
      "escort culona",
      "escort voluptuosa",
    ],
    faq: [
      {
        question: "¿Qué es una mujer de compañía?",
        answer: "Es otra forma de decir escort o acompañante: una profesional independiente que ofrece compañía y servicios por una tarifa.",
      },
    ],
  },
  "gordita": {
    keywords: [
      "gordas putas",
      "escort gordita",
      "putas gorditas",
      "escort rellenita",
      "sexo gordita santiago",
      "escort gordita santiago",
      "prostitutas gordas",
      "damas de compañia gorditas",
      "putas gordas en santiago",
      "putas gordas en chile",
      "servicios sexuales gorditas",
    ],
  },
  "anal": {
    keywords: [
      "escort anal",
      "escort anal santiago",
      "sexo anal santiago",
      "anal santiago",
      "escort sexo anal",
      "escort colombiana anal",
    ],
  },
  "masaje-erotico": {
    keywords: [
      "masajes sexuales",
      "masajes sensitivos",
      "masajes eroticos santiago",
      "masajes sensitivos providencia",
      "masajes sexis",
      "masajes sensitivos santiago centro",
      "masajes desnudos",
      "masajes eroticos santiago centro",
      "masajes eroticos las condes",
      "masajes eroticos chile",
      "masajes eroticos providencia",
      "masajes hot",
      "servicios eroticos",
      "masajes eroticos a domicilio",
      "masajes con final feliz en santiago",
      "masajes eroticos a mujeres",
      "escort masajes santiago",
      "masajes sexuales a tu pareja",
      "masajes eroticos en ñuñoa",
      "masajes intimos",
      "masaje erotico tobalaba",
      "masaje erotico cl",
      "spa erotico",
      "masajes cachondos",
      "masajes eroticos domingo",
      "masage sexual",
      "masajes santiago sensitivos",
    ],
    paragraphs: [
      "¿Buscas masajes eróticos en Santiago Centro, Providencia, Tobalaba, Las Condes o Ñuñoa? Activa tu ubicación y verás primero las más cercanas. Cada perfil dice si atiende a domicilio y a quién (hombres, mujeres o parejas).",
    ],
    faq: [
      {
        question: "¿Hay masajes eróticos a domicilio?",
        answer: "Algunas atienden a domicilio u hotel: lo indica cada perfil.",
      },
      {
        question: "¿Hay masajes eróticos para mujeres?",
        answer: "Algunas profesionales atienden a mujeres y parejas. Pregúntalo al contactarlas.",
      },
    ],
  },
  "santiago": {
    keywords: [
      "escort santiago",
      "putas santiago",
      "sexo santiago",
      "chicas escort",
      "damas de compañia santiago",
      "prostitutas santiago",
      "escort en santiago de chile",
      "escort jovenes",
      "sexo santiago hoy",
      "escorts santiago clasificados",
      "escort universitaria santiago",
      "escort toda la noche",
      "putas independientes",
      "puras santiago",
      "putas universitarias santiago",
    ],
    paragraphs: [
      "En Santiago hay putas, prostitutas y damas de compañía para todos los gustos: chicas escort independientes, VIP y otras que ofrecen la noche completa. Todas publican su tarifa y responden directo.",
    ],
    faq: [
      {
        question: "¿Hay escorts en Santiago toda la noche?",
        answer: "Algunas ofrecen la noche completa: lo verás en la tarifa de su perfil o pregúntalo al escribirle.",
      },
      {
        question: "¿Las escorts de Santiago son independientes?",
        answer: "Sí. En UZEED no hay agencias: cada escort maneja su perfil, sus tarifas y su contacto.",
      },
    ],
  },
  "santiago-centro": {
    keywords: [
      "escort santiago centro",
      "escort plaza de armas",
      "escort metro santa ana",
      "escort santa ana",
      "escort santa lucia",
      "escort metro santa lucia",
      "escort metro u de chile",
      "escort santa isabel",
      "escort baquedano",
      "escort metro bellas artes",
      "escort metro toesca",
      "escort metro santa isabel",
      "escort u de chile",
      "escort bellas artes",
      "escort metro los heroes",
      "putas bellas",
      "escort metro baquedano",
      "putas metro u de chile",
      "escort metro republica",
      "escort matta",
      "escort av matta",
      "putas metro santa lucia",
      "putas plaza de armas",
      "escort metro",
      "putas santa lucia",
      "escort el momento",
      "putas plaza de armas santiago",
      "escort mapocho",
      "putas en baquedano",
      "putas universidad de chile",
      "putas en santa ana",
      "escort santiago santa ana",
      "escort bellavista",
      "putas 24 7",
      "escort plaza de armas santiago",
    ],
    paragraphs: [
      "Hay perfiles cerca de casi todas las estaciones del centro: Santa Ana, Santa Isabel, Bellas Artes, Universidad de Chile, Los Héroes, República, Matta y Mapocho. Revisa en cada ficha su horario.",
    ],
    faq: [
      {
        question: "¿Hay escorts cerca de metro Santa Ana o Bellas Artes?",
        answer: "Sí. Activa tu ubicación y verás primero las más cercanas a tu estación.",
      },
    ],
  },
  "las-condes": {
    keywords: [
      "escort las condes",
      "escort manquehue",
      "putas las condes",
      "sexo las condes",
      "escort metro manquehue",
      "escort los dominicos",
      "damas de compañia las condes",
      "escort encomenderos",
    ],
    paragraphs: [
      "También hay perfiles cerca de Los Dominicos y Encomenderos.",
    ],
  },
  "providencia": {
    keywords: [
      "escort providencia",
      "escort tobalaba",
      "escort pedro de valdivia",
      "escort metro tobalaba",
      "escort parque bustamante",
      "sexo providencia",
      "escort metro los leones",
      "escort metro pedro de valdivia",
      "damas de compañia providencia",
      "putas en providencia",
      "putas metro tobalaba",
      "putas pedro de valdivia",
      "putas metro los leones",
    ],
    paragraphs: [
      "También hay escorts y damas de compañía cerca de metro Pedro de Valdivia y masajes sensitivos en el sector.",
    ],
  },
  "la-florida": {
    keywords: [
      "escort la florida",
      "putas en la florida",
      "sexo en la florida",
      "damas de compañia la florida",
      "prostitutas la florida",
      "escort vicente valdes",
      "escort metro mirador",
      "servicio sexuales la florida",
      "sexo a domicilio la florida",
      "escort comuna la florida",
      "escort a domicilio la florida",
      "escort pedrero",
      "escort metro pedrero",
    ],
  },
  "estacion-central": {
    keywords: [
      "escort estacion central",
      "putas estacion central",
      "escort metro las rejas",
      "escort estacion",
      "escort toro mazote",
      "sexo en estación central",
      "prostitutas estacion central",
      "damas de compañia estacion central",
    ],
  },
  "la-cisterna": {
    keywords: [
      "escort la cisterna",
      "escort gran avenida",
      "putas la cisterna",
      "sexo la cisterna",
      "damas de compañia la cisterna",
      "escort metro la cisterna",
      "escort el parron",
    ],
  },
  "san-antonio": {
    keywords: [
      "escort san antonio",
      "putas san antonio",
      "damas de compañia san antonio",
      "sexo san antonio",
      "escort san antonio chile",
      "damas de compañia san antonio chile",
      "sexo san antonio chile",
    ],
  },
  "coquimbo": {
    keywords: [
      "putas coquimbo",
      "escort coquimbo",
      "prostitutas coquimbo",
      "servicios sexuales coquimbo",
      "escort peñuelas",
    ],
  },
  "ovalle": {
    keywords: [
      "escort en ovalle",
      "putas en ovalle",
      "servicios sexuales ovalle",
      "prostitutas en ovalle",
    ],
  },
  "san-fernando": {
    keywords: [
      "escort san fernando",
      "sexo san fernando",
      "putas san fernando",
      "damas de compañia san fernando",
      "scor san fernando",
      "escort san fernando chile",
      "servicios sexuales san fernando",
    ],
  },
  "santa-cruz": {
    keywords: [
      "escort en santa cruz",
      "sexo santa cruz",
      "damas de compañia santa cruz",
      "putas santa cruz",
      "sexo sur santa cruz",
    ],
  },
  "linares": {
    keywords: [
      "putas en linares",
      "escort linares chile",
      "sexo gratis linares",
      "eroticos linares",
    ],
  },
  "valdivia": {
    keywords: [
      "putas valdivia",
      "servicios sexuales valdivia",
      "prostitutas valdivia",
      "escort valdivia chile",
      "acompanantes valdivia",
      "sexo gratis valdivia",
    ],
  },
  "chiloe": {
    keywords: [
      "chiloé sexual",
      "escort chiloe",
      "sexo chiloe",
      "escort en castro",
      "putas en castro",
      "putas chiloe",
      "escort castro chiloe",
      "servicios sexuales castro",
    ],
  },
};

/**
 * Landings de plantilla que ya reciben clics: se les suma este texto debajo
 * y conservan su título de siempre.
 */
export const TEMPLATE_TAG_SEO: Record<string, Pick<SeoCopy, "keywords" | "h1" | "paragraphs" | "faq" | "related">> = {
  "pelirroja": {
    keywords: [
      "escort colorina",
      "escort pelirroja",
    ],
    h1: "Escorts pelirrojas y colorinas",
    paragraphs: [
      "Escorts pelirrojas (colorinas) verificadas en Santiago y Chile, con fotos reales. Cada perfil muestra sus fotos, servicios, tarifa y si atiende en su lugar o a domicilio.",
    ],
    faq: [
      {
        question: "¿Hay escorts colorinas en Santiago?",
        answer: "Sí, las que publican en UZEED aparecen en esta lista. Activa tu ubicación para verlas por cercanía.",
      },
    ],
    related: [
      { href: "/escorts/rubia", label: "Escorts rubias" },
      { href: "/escorts/santiago", label: "Escorts en Santiago" },
    ],
  },
};
