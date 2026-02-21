# Authentication & Security Scheme

> Last updated: 2026-02-21

## Overview

Uzeed uses **cookie-based session authentication** (not Bearer tokens).
The API server (`apps/api`) sets an `httpOnly` session cookie; the frontend
(`apps/web`) sends it automatically via `credentials: "include"`.

---

## Session Cookie

| Property        | Value                                    |
| --------------- | ---------------------------------------- |
| **Name**        | `uzeed_session`                          |
| **httpOnly**    | `true` — not accessible via JS           |
| **SameSite**    | `lax`                                    |
| **Secure**      | `true` in production, `false` in dev     |
| **Domain**      | `COOKIE_DOMAIN` env var (e.g. `.uzeed.cl`) |
| **Max-Age**     | 30 days                                  |
| **Store**       | PostgreSQL via `connect-pg-simple`       |

### Why cookies (not Bearer)?

- `httpOnly` prevents XSS from stealing the token.
- `SameSite=lax` prevents CSRF for state-changing requests (POST/PUT/PATCH/DELETE).
- No client-side token storage needed; the browser handles it.

---

## CSRF Protection

With `SameSite=lax`:

- **GET** requests are allowed cross-site (safe — our GETs are read-only).
- **POST/PUT/PATCH/DELETE** are blocked by the browser unless the request
  originates from the same site.

Combined with the strict CORS allowlist, this provides strong CSRF protection
without a dedicated CSRF token.

### CORS Configuration

```
Allowed origins: https://uzeed.cl, https://www.uzeed.cl, + CORS_ORIGIN env
Credentials:     true
Methods:         GET, POST, PUT, PATCH, DELETE, OPTIONS
```

State-mutating requests from any origin not in the allowlist are rejected
with `403 CORS_NOT_ALLOWED`.

---

## Rate-Limit Buckets

All rate-limit responses include a `Retry-After` header (seconds) and a JSON
body with `{ error: "TOO_MANY_REQUESTS", retryAfter: <seconds> }`.

| Bucket                    | Limit   | Window | Notes                               |
| ------------------------- | ------- | ------ | ----------------------------------- |
| **Global**                | 200/min | 60 s   | Catch-all for all endpoints         |
| **Discover / Directory**  | 60/min  | 60 s   | `/professionals`, `/profiles/discover`, `/home`, `/zones` |
| **Auth login/register**   | 30/min  | 60 s   | `/auth/login`, `/auth/register`     |
| **Auth general**          | 40/min  | 60 s   | `/auth/*` except login/register     |

Login/register have their own bucket so that a storm of `/auth/me` calls
(e.g. from multiple browser tabs) never blocks a real login attempt.

---

## Frontend Retry Policy

| Call type              | Retries | Strategy                                   |
| ---------------------- | ------- | ------------------------------------------ |
| **Catalog / Discovery**| 2       | Exponential backoff + jitter; respects `Retry-After` |
| **Auth (login, /me)**  | 0       | No automatic retries — surface the error   |
| **Mutations (POST…)**  | 0       | No automatic retries                       |

Implemented via `apiFetchWithRetry` (catalog) and plain `apiFetch` (auth/mutations)
in `apps/web/lib/api.ts`.

Only transient errors are retried: 429, 5xx, and network failures.
Client-side errors (4xx other than 429) are never retried.
`AbortError` (from `AbortController`) is never retried.

---

## Auth Flows

### Login
```
POST /auth/login  { email, password }
→ Sets uzeed_session cookie
→ Returns { user }
```

### Register
```
POST /auth/register  { email, password, username, profileType, … }
→ Sets uzeed_session cookie
→ Returns { user }
```

### Check session
```
GET /auth/me
→ 200 { user } (session valid)
→ 401 { error: "UNAUTHENTICATED" } (no session / expired)
```

### Logout
```
POST /auth/logout
→ Destroys session, clears cookie
```

---

## Public Endpoints (no session required)

The `requireAuth` middleware skips authentication for these prefixes:

- `/health`, `/ready`, `/version`
- `/uploads`
- `/auth` (login/register/me)
- `/categories`, `/banners`
- `/professionals`, `/profiles/discover`, `/profiles`
- `/motels`, `/cities`
- `/home` (summary, sections)
- `/zones` (with_supply)
- `/services` (GET list only), `/services/global`, `/map`
- `/webhooks/flow`

All other endpoints require a valid session cookie.

---

## Privacy & Discreción

- **No exact coordinates**: Public endpoints never return exact `latitude`/`longitude`.
  - `/home/sections` strips `lat`/`lng` — only returns `zone` (city name).
  - `/professionals` obfuscates coordinates within a 600m radius.
- **distanceKm**: Only computed when the user provides GPS-sourced location;
  manual location only shows zone name in the UI.
- **No address fields**: No address, street, or exact location is ever exposed.
- **Logging**: No sensitive user data (passwords, tokens, emails) is logged.
  Only structured request metadata (requestId, route, status) for debugging.

---

## Caching

| Endpoint            | Server TTL | Cache-Control header                           |
| ------------------- | ---------- | ---------------------------------------------- |
| `/home/summary`     | 60 s       | `public, max-age=60, stale-while-revalidate=30` |
| `/home/sections`    | 120 s      | `public, max-age=120, stale-while-revalidate=60` |
| `/cities/with_supply` | —        | No cache (low traffic)                         |

---

## VIP Mode Activation

The ranking algorithm automatically switches between standard and VIP mode
based on supply count in the queried city:

- **supply >= 25**: VIP mode — popularity 30%, distance 5% (city-wide discovery)
- **supply < 25**: Standard mode — distance 10%, popularity 20% (proximity matters more)

Anti-monopolization: In the trending section, Platinum/Premium profiles are
capped at 40% of slots to ensure tier diversity.

See `apps/api/src/lib/ranking.ts` for the complete formula.
