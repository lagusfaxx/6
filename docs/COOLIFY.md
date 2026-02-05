# Deploy UZEED en Coolify (click-by-click)

> Objetivo: **2 servicios** (web + api) + **Postgres 17** + **worker** separado.

## 0) Prerrequisitos
- VPS Ubuntu 24.04 con Coolify funcionando
- DNS:
  - `A uzeed.cl -> VPS_IP`
  - `A api.uzeed.cl -> VPS_IP`
- SSL:
  - Recomendado: Cloudflare Full Strict + Let's Encrypt en Coolify, o Let's Encrypt directo

## 1) Crear la base de datos (Postgres 17)
1. En Coolify → **Resources** → **New**
2. Selecciona **PostgreSQL**
3. Versión: **17**
4. Nombre: `uzeed-db`
5. Setea:
   - DB: `uzeed`
   - User/Pass seguros
6. Crea la instancia.
7. Copia el `DATABASE_URL` desde la UI (o arma):
   - `postgresql://USER:PASS@HOST:5432/uzeed?schema=public`

## 2) Service: API (api.uzeed.cl)
1. **New Resource → Application**
2. Source: tu repo GitHub (branch correcto)
3. **Build Pack: Dockerfile**
4. **Base Directory:** `/` (RAÍZ DEL REPO)
5. **Dockerfile Path:** `apps/api/Dockerfile`
6. Port: `3001`
7. Domain: `https://api.uzeed.cl`
8. Environment Variables (mínimas):
   - `NODE_ENV=production`
   - `DATABASE_URL=...`
   - `SESSION_SECRET=...`
   - `COOKIE_DOMAIN=.uzeed.cl`
   - `APP_URL=https://uzeed.cl`
   - `API_URL=https://api.uzeed.cl`
   - `CORS_ORIGIN=https://uzeed.cl,https://www.uzeed.cl`
   - `UPLOADS_DIR=uploads`
   - `KHIPU_API_KEY=5c24de64-13fd-4f64-bdd4-acabe2c46bbb`
   - `KHIPU_SUBSCRIPTION_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/subscription`
   - `KHIPU_CHARGE_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/charge`
   - `KHIPU_RETURN_URL=https://uzeed.cl/dashboard`
   - `KHIPU_CANCEL_URL=https://uzeed.cl/dashboard`
   - `MEMBERSHIP_DAYS=30`
   - `MEMBERSHIP_PRICE_CLP=4990`
   - `SHOP_MONTHLY_PRICE_CLP=10000`
   - `ADMIN_EMAIL=admin@uzeed.cl`
   - `ADMIN_PASSWORD=Automazdabxzx94`
   - (SMTP opcional)
9. Deploy.
10. Verifica: `GET https://api.uzeed.cl/health` → `{ ok: true }`
11. Si el frontend muestra **Failed to fetch** y en la consola aparece
    `net::ERR_CERT_AUTHORITY_INVALID`, el problema es el **certificado SSL del API**.
    Solución rápida:
    - Asegura que `api.uzeed.cl` tenga un certificado válido (Let's Encrypt en Coolify).
    - En Cloudflare usa **SSL/TLS → Full (strict)** y activa **Always Use HTTPS**.
    - Espera a que el certificado se emita y vuelve a probar `https://api.uzeed.cl/health`.

## 3) Service: WORKER (cron/email) — opción A
1. Duplicar la app API (o nueva Application mismo repo)
2. Base Directory: `/`
3. Dockerfile: `apps/api/Dockerfile`
4. **Command override:** `node dist/worker.cjs`
5. NO expone dominios/puertos.
6. Mismas env vars que API (al menos DATABASE_URL y SMTP si quieres email).

## 4) Service: WEB (uzeed.cl)
1. **New Resource → Application**
2. Source: mismo repo/branch
3. Build Pack: Dockerfile
4. Base Directory: `/`
5. Dockerfile Path: `apps/web/Dockerfile`
6. Port: `3000`
7. Domain: `https://uzeed.cl`
   - **Importante (Traefik/Coolify):** usa *solo* dominio en el rule de `Host`.
     - ✅ `Host(\`uzeed.cl\`)`
     - ❌ `Host(\`\`) && PathPrefix(\`uzeed.cl\`)` (provoca `empty args for matcher Host`)
   - No agregues `PathPrefix` con el dominio ni `StripPrefix` con `uzeed.cl`/`www.uzeed.cl`.
     Esos middlewares son para rutas (ej: `/api`), no para hostnames.
8. Env vars:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_API_URL=https://api.uzeed.cl`
9. Deploy.

### Acceso al panel Admin
- El usuario admin se crea automáticamente al iniciar la API.
- Credenciales por defecto:
  - Email: `admin@uzeed.cl`
  - Clave: `Automazdabxzx94`
- Puedes sobrescribir con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

### Solución rápida a error de proxy "Host(``) ... empty args"
- En Coolify → **Resources → Web app → Domains/Proxy**, elimina reglas con:
  - `Host(\`\`) && PathPrefix(\`uzeed.cl\`)`
  - `Host(\`\`) && PathPrefix(\`www.uzeed.cl\`)`
- Deja solo reglas con `Host(\`uzeed.cl\`)` y `Host(\`www.uzeed.cl\`)`, sin `PathPrefix`.

### Container Labels listos (Traefik)
> Copia/pega estos labels en la sección de **Container Labels** del servicio web.
> Están corregidos para evitar `Host(\`\`)` y no usan `PathPrefix`/`StripPrefix`.
> Importante: cada label va en **una sola línea**. No los pegues en la misma línea
> porque Traefik interpreta el valor completo como el nombre del middleware.

**Texto listo para copiar/pegar (una línea por label):**

```
traefik.enable=true
traefik.http.middlewares.gzip.compress=true
traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https

traefik.http.routers.web-http.entryPoints=http
traefik.http.routers.web-http.rule=Host(`uzeed.cl`) || Host(`www.uzeed.cl`)
traefik.http.routers.web-http.middlewares=redirect-to-https
traefik.http.routers.web-http.service=web

traefik.http.routers.web-https.entryPoints=https
traefik.http.routers.web-https.rule=Host(`uzeed.cl`) || Host(`www.uzeed.cl`)
traefik.http.routers.web-https.tls=true
traefik.http.routers.web-https.middlewares=gzip
traefik.http.routers.web-https.service=web

traefik.http.services.web.loadbalancer.server.port=3000
```

### Container Labels listos (Caddy - opcional)
> Solo si usas Caddy en lugar de Traefik.

```
caddy_0=uzeed.cl
caddy_0.encode=zstd gzip
caddy_0.reverse_proxy={{upstreams 3000}}
caddy_0.header=-Server

caddy_1=www.uzeed.cl
caddy_1.encode=zstd gzip
caddy_1.reverse_proxy={{upstreams 3000}}
caddy_1.header=-Server

caddy_ingress_network=coolify
```

## 5) Checklist de producción
- Cloudflare SSL mode: Full (Strict)
- CORS: `WEB_ORIGIN=https://uzeed.cl`
- Cookie Domain: `.uzeed.cl`
- HTTPS en ambos dominios
- Postgres accesible desde los contenedores
- Webhook Khipu apunta a:
  - `https://api.uzeed.cl/webhooks/khipu/subscription`
  - `https://api.uzeed.cl/webhooks/khipu/charge`
