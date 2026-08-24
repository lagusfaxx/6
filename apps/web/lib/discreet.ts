/**
 * Modo discreto — el disfraz.
 *
 * QUÉ PROTEGE Y QUÉ NO (importante, y hay que decirlo en la interfaz):
 *
 * Protege de una mirada de reojo: alguien al lado en el metro, en la oficina
 * o en la mesa. Para eso sirve y para eso está pensado, porque el objetivo es
 * que el cliente pueda usar la app en público sin esconder la pantalla.
 *
 * NO protege de alguien que toma el teléfono y navega. El estudio de Turk y
 * Hutchings (CHI 2023) evaluó 727 sitios y clasifica "modificar la página para
 * que parezca otra cosa" como la implementación menos segura justamente por
 * esto: refrescar, apretar atrás o abrir el historial la delata. Mitigamos lo
 * que se puede desde el navegador (URL, título, favicon, historial) pero el
 * historial completo del dispositivo no se puede borrar desde una web. Por eso
 * existe además la salida rápida, que sí cumple todos sus criterios.
 *
 * El disfraz elegido es un marketplace genérico: la app ya es directorio más
 * chat, que es exactamente la forma de cualquier app de compraventa, así que
 * todo sigue funcionando sin inventar pantallas falsas.
 */

export const DISCREET_STORAGE_KEY = "uzeed:discreet";

/** Clase en <html> de la que cuelgan las reglas de CSS del disfraz. */
export const DISCREET_HTML_CLASS = "discreet";

/** Identidad visible mientras el disfraz está activo. */
export const DISCREET_BRAND = {
  name: "Cerca",
  tagline: "Publicaciones cerca de ti",
  /** Título de pestaña. Es de lo primero que delata al mirar el navegador. */
  documentTitle: "Cerca — Publicaciones cerca de ti",
  /** Favicon neutro, generado inline para no depender de un archivo nuevo. */
  favicon:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
        '<rect width="64" height="64" rx="14" fill="#3f4756"/>' +
        '<path d="M32 14c-7.2 0-13 5.8-13 13 0 9.7 13 23 13 23s13-13.3 13-23c0-7.2-5.8-13-13-13zm0 17.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" fill="#c9d1de"/>' +
        "</svg>",
    ),
  /** Color de la barra del navegador en móvil. */
  themeColor: "#2b303a",
} as const;

/**
 * Ruta neutra que se escribe en la barra de direcciones. No navega: solo
 * reemplaza la entrada actual del historial, así que el botón atrás tampoco
 * muestra la ruta real.
 */
export const DISCREET_URL_PATH = "/cerca-de-ti";

/**
 * Etiquetas de categoría del disfraz. La clave es la ruta real, para que la
 * navegación siga funcionando igual y solo cambie el texto.
 */
export const DISCREET_LABELS: Record<string, string> = {
  "/escorts": "Servicios",
  "/masajistas": "Bienestar",
  "/moteles": "Alojamiento",
  "/sexshop": "Tienda",
  "/marketplace": "Tienda personal",
  "/premium": "Destacados",
  "/cerca": "Cerca",
  "/services": "Todo",
  "/escorts?serviceTags=despedidas": "Eventos",
};

/** Devuelve la etiqueta a mostrar según el modo. */
export function discreetLabel(route: string, real: string, discreet: boolean): string {
  if (!discreet) return real;
  return DISCREET_LABELS[route] ?? real;
}

/**
 * Destinos de la salida rápida. Se ofrece más de uno porque lo plausible
 * depende de cada persona: para alguien el clima es lo natural, para otro un
 * buscador. Es la recomendación del mismo estudio.
 */
export const QUICK_EXIT_URL = "https://www.google.com";
