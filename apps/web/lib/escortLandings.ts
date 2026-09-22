/**
 * Landings del lado OFERTA (escorts / creadoras de contenido).
 *
 * Todo el SEO del sitio estaba orientado al cliente que busca escorts
 * (/escorts, /escorts/[tag], /escorts/[ciudad]). Nadie captaba las búsquedas
 * de la otra mitad del mercado: mujeres buscando "trabajar de escort",
 * "vender packs", "publicar anuncio gratis". Estas landings cubren esa
 * intención: cada variante tiene su propia URL canónica, H1, copy y FAQ para
 * no competir entre sí ni generar contenido duplicado.
 *
 * Consumidas por components/EscortLandingPage.tsx (render + JSON-LD) y por
 * el sitemap.
 */

export type LandingFaq = { question: string; answer: string };

export type EscortLanding = {
  /** Ruta sin slash final; es también el canonical. */
  slug: string;
  /** <title> sin el sufijo " | UZEED" (lo agrega el template del layout). */
  title: string;
  metaDescription: string;
  keywords: string[];
  /** Badge sobre el H1. */
  eyebrow: string;
  h1: string;
  /** Párrafo bajo el H1: define la intención de búsqueda de la variante. */
  intro: string;
  /** Bloque largo indexable: encabezado + párrafos. */
  seoSection: { heading: string; paragraphs: string[] };
  faq: LandingFaq[];
};

const WHY_UZEED =
  "UZEED es una plataforma chilena: soporte en español por WhatsApp, precios en pesos y un equipo que entiende cómo se trabaja en Chile.";

export const ESCORT_LANDINGS: EscortLanding[] = [
  {
    slug: "creadoras",
    title: "Únete a UZEED — Publica tu perfil de escort o creadora gratis",
    metaDescription:
      "Crea tu perfil de escort o creadora de contenido en UZEED gratis. Tú fijas tus tarifas, decides tus servicios y recibes clientes verificados en Santiago y todo Chile.",
    keywords: [
      "plataforma para escorts chile",
      "publicar perfil de escort",
      "ser creadora de contenido chile",
      "trabajar de escort chile",
      "publicar anuncio escort gratis",
      "ganar dinero como escort",
      "escort independiente chile",
      "vender contenido +18 chile",
    ],
    eyebrow: "Para escorts y creadoras",
    h1: "Publica tu perfil de escort o creadora y trabaja de forma independiente",
    intro:
      "UZEED reúne directorio de perfiles, feed de contenido y suscripciones en un solo lugar. Publicas tu perfil, fijas tus tarifas, eliges qué servicios ofreces y hablas directo con tus clientes. Sin intermediarios, sin agencia y con la comisión más baja del mercado chileno.",
    seoSection: {
      heading: "Trabajar como escort o creadora independiente en Chile",
      paragraphs: [
        "Miles de mujeres en Chile trabajan de forma independiente como escorts, acompañantes, masajistas eróticas o creadoras de contenido para adultos. El problema casi nunca es la demanda: es la visibilidad. Sin un perfil en un sitio que reciba tráfico real, los contactos no llegan y terminas pagando publicidad suelta que se apaga en días.",
        "En UZEED tu perfil vive dentro de un directorio que ya recibe clientes buscando escorts en Santiago, Viña del Mar, Valparaíso, Concepción y el resto del país. Apareces en el inicio, en el feed, en las búsquedas por ciudad y en las búsquedas por servicio. No compras clics: el tráfico llega solo y se reparte entre los perfiles activos.",
        "Tú controlas todo lo importante. Publicas las fotos que quieras, escribes tus servicios con tus palabras, fijas tus tarifas en pesos y defines tu zona y tus horarios. Puedes pausar u ocultar el perfil cuando quieras desde el panel, sin pedirle permiso a nadie y sin perder tu historial.",
        `Además del directorio, puedes vender contenido: fotos, videos y suscripciones mensuales desde tu propio feed, con pagos en pesos chilenos. ${WHY_UZEED}`,
      ],
    },
    faq: [
      {
        question: "¿Cuánto cuesta publicar mi perfil en UZEED?",
        answer:
          "Nada. La membresía está gratis por la promoción de lanzamiento: publicas tu perfil, usas el feed y recibes contactos sin pagar. No pedimos tarjeta y no hay cobros automáticos.",
      },
      {
        question: "¿Necesito agencia o representante para publicar?",
        answer:
          "No. UZEED es para escorts y creadoras independientes. Creas tu cuenta tú misma, administras tu perfil desde el celular y los clientes te escriben directo por chat interno o WhatsApp.",
      },
      {
        question: "¿Qué necesito para registrarme?",
        answer:
          "Tu correo, ser mayor de 18 años, fotos tuyas y un documento de identidad para la verificación. La verificación no se publica: solo se usa para confirmar que eres tú y activar la insignia Verificada.",
      },
      {
        question: "¿Se publican mis datos personales?",
        answer:
          "No. Tu nombre real, tu dirección, tu RUT y tus documentos nunca aparecen en el perfil. Solo se muestra lo que tú decides publicar: nombre artístico, fotos, servicios, tarifas y la zona donde atiendes.",
      },
      {
        question: "¿Cuánto se demora en aparecer mi perfil?",
        answer:
          "El perfil queda visible al terminar el registro y la verificación se revisa normalmente el mismo día. La mayoría de las creadoras empieza a recibir contactos en las primeras horas.",
      },
      {
        question: "¿Puedo trabajar en cualquier ciudad de Chile?",
        answer:
          "Sí. UZEED tiene landings y búsquedas por más de 300 ciudades y comunas, así que aparecerás frente a clientes de tu zona, no solo de Santiago.",
      },
    ],
  },
  {
    slug: "trabajar-de-escort",
    title: "Trabajar de escort en Chile — Cómo empezar de forma independiente",
    metaDescription:
      "Guía para trabajar de escort en Chile de forma independiente y segura: qué necesitas, cómo fijar tus tarifas y cómo publicar tu perfil gratis en UZEED.",
    keywords: [
      "trabajar de escort",
      "trabajar de escort en chile",
      "trabajo de escort santiago",
      "quiero ser escort",
      "como ser escort en chile",
      "trabajar de acompañante chile",
      "trabajo independiente escort",
      "escort principiante chile",
    ],
    eyebrow: "Trabajar de escort",
    h1: "Trabajar de escort en Chile de forma independiente",
    intro:
      "Si estás pensando en trabajar de escort, lo primero es tener dónde publicar. En UZEED creas tu perfil gratis, fijas tú misma tus tarifas y tus límites, y recibes contactos de clientes reales sin agencia y sin intermediarios.",
    seoSection: {
      heading: "Cómo empezar a trabajar de escort en Chile",
      paragraphs: [
        "Trabajar de escort de manera independiente significa que tú decides todo: qué servicios ofreces, cuánto cobras, en qué horario atiendes y a quién le respondes. Nadie te asigna clientes ni te retiene un porcentaje por hacerlo. Lo único que necesitas al principio es un perfil bien hecho en un sitio con tráfico.",
        "Un buen perfil parte por tres cosas: fotos tuyas y actuales, una descripción clara de lo que ofreces y de lo que no, y tarifas explícitas. Los perfiles con precios visibles y servicios definidos reciben menos mensajes perdidos y más contactos que terminan en una cita concreta.",
        "La verificación es lo que más cambia tus resultados. La insignia Verificada multiplica hasta cinco veces los contactos, porque los clientes que pagan evitan los perfiles sin verificar por miedo a estafas. Verificarte toma minutos y tus documentos nunca se publican.",
        "Sobre seguridad: define tus reglas antes de empezar. Confirma la cita por chat, guarda la conversación, pide seña cuando corresponda y usa el bloqueo del panel con quien se pase de la raya. Puedes ocultar o pausar tu perfil en cualquier momento, por ejemplo si te tomas unos días o viajas a otra ciudad.",
      ],
    },
    faq: [
      {
        question: "¿Qué necesito para empezar a trabajar de escort?",
        answer:
          "Ser mayor de 18 años, un documento de identidad para verificarte, fotos tuyas y un perfil donde publicarte. En UZEED el registro es gratis y toma pocos minutos desde el celular.",
      },
      {
        question: "¿Cuánto puedo cobrar como escort en Chile?",
        answer:
          "Las tarifas las fijas tú. Puedes revisar los perfiles activos de tu ciudad en el directorio de UZEED para ver el rango que se maneja en tu zona y ajustar desde ahí según tus servicios y tu disponibilidad.",
      },
      {
        question: "¿Es necesario trabajar con una agencia?",
        answer:
          "No. Puedes trabajar de forma totalmente independiente: publicas tu perfil, los clientes te escriben directo y no compartes tus ingresos con nadie.",
      },
      {
        question: "¿Puedo trabajar de escort sin mostrar mi rostro?",
        answer:
          "Sí. Muchas creadoras publican fotos sin rostro o con el rostro cubierto. Recibes menos contactos que con rostro visible, pero la verificación sigue disponible y el perfil funciona igual.",
      },
      {
        question: "¿Cómo protejo mi privacidad?",
        answer:
          "UZEED no publica tu nombre real, tu dirección ni tus documentos. Eliges si muestras WhatsApp o si prefieres solo el chat interno, y puedes bloquear usuarios, pausar el perfil u ocultarlo cuando quieras.",
      },
      {
        question: "¿Puedo combinarlo con vender contenido?",
        answer:
          "Sí, y es lo más rentable. Con el mismo perfil puedes atender clientes y vender fotos, videos y suscripciones desde tu feed, así generas ingresos también los días que no atiendes.",
      },
    ],
  },
  {
    slug: "vender-contenido",
    title: "Vender contenido +18 en Chile — Packs, videos y suscripciones",
    metaDescription:
      "Vende packs, videos y suscripciones +18 en Chile con pagos en pesos. Crea tu feed en UZEED gratis, pon tus precios y quédate con casi todo lo que generas.",
    keywords: [
      "vender contenido +18 chile",
      "vender packs chile",
      "vender fotos y videos chile",
      "monetizar contenido adulto chile",
      "plataforma para creadoras de contenido chile",
      "suscripciones contenido adulto chile",
      "ganar dinero vendiendo contenido",
      "alternativa onlyfans chile",
    ],
    eyebrow: "Vender contenido",
    h1: "Vender contenido +18 en Chile: packs, videos y suscripciones",
    intro:
      "Crea tu feed en UZEED y vende fotos, videos, packs y suscripciones mensuales con pagos en pesos chilenos. Tú pones los precios, tú decides qué publicas y te quedas con casi todo lo que generas.",
    seoSection: {
      heading: "Cómo vender contenido para adultos en Chile",
      paragraphs: [
        "Vender contenido +18 desde Chile suele trabarse en dos puntos: los cobros y la audiencia. Las plataformas extranjeras pagan en dólares, con retenciones y demoras, y encima te dejan sola para conseguir seguidores. Sin audiencia, el mejor contenido no vende.",
        "En UZEED tu feed vive dentro de una plataforma que ya recibe clientes chilenos buscando perfiles. Publicas fotos, videos, historias y packs, y quien quiera ver más se suscribe. El tráfico del directorio alimenta tu feed: no partes de cero cada vez que publicas.",
        "Puedes vender de tres formas a la vez: contenido suelto con precio por pack, suscripción mensual a tu feed completo, y contenido pedido a medida por chat. Los pagos son en pesos chilenos y la comisión es la más baja del mercado local.",
        `No necesitas atender clientes en persona para usar esta parte de la plataforma: hay creadoras que solo venden contenido y nunca publican tarifas de encuentro. ${WHY_UZEED}`,
      ],
    },
    faq: [
      {
        question: "¿Cuánto me quedo de cada venta?",
        answer:
          "Casi todo. UZEED cobra la comisión más baja del mercado chileno y durante la promoción de lanzamiento la membresía mensual es gratis, así que no hay costo fijo que descontar.",
      },
      {
        question: "¿En qué moneda recibo los pagos?",
        answer:
          "En pesos chilenos, sin conversión de dólares ni retenciones de plataformas extranjeras.",
      },
      {
        question: "¿Puedo vender contenido sin ofrecer encuentros?",
        answer:
          "Sí. Puedes usar solo el feed y las suscripciones, sin publicar tarifas de encuentro ni servicios presenciales.",
      },
      {
        question: "¿Qué tipo de contenido puedo publicar?",
        answer:
          "Fotos, videos, historias y packs propios, siempre con participantes mayores de 18 años y con tu consentimiento. Todo lo demás lo define el reglamento de la plataforma y la moderación activa.",
      },
      {
        question: "¿Puedo poner precios distintos por pack?",
        answer:
          "Sí. Cada publicación puede tener su propio precio, y además puedes ofrecer una suscripción mensual que dé acceso a todo tu feed.",
      },
      {
        question: "¿Mi contenido queda protegido?",
        answer:
          "El contenido pagado solo lo ven quienes lo compraron o están suscritos, y hay moderación activa contra perfiles falsos y reventa. Puedes reportar cualquier uso no autorizado al equipo por WhatsApp.",
      },
    ],
  },
  {
    slug: "publicar-anuncio-escort",
    title: "Publicar anuncio de escort gratis en Chile — Sin comisión inicial",
    metaDescription:
      "Publica tu anuncio de escort gratis en Chile y aparece en las búsquedas de tu ciudad. Sin agencia, sin cobros automáticos y con verificación el mismo día.",
    keywords: [
      "publicar anuncio escort gratis",
      "publicar anuncio escort chile",
      "publicar aviso escort santiago",
      "donde publicar mi perfil de escort",
      "publicar anuncio acompañante chile",
      "anuncios escorts gratis chile",
      "publicar perfil masajista erotica chile",
    ],
    eyebrow: "Publicar anuncio",
    h1: "Publicar tu anuncio de escort gratis en Chile",
    intro:
      "Publica tu anuncio en minutos y aparece en las búsquedas de tu ciudad. Sin agencia, sin cobros automáticos y con verificación el mismo día para que los clientes te escriban con confianza.",
    seoSection: {
      heading: "Dónde publicar tu anuncio de escort en Chile",
      paragraphs: [
        "Publicar un anuncio suelto en redes sociales o en sitios de clasificados dura poco: la publicación se hunde en horas, las cuentas se caen por reportes y el gasto en publicidad se repite cada semana sin dejar nada acumulado.",
        "Un perfil en un directorio funciona distinto. Queda indexado, aparece en las búsquedas por ciudad y por servicio, y sigue trayendo contactos mientras esté activo. En UZEED tu anuncio entra al directorio de escorts, al feed y a las landings por ciudad, todas con tráfico de clientes que ya están buscando.",
        "Tu anuncio incluye fotos, descripción, servicios, tarifas, zona de atención, horarios y contacto directo por chat interno o WhatsApp. Se edita cuando quieras desde el celular: subes precios, cambias fotos, marcas disponibilidad para hoy o pausas el perfil si te tomas unos días.",
        "La verificación es gratis y es lo que separa un anuncio que convierte de uno que se ignora. Con la insignia Verificada los contactos se multiplican hasta cinco veces, porque el cliente sabe que las fotos son reales.",
      ],
    },
    faq: [
      {
        question: "¿Publicar el anuncio cuesta algo?",
        answer:
          "No. Durante la promoción de lanzamiento publicar es gratis: no pedimos tarjeta, no hay prueba limitada y no hay cobros automáticos después.",
      },
      {
        question: "¿Cuánto demora en publicarse?",
        answer:
          "El anuncio queda visible al terminar el registro, que toma pocos minutos. La verificación se revisa normalmente el mismo día.",
      },
      {
        question: "¿Puedo editar o borrar mi anuncio después?",
        answer:
          "Sí, cuando quieras. Desde el panel editas fotos, servicios, tarifas y horarios, y puedes pausar, ocultar o eliminar el anuncio sin pedirle permiso a nadie.",
      },
      {
        question: "¿Aparece mi anuncio en mi ciudad?",
        answer:
          "Sí. UZEED tiene búsquedas y landings para más de 300 ciudades y comunas de Chile, así que apareces frente a clientes de tu zona.",
      },
      {
        question: "¿Necesito mostrar mi número de teléfono?",
        answer:
          "No es obligatorio. Puedes recibir contactos solo por el chat interno y activar WhatsApp más adelante si quieres.",
      },
      {
        question: "¿Puedo publicar como masajista o acompañante?",
        answer:
          "Sí. Además de escort puedes publicar como masajista erótica, acompañante o creadora de contenido, y elegir en qué categorías apareces.",
      },
    ],
  },
];

const BY_SLUG = new Map(ESCORT_LANDINGS.map((l) => [l.slug, l]));

export function getEscortLanding(slug: string): EscortLanding | undefined {
  return BY_SLUG.get(slug);
}

/** Landing hub: la que enlaza a todas las demás. */
export const ESCORT_LANDING_HUB = "creadoras";
