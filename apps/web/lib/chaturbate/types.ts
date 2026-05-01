/**
 * Tipos de la API pública de afiliados de Chaturbate.
 * Endpoint: https://chaturbate.com/api/public/affiliates/onlinerooms/
 *
 * Solo se consume server-side: los tipos se definen acá y los detalles
 * propietarios (wm, IP del visitante) jamás se exponen al cliente.
 */

export type ChaturbateGender = "f" | "m" | "c" | "t" | "s";

export type ChaturbateRegion =
  | "northamerica"
  | "southamerica"
  | "centralamerica"
  | "europe_russia"
  | "asia"
  | "other";

export interface ChaturbateRoom {
  username: string;
  image_url: string;
  image_url_360x270: string;
  display_age?: number | null;
  age?: number | null;
  birthday?: string | null;
  location: string | null;
  country: string | null;
  num_users: number;
  num_followers?: number;
  tags?: string[];
  gender: ChaturbateGender | string;
  current_show?: string | null;
  is_hd?: boolean;
  is_new?: boolean;
  chat_room_url: string;
  chat_room_url_revshare: string;
  iframe_embed?: string;
  iframe_embed_revshare?: string;
  seconds_online?: number;
}

export interface ChaturbateApiResponse {
  count: number;
  results: ChaturbateRoom[];
}

export interface ChaturbateFilters {
  gender?: ChaturbateGender;
  region?: ChaturbateRegion;
  hd?: boolean;
  limit?: number;
  excludeGenders?: ChaturbateGender[];
  tag?: string;
}

export interface ChaturbateFetchInput extends ChaturbateFilters {
  /** IP real del visitante — chaturbate la usa para filtrar rooms con bloqueo geográfico. */
  clientIp: string;
  /** Código ISO del país del visitante — usado solo para la key de caché. */
  countryCode: string;
}

/**
 * Forma normalizada que consume el front. No incluye URLs internas, ni
 * el campo non-revshare, ni cualquier dato propietario del API.
 */
export interface ExternalLiveCam {
  source: "external";
  /** username de chaturbate — usado como id estable */
  username: string;
  /** nombre humanizado: sample_streamer_22 → "Sample" */
  displayName: string;
  age: number | null;
  countryCode: string | null;
  /** nombre del país en español */
  countryName: string | null;
  /** ubicación libre tal como llega del API (ya filtrada) */
  location: string | null;
  thumbnailUrl: string;
  thumbnailUrlSmall: string;
  viewerCount: number;
  isHd: boolean;
  isNew: boolean;
  tags: string[];
  /**
   * URL embebible del chat de afiliados, ya normalizada al formato
   * `https://chaturbate.com/in/?room=<username>&...` (la página pública
   * `/<username>/` envía X-Frame-Options: DENY y queda excluida).
   * Antes de meterla en un `<iframe src=...>` debe pasar por
   * `withTrack(embedUrl, source)` para agregar el track de la fuente.
   */
  embedUrl: string;
}

export interface LivesFeedResponse {
  cams: ExternalLiveCam[];
  count: number;
  /** Indica si la respuesta vino de caché — útil para debug. */
  cached: boolean;
  /** Código de país detectado (debug, no se muestra al usuario). */
  country: string | null;
}
