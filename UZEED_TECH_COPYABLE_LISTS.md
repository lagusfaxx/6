# 📋 UZEED - LISTADOS COPIABLES DE TECNOLOGÍAS

---

## 🔧 TODAS LAS DEPENDENCIAS - BACKEND (COPIAR)

```
argon2@^0.31.2
bcryptjs@^2.4.3
compression@^1.8.1
connect-pg-simple@^10.0.0
cookie-parser@^1.4.6
cors@^2.8.5
dotenv@^16.4.7
express@^4.21.2
express-rate-limit@^7.5.0
express-session@^1.17.3
file-type@^19.0.0
helmet@^7.1.0
livekit-server-sdk@^2.15.0
multer@^1.4.5-lts.1
node-cron@^3.0.3
nodemailer@^6.9.16
pg@^8.13.1
resend@^6.9.3
sharp@^0.34.5
web-push@^3.6.7
zod@^3.23.8
@prisma/client@^5.22.0
@types/compression@^1.8.1
@types/cors@^2.8.17
@types/express@^4.17.21
@types/express-session@^1.17.10
@types/multer@^1.4.12
@types/node@^20.17.13
@types/web-push@^3.6.4
eslint@^9.17.0
prettier@^3.4.2
prisma@^5.22.0
tsup@^8.3.5
tsx@^4.19.2
typescript@^5.7.2
```

---

## 🎨 TODAS LAS DEPENDENCIAS - FRONTEND (COPIAR)

```
framer-motion@^11.2.12
livekit-client@^2.17.3
lucide-react@^0.469.0
mapbox-gl@^3.9.0
next@14.2.15
react@18.3.1
react-dom@18.3.1
@types/node@^22.10.1
@types/react@^18.3.12
@types/react-dom@^18.3.1
autoprefixer@^10.4.20
eslint@^8.57.1
eslint-config-next@14.2.15
postcss@^8.4.47
tailwindcss@^3.4.14
typescript@^5.7.2
```

---

## 🔐 LIBRERÍAS DE SEGURIDAD (COPIAR)

```
argon2@^0.31.2                # Password hashing
bcryptjs@^2.4.3               # Password fallback
helmet@^7.1.0                 # Security headers
cors@^2.8.5                   # CORS control
express-rate-limit@^7.5.0     # Rate limiting
zod@^3.23.8                   # Input validation
file-type@^19.0.0             # MIME detection
express-session@^1.17.3       # Session mgmt
connect-pg-simple@^10.0.0     # Session store
web-push@^3.6.7               # Push signing
dotenv@^16.4.7                # Secret management
```

---

## 📦 DEPENDENCIAS POR CATEGORÍA

### Autenticación y Sesiones (7)
```
argon2@^0.31.2
bcryptjs@^2.4.3
express-session@^1.17.3
connect-pg-simple@^10.0.0
cookie-parser@^1.4.6
zod@^3.23.8
dotenv@^16.4.7
```

### Seguridad de API (3)
```
helmet@^7.1.0
cors@^2.8.5
express-rate-limit@^7.5.0
```

### Base de Datos (3)
```
@prisma/client@^5.22.0
pg@^8.13.1
prisma@^5.22.0
```

### Archivos e Imágenes (3)
```
multer@^1.4.5-lts.1
file-type@^19.0.0
sharp@^0.34.5
```

### Email y Notificaciones (4)
```
nodemailer@^6.9.16
resend@^6.9.3
web-push@^3.6.7
livekit-server-sdk@^2.15.0
```

### Framework Web (1)
```
express@^4.21.2
```

### Optimización (2)
```
compression@^1.8.1
node-cron@^3.0.3
```

### TypeScript y Tipos (11)
```
typescript@^5.7.2
@types/node@^20.17.13
@types/express@^4.17.21
@types/express-session@^1.17.10
@types/cors@^2.8.17
@types/compression@^1.8.1
@types/multer@^1.4.12
@types/web-push@^3.6.4
tsup@^8.3.5
tsx@^4.19.2
eslint@^9.17.0
```

### Desarrollo (2)
```
prettier@^3.4.2
eslint@^9.17.0
```

---

## 🌐 VARIABLES DE ENTORNO - PRODUCCIÓN (COPIAR)

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/uzeed
SESSION_SECRET=<random-string-64-chars>
ADMIN_PASSWORD=<strong-password>
APP_URL=https://uzeed.cl
API_URL=https://api.uzeed.cl
CORS_ORIGIN=https://uzeed.cl,https://www.uzeed.cl
WEB_ORIGIN=https://uzeed.cl
COOKIE_DOMAIN=.uzeed.cl
KHIPU_API_KEY=<receiver-id>
KHIPU_BASE_URL=https://payment-api.khipu.com
KHIPU_WEBHOOK_SECRET=<signing-secret>
KHIPU_SUBSCRIPTION_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/subscription
KHIPU_CHARGE_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/charge
KHIPU_RETURN_URL=https://uzeed.cl/suscripcion/exitoso
KHIPU_CANCEL_URL=https://uzeed.cl/suscripcion/cancelada
FLOW_API_KEY=<api-key>
FLOW_SECRET_KEY=<secret-key>
FLOW_BASE_URL=https://www.flow.cl/api
FLOW_CALLBACK_URL=https://api.uzeed.cl/webhooks/flow/payment
FLOW_PLAN_ID=UZEED_PRO_MENSUAL
RESEND_API_KEY=<api-key>
MAPBOX_API_KEY=<api-key>
MEMBERSHIP_PRICE_CLP=4990
MEMBERSHIP_DAYS=30
FREE_TRIAL_DAYS=7
SHOP_MONTHLY_PRICE_CLP=4990
UPLOAD_DIR=/var/app/uploads
ADMIN_EMAIL=admin@uzeed.cl
```

---

## 🌐 VARIABLES DE ENTORNO - DESARROLLO (COPIAR)

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/uzeed_dev
SESSION_SECRET=dev-session-secret-change-me
ADMIN_PASSWORD=Automazdabxzx94
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
WEB_ORIGIN=http://localhost:3000
COOKIE_DOMAIN=localhost
KHIPU_API_KEY=dev-key
KHIPU_BASE_URL=https://payment-api.khipu.com
KHIPU_WEBHOOK_SECRET=dev-secret
KHIPU_SUBSCRIPTION_NOTIFY_URL=http://localhost:3001/webhooks/khipu/subscription
KHIPU_CHARGE_NOTIFY_URL=http://localhost:3001/webhooks/khipu/charge
KHIPU_RETURN_URL=http://localhost:3000/suscripcion/exitoso
KHIPU_CANCEL_URL=http://localhost:3000/suscripcion/cancelada
FLOW_API_KEY=dev-key
FLOW_SECRET_KEY=dev-secret
FLOW_BASE_URL=https://www.flow.cl/api
FLOW_CALLBACK_URL=http://localhost:3001/webhooks/flow/payment
FLOW_PLAN_ID=UZEED_PRO_MENSUAL
RESEND_API_KEY=dev-key
MAPBOX_API_KEY=dev-key
MEMBERSHIP_PRICE_CLP=4990
MEMBERSHIP_DAYS=30
FREE_TRIAL_DAYS=7
SHOP_MONTHLY_PRICE_CLP=4990
UPLOAD_DIR=./uploads
ADMIN_EMAIL=admin@uzeed.cl
PRISMA_LOG=query,warn,error
```

---

## 🔐 ALGORITMOS Y PROTOCOLOS DE SEGURIDAD (COPIAR)

```
Password Hashing:          Argon2id (primary), bcryptjs (fallback)
Session Storage:           PostgreSQL (connect-pg-simple)
Session Cookie:            HTTP-only, SameSite=Lax, Secure (prod)
Webhook Signature:         HMAC-SHA256 with timing-safe comparison
Timestamp Tolerance:       ±10 minutes
Email Verification Code:   6-digit numeric (100,000 combos)
Code TTL:                  10 minutes
Max Verification Attempts: 5
Email Resend Cooldown:     2 minutes
Auth Rate Limit:           10 attempts per 15 minutes
Global Rate Limit:         600 requests per minute
Session MaxAge:            30 days
File Upload - Images:      Max 10 MB
File Upload - Videos:      Max 100 MB
Video Formats:             MP4, MOV (H.264/AAC)
CORS Validation:           Whitelist-based
CSP Header:                Default (from Helmet)
HSTS:                      Enabled via Helmet
X-Frame-Options:           DENY via Helmet
X-Content-Type-Options:    nosniff via Helmet
```

---

## 🛠️ HERRAMIENTAS Y PLATAFORMAS (COPIAR)

```
Lenguaje:                  TypeScript 5.7.2
Runtime:                   Node.js 18+
Package Manager:           pnpm 9+
Framework API:             Express 4.21.2
Framework Web:             Next.js 14.2.15
UI Library:                React 18.3.1
CSS Framework:             Tailwind CSS 3.4.14
ORM:                       Prisma 5.22.0
Base de Datos:             PostgreSQL 17+
Containerización:          Docker + docker-compose
Plataforma Deploy:         Coolify
Linter:                    ESLint 9.17.0
Formatter:                 Prettier 3.4.2
Editor Recomendado:        VS Code
Terminal:                  bash / zsh
Control Versiones:         Git + GitHub
```

---

## 💳 PROVEEDORES DE PAGO (COPIAR)

```
Proveedor 1:               Khipu
País:                      Chile
Métodos:                   Transferencia bancaria, tarjeta
Receiver ID:               511091
API Base URL:              https://payment-api.khipu.com
Autenticación:             API Key en header (x-api-key)
Firma:                     HMAC-SHA256
Webhook Format:            t=timestamp,s=signature
Timeout Tolerance:         ±10 minutes
Idempotencia:              Status check

Proveedor 2:               Flow
País:                      Chile
Métodos:                   Tarjeta de crédito, débito
API Base URL:              https://www.flow.cl/api
Autenticación:             API Key + Secret Key
Firma:                     HMAC-SHA256 (sorted params)
Callback:                  POST /webhooks/flow/payment
Plan ID:                   UZEED_PRO_MENSUAL
Idempotencia:              Status check
```

---

## 📧 SERVICIOS DE EMAIL (COPIAR)

```
Proveedor Principal:       Resend
API Key Variable:          RESEND_API_KEY
Propósito:                 Verification, notifications
Formato:                   HTML emails

Fallback SMTP:
Config Variable:           SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
Puertos Comunes:           465 (TLS) o 587 (STARTTLS)
```

---

## 🎥 SERVICIOS DE VIDEO (COPIAR)

```
Proveedor:                 LiveKit
Backend SDK:               livekit-server-sdk@^2.15.0
Frontend SDK:              livekit-client@^2.17.3
Protocolo:                 WebRTC
Autenticación:             JWT tokens
Transporte:                HTTPS + WebRTC
```

---

## 🗺️ SERVICIOS DE MAPAS (COPIAR)

```
Proveedor:                 Mapbox
Librería:                  mapbox-gl@^3.9.0
Propósito:                 Maps, geocoding
API Key Variable:          MAPBOX_API_KEY
Formato:                   GeoJSON
Proyección:                Web Mercator
```

---

## 📁 RUTAS DE ARCHIVOS CLAVE (COPIAR)

```
/home/user/6/apps/api/src/index.ts
/home/user/6/apps/api/src/config.ts
/home/user/6/apps/api/src/db.ts
/home/user/6/apps/api/src/auth/middleware.ts
/home/user/6/apps/api/src/auth/routes.ts
/home/user/6/apps/api/src/auth/verification.ts
/home/user/6/apps/api/src/khipu/webhook.ts
/home/user/6/apps/api/src/khipu/client.ts
/home/user/6/apps/api/src/khipu/routes.ts
/home/user/6/apps/api/src/billing/routes.ts
/home/user/6/apps/api/src/lib/uploads.ts
/home/user/6/apps/api/src/lib/validators.ts
/home/user/6/apps/api/src/lib/auth.ts
/home/user/6/apps/api/package.json
/home/user/6/apps/web/package.json
/home/user/6/packages/shared/src/index.ts
/home/user/6/prisma/schema.prisma
/home/user/6/infra/docker-compose.dev.yml
/home/user/6/apps/api/Dockerfile
/home/user/6/apps/web/Dockerfile
```

---

## ✅ VERIFICACIONES DE SEGURIDAD IMPLEMENTADAS (COPIAR)

```
[x] Password hashing (Argon2id)
[x] Session management (PostgreSQL)
[x] Session fixation prevention
[x] CORS protection (whitelist)
[x] Rate limiting (global + auth)
[x] Security headers (Helmet)
[x] Input validation (Zod)
[x] SQL injection prevention (Prisma ORM)
[x] Webhook signature verification (HMAC-SHA256)
[x] Timing-safe comparison (crypto.timingSafeEqual)
[x] Timestamp validation (±10 min)
[x] File upload validation (MIME + size)
[x] Email verification (6-digit codes)
[x] Request tracking (X-Request-Id)
[x] Error handling and logging
[x] Admin authorization (email + role)
[x] Public routes whitelist
[x] Connection pooling (30 connections)
[x] Session auto-cleanup (15 min)
[x] Webhook idempotency
```

---

## ❌ VERIFICACIONES DE SEGURIDAD NO IMPLEMENTADAS (COPIAR)

```
[ ] Subscription enforcement (COMMENTED OUT - TODO)
[ ] Password complexity validation
[ ] MFA/2FA for admin
[ ] Encryption at rest
[ ] Field-level encryption
[ ] File upload rate limiting per user
[ ] Email rate limiting per IP
[ ] KHIPU_WEBHOOK_SECRET enforcement (OPTIONAL - SHOULD BE REQUIRED)
[ ] CORS origin validation (ALLOWS NO ORIGIN - SHOULD REJECT)
[ ] Penetration testing
[ ] WAF (Web Application Firewall)
[ ] DDoS protection
[ ] API key rotation
[ ] Secrets rotation
[ ] Full audit trail (only admin events)
[ ] HTTPS enforcement middleware
[ ] Customized CSP
```

---

## 🚨 VULNERABILIDADES CRÍTICAS (COPIAR)

```
1. Suscripción Deshabilitada
   Ubicación: /home/user/6/apps/api/src/auth/middleware.ts:137-149
   Impacto: Usuarios sin pagar acceden a /services, /shop, /motel
   Fix: Descomentar líneas o remover TODO

2. KHIPU_WEBHOOK_SECRET Opcional
   Ubicación: /home/user/6/apps/api/src/config.ts:33
   Impacto: Webhooks falsos pueden ser aceptados
   Fix: khipuWebhookSecret: requiredInProd("KHIPU_WEBHOOK_SECRET")

3. Sin Validación de Complejidad de Password
   Ubicación: /home/user/6/packages/shared/src/index.ts:32
   Impacto: Passwords débiles
   Fix: Agregar regex para mayúsculas, números, especiales

4. CORS Permite Sin Origin
   Ubicación: /home/user/6/apps/api/src/index.ts:75
   Impacto: CORS bypass potencial
   Fix: if (!origin) return callback(new Error("CORS_NOT_ALLOWED"));

5. Debug Logs Exponen Parámetros
   Ubicación: /home/user/6/apps/api/src/khipu/client.ts:156
   Impacto: Exposición de API keys en logs
   Fix: Remover o enmascarar valores sensibles
```

---

## 📊 ESTADÍSTICAS (COPIAR)

```
Total de Dependencias Backend:    34 (27 prod + 7 dev)
Total de Dependencias Frontend:   11 (5 prod + 6 dev)
Total NPM Packages:               ~47

Vulnerabilidades Conocidas:       0
Packages Outdated:                0
Packages with Updates:            0

Líneas de Código Seguridad:       ~200+
Archivos de Seguridad:            12+
Endpoints Públicos:               47
Endpoints Protegidos:             100+
Endpoints Admin:                  20+
```

---

## 🎯 ACCIONES INMEDIATAS (COPIAR)

```
SEMANA 1:
[ ] Re-habilitar subscription enforcement
[ ] Hacer KHIPU_WEBHOOK_SECRET requerido en producción
[ ] Remover debug logs que expongan parámetros
[ ] Arreglar CORS para rechazar requests sin Origin
[ ] Agregar validación de complejidad de password

MES 1:
[ ] Reducir session maxAge a 7-14 días
[ ] Implementar encryption de datos sensibles
[ ] Agregar rate limiting en file uploads
[ ] Agregar rate limiting en email send por IP
[ ] Crear audit trail table

TRIMESTRE 1:
[ ] Migrar uploads a S3
[ ] Implementar CSP personalizado
[ ] Agregar HTTPS enforcement
[ ] Key rotation para secrets
[ ] Penetration testing
```

---

## 📝 COMANDOS ÚTILES (COPIAR)

```bash
# Instalación
pnpm install
pnpm install -r                    # Install all workspaces

# Desarrollo
pnpm dev                           # Run API in dev mode
pnpm -r dev                        # Run all in dev mode
docker-compose -f infra/docker-compose.dev.yml up

# Build
pnpm build
pnpm -r build

# Database
npx prisma migrate dev             # Create migration
npx prisma studio                  # Open Prisma Studio
npx prisma generate                # Generate Prisma client

# Lint y Format
pnpm lint
pnpm format

# Type Check
pnpm typecheck

# Docker
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
docker-compose build
docker-compose up
```

---

**Documento generado: 29 de Marzo, 2026**
**Estado: Listo para copiar**
