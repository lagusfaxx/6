/**
 * Landings para DUEÑOS de moteles (lado oferta del directorio).
 *
 * El directorio /moteles capta al cliente que busca "moteles en Providencia".
 * Estas páginas captan al otro lado: el dueño o administrador que busca cómo
 * publicar su motel, cómo recibir reservas online o dónde hacer publicidad.
 * Cada variante apunta a una intención distinta, con su URL canónica, H1,
 * texto y preguntas propias, para que no se canibalicen entre sí.
 *
 * Consumidas por components/motels/MotelOwnerLanding.tsx y por el sitemap.
 * Ojo con lo que se promete: publicar hoy no tiene costo (el cobro está
 * apagado) y UZEED no cobra comisión por reserva (el cliente paga en el
 * motel). No afirmar nada que el producto no haga.
 */

export type OwnerLandingFaq = { question: string; answer: string };

export type MotelOwnerLanding = {
  slug: string;
  /** <title> sin " | UZEED" (lo pone el layout). */
  title: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  intro: string;
  seoSection: { heading: string; paragraphs: string[] };
  faq: OwnerLandingFaq[];
};

const NO_COMMISSION =
  "UZEED no cobra comisión por reserva: el cliente paga directo en el motel, como siempre.";

export const MOTEL_OWNER_LANDINGS: MotelOwnerLanding[] = [
  {
    slug: "publicar-motel",
    title: "Publica tu motel gratis en el directorio de moteles de Chile",
    metaDescription:
      "Publica tu motel u hotel por hora en UZEED: ficha con fotos, habitaciones y tarifas, página en tu comuna y reservas por chat. Crear la ficha no tiene costo y no pedimos tarjeta.",
    keywords: [
      "publicar motel",
      "publicar mi motel",
      "directorio de moteles",
      "directorio de moteles santiago",
      "aparecer en directorio de moteles",
      "registrar motel",
      "publicar hotel por hora",
      "moteles chile directorio",
    ],
    eyebrow: "Para dueños de moteles",
    h1: "Publica tu motel en el directorio de moteles de UZEED",
    intro:
      "Crea la ficha de tu motel con fotos, habitaciones y tarifas por 3 horas, 6 horas y noche. Apareces en la página de tu comuna, los clientes te encuentran en Google y te piden reserva por chat. Crear la ficha no tiene costo y no pedimos tarjeta.",
    seoSection: {
      heading: "Un directorio de moteles hecho para que te encuentren",
      paragraphs: [
        "Cuando alguien busca \"moteles en Providencia\" o \"motel con jacuzzi en Santiago\", quiere comparar tres cosas antes de salir: fotos reales, precio y cómo llegar. La mayoría de los moteles tiene esa información repartida entre un sitio desactualizado, un Instagram y el teléfono de recepción. En UZEED todo queda en una sola ficha, pensada para esa búsqueda.",
        "Cada comuna de Santiago y las principales ciudades del país tienen su propia página de moteles en UZEED. Tu motel aparece en la de tu comuna y en las cercanas, ordenado junto a los demás con su foto, su precio desde y sus comodidades. Los clientes filtran por jacuzzi, estacionamiento privado, habitaciones temáticas, atención 24 horas o promociones, y llegan a tu ficha.",
        "Tu ficha muestra cada habitación con sus fotos y tarifas, las comodidades del local, el horario, la ubicación en el mapa y las reseñas de quienes reservaron por UZEED. Tú la editas desde el celular cuando quieras: cambias una foto, subes un precio o pausas una habitación en mantención y el cambio se ve al instante.",
        `${NO_COMMISSION} La reserva llega como solicitud a tu panel y a tu chat; la aceptas o la rechazas con un toque y el cliente recibe un código para presentar al llegar.`,
      ],
    },
    faq: [
      {
        question: "¿Cuánto cuesta publicar mi motel en UZEED?",
        answer:
          "Crear y publicar la ficha no tiene costo hoy y no pedimos tarjeta. Si en el futuro hubiera un plan pagado, te avisaríamos antes desde el panel. Además UZEED no cobra comisión por reserva: el cliente paga en el motel.",
      },
      {
        question: "¿Qué necesito para publicar mi motel?",
        answer:
          "Un correo, el nombre y la dirección del motel, algunas fotos y las tarifas de tus habitaciones. En menos de 15 minutos tienes la ficha lista. El equipo de UZEED revisa cada motel antes de sumarlo al directorio.",
      },
      {
        question: "¿En qué páginas aparece mi motel?",
        answer:
          "En el directorio general de moteles, en la página de tu comuna (por ejemplo, Moteles en Providencia), como sugerencia en las comunas cercanas y en tu propia página, que puedes compartir en Instagram, Google Maps o WhatsApp.",
      },
      {
        question: "¿Puedo ocultar el motel o cerrarlo por un día?",
        answer:
          "Sí. Desde el panel marcas si estás abierto ahora (cerrado no recibe reservas nuevas) y puedes ocultar la ficha del directorio sin borrar nada, por ejemplo durante una remodelación.",
      },
      {
        question: "Mi motel ya aparece en UZEED, ¿cómo lo administro?",
        answer:
          "Algunos moteles fueron agregados por el equipo con datos públicos. Crea tu cuenta como Motel / Hotel y escríbenos desde la página de Contacto: unimos la ficha a tu cuenta para que la manejes tú.",
      },
    ],
  },
  {
    slug: "reservas-online-motel",
    title: "Reservas online para moteles: recibe reservas por chat, sin comisión",
    metaDescription:
      "Sistema de reservas para moteles y hoteles por hora: el cliente elige habitación, duración y hora, tú aceptas desde el celular y le llega un código de reserva. Sin comisión por reserva.",
    keywords: [
      "reservas online motel",
      "sistema de reservas para moteles",
      "software para moteles",
      "reservas motel por hora",
      "app para moteles",
      "reservas hotel por hora",
      "motel reservas por whatsapp",
    ],
    eyebrow: "Reservas para moteles",
    h1: "Recibe reservas online en tu motel, sin comisión",
    intro:
      "Tus clientes eligen habitación, duración (3 horas, 6 horas o noche) y hora de llegada. Te llega la solicitud al panel y al chat, la aceptas con un toque y el cliente recibe un código de reserva. Sin comisión por reserva: el pago se hace en el motel.",
    seoSection: {
      heading: "Cómo funcionan las reservas de motel en UZEED",
      paragraphs: [
        "El cliente entra a la ficha de tu motel, compara habitaciones con sus fotos y tarifas, elige la duración y la hora de llegada, y envía la solicitud. Si tienes una promoción vigente, el descuento se aplica solo y el cliente ve el precio final antes de enviar.",
        "La solicitud te llega en vivo al panel del motel y como mensaje en el chat de UZEED. La aceptas, o la rechazas indicando el motivo (sin habitaciones, local cerrado u otro), y el cliente se entera al instante. Cuando el cliente confirma, recibe un código de reserva y la dirección con el enlace para llegar.",
        "En el panel ves las solicitudes por aceptar, las llegadas de hoy y de los próximos días ordenadas por hora, y el historial. Si cierras por un rato, marcas \"cerrado\" y dejas de recibir solicitudes nuevas sin despublicar la ficha.",
        `${NO_COMMISSION} No hay integración que instalar ni equipos que comprar: el panel funciona en el celular de recepción.`,
      ],
    },
    faq: [
      {
        question: "¿UZEED cobra comisión por cada reserva?",
        answer:
          "No. UZEED no cobra comisión por reserva ni procesa el pago: el cliente paga en el motel con los medios que tú aceptes.",
      },
      {
        question: "¿Cómo sé que el cliente va a llegar?",
        answer:
          "El cliente confirma la reserva después de que tú la aceptas y recibe un código para presentar en recepción. Toda la conversación queda en el chat, donde puedes escribirle antes de la hora de llegada.",
      },
      {
        question: "¿Puedo rechazar una solicitud?",
        answer:
          "Sí. Eliges el motivo (sin habitaciones, local cerrado u otro) y el cliente recibe el aviso por chat al instante.",
      },
      {
        question: "¿Necesito instalar algo?",
        answer:
          "No. El panel funciona en el navegador del celular o del computador de recepción. Las solicitudes llegan en vivo y también como notificación.",
      },
      {
        question: "¿Puedo tener tarifas distintas por habitación y duración?",
        answer:
          "Sí. Cada habitación tiene su tarifa por 3 horas, 6 horas y noche; dejas vacía la duración que no ofreces. Las promociones pueden aplicarse a todas las habitaciones o sólo a algunas.",
      },
    ],
  },
  {
    slug: "publicidad-para-moteles",
    title: "Publicidad para moteles en Chile: llena tus horas bajas",
    metaDescription:
      "Publicidad para moteles y hoteles por hora: aparece en Google cuando buscan moteles en tu comuna, publica promociones de horario bajo y recibe reservas por chat en UZEED.",
    keywords: [
      "publicidad para moteles",
      "marketing para moteles",
      "como llenar mi motel",
      "promociones para moteles",
      "publicidad hotel por hora",
      "clientes para mi motel",
      "publicitar motel santiago",
    ],
    eyebrow: "Publicidad para moteles",
    h1: "Publicidad para tu motel donde la gente ya está buscando",
    intro:
      "Quien busca \"motel en Ñuñoa\" o \"motel con jacuzzi\" en Google ya decidió salir: sólo le falta elegir dónde. UZEED pone tu motel en esa búsqueda, con fotos, precio y promociones, y convierte la visita en una reserva por chat.",
    seoSection: {
      heading: "Marketing para moteles que se mide en reservas",
      paragraphs: [
        "La publicidad tradicional para moteles (volantes, avisos pagados, redes sociales) llega a mucha gente que no está buscando motel ese día. Las búsquedas en Google son lo contrario: \"moteles en Santiago Centro\", \"motel cerca de mí\" o \"motel con estacionamiento privado\" las escribe alguien que quiere ir ahora.",
        "UZEED tiene una página de moteles para cada comuna de Santiago y las principales ciudades de Chile, preparada para aparecer en esas búsquedas. Tu motel se muestra en la de tu comuna y en las cercanas, con su foto de portada, su precio desde y sus comodidades.",
        "Las promociones son tu mejor herramienta para las horas bajas: un descuento de lunes a jueves o antes de las 18:00 se ve como etiqueta en el directorio y en tu ficha, y se aplica solo cuando el cliente reserva. Las programas con fecha de inicio y término, y las pausas cuando ya no las necesitas.",
        `Cada visita puede terminar en una reserva por chat, sin llamadas perdidas. ${NO_COMMISSION}`,
      ],
    },
    faq: [
      {
        question: "¿Cómo aparece mi motel en Google con UZEED?",
        answer:
          "UZEED tiene una página por comuna (por ejemplo, Moteles en Providencia) y una página propia para cada motel, con título, descripción y datos estructurados pensados para Google. Tu motel aparece en ambas apenas el equipo aprueba la ficha.",
      },
      {
        question: "¿Qué promociones puedo publicar?",
        answer:
          "Descuentos en porcentaje o en pesos, para todas las habitaciones o sólo algunas, con fecha de inicio y término opcionales. Se muestran con una etiqueta en el directorio y el descuento se aplica al reservar.",
      },
      {
        question: "¿Cuánto cuesta aparecer en el directorio?",
        answer:
          "Publicar la ficha no tiene costo hoy y no pedimos tarjeta. Si en el futuro hubiera un plan pagado, te avisaríamos antes desde el panel. UZEED no cobra comisión por reserva.",
      },
      {
        question: "¿Puedo compartir mi ficha en redes sociales?",
        answer:
          "Sí. Tu motel tiene una dirección propia en UZEED (uzeed.cl/motel/tu-motel) que puedes poner en Instagram, en Google Maps o enviar por WhatsApp: quien la abre ve fotos, tarifas y puede reservar.",
      },
    ],
  },
];

export function getMotelOwnerLanding(slug: string) {
  return MOTEL_OWNER_LANDINGS.find((l) => l.slug === slug);
}
