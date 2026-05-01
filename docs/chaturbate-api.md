# Chaturbate Affiliates API — Integración con `/live`

Esta página documenta cómo uzeed consume el feed público de afiliados de
Chaturbate para complementar la sección `/live` cuando no hay suficientes
transmisiones webrtc propias.

## Endpoint

```
GET https://chaturbate.com/api/public/affiliates/onlinerooms/
```

### Query params utilizados

| Parámetro          | Valor habitual          | Descripción |
| ------------------ | ----------------------- | ----------- |
| `wm`               | `Ifv4A`                 | Slug del programa de afiliados (server-side only). |
| `client_ip`        | IP real del visitante   | Necesario para que Chaturbate filtre rooms con bloqueo geográfico. Acepta `request_ip` como fallback. |
| `format`           | `json`                  | Forzamos JSON para parseo predecible. |
| `gender`           | `f`                     | f=mujeres, m=hombres, c=parejas, t=trans, s=parejas mismo sexo. |
| `region`           | `southamerica`          | Latinas — mejor conversión para audiencia chilena. |
| `hd`               | `true`                  | Solo rooms HD para mantener calidad visual. |
| `limit`            | `60`                    | Cantidad razonable; máximo soportado por la API es alto pero no lo necesitamos. |
| `tag`              | (opcional)              | Filtra por tag específico. |
| `exclude_genders`  | (opcional)              | CSV con géneros a excluir. |

### Headers

Solo `Accept: application/json` y un `User-Agent` identificador
(`uzeed-affiliate-feed/1.0`). No requiere autenticación adicional.

### Timeout

5 segundos. Si el endpoint no responde a tiempo (`AbortController`),
devolvemos array vacío con soft-fail; la sección `/live` muestra sólo las
transmisiones webrtc.

## Forma de la respuesta

```jsonc
{
  "count": 1234,
  "results": [
    {
      "username": "sample_streamer_22",
      "image_url": "https://roomimg.stream.highwebmedia.com/ri/sample_streamer_22.jpg",
      "image_url_360x270": "https://roomimg.stream.highwebmedia.com/riw/sample_streamer_22.jpg",
      "display_age": 24,
      "age": 24,
      "birthday": "2000-01-01",
      "location": "Bogotá, Colombia",
      "country": "CO",
      "num_users": 1834,
      "num_followers": 25400,
      "tags": ["latina", "petite", "smile"],
      "gender": "f",
      "current_show": "public",
      "is_hd": true,
      "is_new": false,
      "chat_room_url": "https://chaturbate.com/sample_streamer_22/",
      "chat_room_url_revshare": "https://chaturbate.com/in/?tour=...&campaign=Ifv4A&track=...",
      "iframe_embed": "<iframe src=\"...\"></iframe>",
      "iframe_embed_revshare": "<iframe src=\"...?campaign=Ifv4A\"></iframe>",
      "seconds_online": 1820
    }
  ]
}
```

## Reglas críticas del producto

1. **Siempre `chat_room_url_revshare`** para el iframe — ese es el link
   con 20% lifetime revshare. El `chat_room_url` normal entrega solo $1
   PPS y queda explícitamente prohibido en este proyecto.
   ⚠️ El campo a veces vuelve apuntando a la página pública del modelo
   (`https://chaturbate.com/<username>/?...`) que envía
   `X-Frame-Options: DENY` y NO se puede embeber. Por eso pasamos toda
   URL por `toEmbeddableUrl()` antes de exponerla al cliente, que reescribe
   el path a `/in/?room=<username>` (el "tour de afiliados" sí permite
   iframe). Regla operativa: cualquier iframe que apunte a chaturbate
   debe usar el formato `/in/?room=<username>`, nunca `/<username>/`.
2. **`wm=Ifv4A` jamás se expone al cliente.** Toda llamada a la API
   externa pasa por `apps/web/lib/chaturbate/api.ts` (server-side).
3. **`client_ip` es la IP real del visitante.** Se extrae de los headers
   del edge (`cf-connecting-ip`, `x-forwarded-for`, etc.) en
   `apps/web/lib/geo.ts`. Si no se puede determinar, usamos
   `request_ip` que indica a Chaturbate que use la IP origen del request.
4. **Tracking de fuente.** Cada iframe lleva
   `?track=uzeed_live_<source>` donde `source` ∈ {grid, home_row,
   perfil_reco, sidebar_reco, live_cam_page}. Esto permite ver en el
   dashboard de afiliados qué surface convierte mejor.
5. **Sin branding "chaturbate"** en URLs, textos, metadata o UI. El
   visitante percibe "videollamadas en vivo de uzeed".
6. **Age gate** — uzeed ya tiene uno global; no agregamos otro
   específico de `/live`.

## Caché

Implementación in-memory por proceso (`apps/web/lib/chaturbate/cache.ts`)
con TTL de 60s. Key compuesta: `cb:<countryCode>:<filters-hash>`.

- Visitantes del mismo país comparten respuesta cacheada.
- Filtros distintos generan keys distintas.
- Hay deduplicación de fetches en vuelo (`withInflight`) para evitar
  thundering herd cuando la entrada vence.

> **Nota:** el proyecto no tiene un cliente Redis instalado en
> `apps/web` al momento de esta integración. La caché actual es
> in-memory y se reinicia con cada deploy/restart del proceso. Para un
> entorno con múltiples instancias detrás de balanceador, considerar
> reemplazar el backend de `cache.ts` por `ioredis` reutilizando el
> mismo `getCached` / `setCached` / `withInflight`.

## Endpoints internos

### `GET /lives/feed`

Route handler de Next.js (`apps/web/app/lives/feed/route.ts`). Devuelve
el feed normalizado al cliente. **No** vive bajo `/api/*` porque ese
prefijo se rewrite-ea al backend Express en `next.config.mjs`.

#### Query params

| Param    | Default        | Notas |
| -------- | -------------- | ----- |
| `gender` | `f`            | f / m / c / t / s |
| `region` | `southamerica` | northamerica / southamerica / centralamerica / europe_russia / asia / other |
| `hd`    | `true`         | `true` / `false` / `1` / `0` |
| `limit`  | `60`           | Max 120 |
| `tag`    | —              | Tag opcional |

#### Respuesta

```ts
type LivesFeedResponse = {
  cams: ExternalLiveCam[];   // ver lib/chaturbate/types.ts
  count: number;
  cached: boolean;
  country: string | null;
};
```

## Surfaces que consumen el feed

| Surface                            | Componente                | Track source        |
| ---------------------------------- | ------------------------- | ------------------- |
| Grilla de `/live`                  | `app/live/page.tsx`       | `uzeed_live_grid`   |
| Fila horizontal en home            | `components/live/LivesRow.tsx` | `uzeed_home_row` |
| Sección "También disponibles ahora" en perfil | `components/live/RelatedCams.tsx` | `uzeed_perfil_reco` |
| Sidebar dentro del modal/cam page  | `components/live/LiveCamModal.tsx` y `app/live/cam/[username]/LiveCamClient.tsx` | `uzeed_sidebar_reco` |

Todas las cards externas atraviesan el helper `withTrack(embedUrl, source)`
de `lib/chaturbate/transform.ts` antes de cargarse en un `<iframe>`.
