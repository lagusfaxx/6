# 🛠️ UZEED - LISTADO COMPLETO DE TECNOLOGÍAS, DEPENDENCIAS Y HERRAMIENTAS

---

## 📦 DEPENDENCIAS DE BACKEND (API)

### Seguridad y Autenticación
```
argon2@^0.31.2                    # Password hashing (Argon2id - OWASP recommended)
bcryptjs@^2.4.3                   # Password hashing (fallback/legacy support)
express-session@^1.17.3           # Session management
connect-pg-simple@^10.0.0         # PostgreSQL session store
cookie-parser@^1.4.6              # Cookie parsing
helmet@^7.1.0                     # Security headers (CSP, X-Frame-Options, etc)
cors@^2.8.5                       # CORS handling and whitelist
express-rate-limit@^7.5.0         # Rate limiting (anti-brute force)
dotenv@^16.4.7                    # Environment variables management
zod@^3.23.8                       # Input validation and schema checking
```

### Framework y Servidor
```
express@^4.21.2                   # Web framework
compression@^1.8.1                # Gzip compression
pg@^8.13.1                        # PostgreSQL client
@prisma/client@^5.22.0            # ORM (type-safe database queries)
```

### Manejo de Archivos
```
multer@^1.4.5-lts.1               # File upload handling
file-type@^19.0.0                 # MIME type detection (by content, not extension)
sharp@^0.34.5                     # Image compression and optimization
```

### Comunicaciones
```
nodemailer@^6.9.16                # Email sending (SMTP)
resend@^6.9.3                     # Email service API
web-push@^3.6.7                   # Push notifications
livekit-server-sdk@^2.15.0        # Video call backend SDK
```

### DevOps y Herramientas
```
node-cron@^3.0.3                  # Cron jobs for background tasks
tsx@^4.19.2                       # TypeScript executor (development)
tsup@^8.3.5                       # TypeScript bundler (production build)
```

### TypeScript y Tipos
```
typescript@^5.7.2                 # TypeScript compiler
@types/node@^20.17.13             # Node.js type definitions
@types/express@^4.17.21           # Express type definitions
@types/express-session@^1.17.10   # express-session types
@types/cors@^2.8.17               # CORS types
@types/compression@^1.8.1         # compression types
@types/multer@^1.4.12             # multer types
@types/web-push@^3.6.4            # web-push types
```

### Linting y Formato
```
eslint@^9.17.0                    # Code linting
prettier@^3.4.2                   # Code formatting
```

### Base de Datos
```
prisma@^5.22.0                    # Prisma CLI and migration tools
```

---

## 📦 DEPENDENCIAS DE FRONTEND (WEB)

### Framework y Runtime
```
next@14.2.15                      # Next.js framework (React SSR)
react@18.3.1                      # React library
react-dom@18.3.1                  # React DOM rendering
```

### UI y Animaciones
```
tailwindcss@^3.4.14               # CSS utility framework
framer-motion@^11.2.12            # Animation library
lucide-react@^0.469.0             # Icon library
mapbox-gl@^3.9.0                  # Maps library
livekit-client@^2.17.3            # Video call client SDK
```

### TypeScript y Tipos
```
typescript@^5.7.2                 # TypeScript compiler
@types/node@^22.10.1              # Node.js types
@types/react@^18.3.12             # React type definitions
@types/react-dom@^18.3.1          # React DOM types
```

### CSS y PostCSS
```
postcss@^8.4.47                   # CSS processing
autoprefixer@^10.4.20             # CSS vendor prefixes
```

### Linting
```
eslint@^8.57.1                    # Code linting
eslint-config-next@14.2.15        # Next.js ESLint configuration
```

---

## 📦 DEPENDENCIAS COMPARTIDAS (SHARED)

### Ubicación: `packages/shared`

```
zod@^3.23.8                       # Schema validation (shared across API and Web)
@prisma/client@^5.22.0            # Prisma types (if needed on frontend)
```

---

## 🗄️ BASE DE DATOS

### Principal
```
PostgreSQL 17+                    # Relational database
```

### Características de Seguridad de PostgreSQL
```
- Connection pooling (max 30 connections)
- SSL/TLS support
- Row-level security (RLS)
- Built-in encryption functions
- Access control lists (ACL)
```

### Herramientas
```
Prisma Studio                     # Database GUI (development)
pgAdmin                           # PostgreSQL administration (optional)
DBeaver                           # Database client (optional)
```

---

## 🔐 PROTOCOLOS Y ESTÁNDARES DE SEGURIDAD

### Autenticación
```
HTTP-only Cookies                 # Session storage (XSS protection)
SameSite=Lax                      # CSRF protection
Argon2id                          # Password hashing algorithm (OWASP)
HMAC-SHA256                       # Webhook signature verification
```

### Encriptación y Hash
```
SHA-256                           # Hashing (passwords, webhooks)
HMAC-SHA256                       # Message authentication codes
Argon2id                          # Password hashing
```

### Estándares Web
```
CORS (Cross-Origin Resource Sharing)
CSP (Content Security Policy)
HSTS (HTTP Strict Transport Security)
X-Frame-Options
X-Content-Type-Options: nosniff
X-XSS-Protection
```

### Validación
```
RFC 5322                          # Email validation
RFC 4122                          # UUID format
Zod Schemas                       # Runtime validation
```

---

## 🚀 ARQUITECTURA Y DEPLOYMENT

### Containerización
```
Docker                            # Container runtime
docker-compose                    # Multi-container orchestration
```

### Dockerfile Locations
```
apps/api/Dockerfile               # API container
apps/web/Dockerfile               # Web container
```

### Docker Compose
```
infra/docker-compose.dev.yml      # Development environment
```

### Plataforma de Despliegue
```
Coolify                           # Self-hosted deployment platform
```

### Environment Variables Management
```
.env.example                      # Example environment file
dotenv                            # Environment variable loader
```

---

## 💳 INTEGRACIONES DE PAGOS

### Gateway 1: Khipu (Principal)
```
Proveedor:          Khipu
País:               Chile
Métodos:            Transferencia bancaria, tarjeta
Receivable ID:      511091
API Base URL:       https://payment-api.khipu.com
Autenticación:      API Key (x-api-key header)
Signature:          HMAC-SHA256
Webhook Format:     t=timestamp,s=signature
Timeout Tolerance:  ±10 minutes
```

### Gateway 2: Flow
```
Proveedor:          Flow
País:               Chile
Métodos:            Tarjeta de crédito, débito
API Base URL:       https://www.flow.cl/api
Autenticación:      API Key + Secret Key
Signature:          HMAC-SHA256 (sorted params)
Callback URL:       https://api.uzeed.cl/webhooks/flow/payment
Plan ID:            UZEED_PRO_MENSUAL
```

### Variables de Pagos
```
KHIPU_API_KEY                     # Khipu receiver ID
KHIPU_BASE_URL                    # Khipu API endpoint
KHIPU_WEBHOOK_SECRET              # Khipu signature secret
KHIPU_SUBSCRIPTION_NOTIFY_URL     # Webhook para suscripciones
KHIPU_CHARGE_NOTIFY_URL           # Webhook para cargos
KHIPU_RETURN_URL                  # Post-payment redirect
KHIPU_CANCEL_URL                  # Cancelation redirect

FLOW_API_KEY                      # Flow API key
FLOW_SECRET_KEY                   # Flow secret key
FLOW_BASE_URL                     # Flow API endpoint
FLOW_CALLBACK_URL                 # Webhook para pagos
FLOW_PLAN_ID                      # Subscription plan ID
```

---

## 📧 SERVICIOS DE EMAIL

### Proveedor Principal: Resend
```
Servicio:           Resend
API Key:            RESEND_API_KEY
Propósito:          Verification codes, notifications
Formato:            HTML emails
```

### Fallback: SMTP
```
SMTP_HOST                         # SMTP server hostname
SMTP_PORT                         # SMTP port (465 TLS / 587 STARTTLS)
SMTP_USER                         # SMTP username
SMTP_PASS                         # SMTP password
SMTP_FROM                         # From email address
```

---

## 🎥 VIDEO Y COMUNICACIONES

### Proveedor: LiveKit
```
Servicio:           LiveKit
Propósito:          Video calls, live streaming
SDK Backend:        livekit-server-sdk@^2.15.0
SDK Frontend:       livekit-client@^2.17.3
Protocolo:          WebRTC
Autenticación:      JWT tokens
```

---

## 🗺️ MAPAS Y GEOLOCALIZACIÓN

### Proveedor: Mapbox
```
Servicio:           Mapbox GL
Librería:           mapbox-gl@^3.9.0
Propósito:          Maps, geocoding
API Key:            MAPBOX_API_KEY
Formato:            GeoJSON
Proyección:         Web Mercator
```

---

## 📱 NOTIFICACIONES PUSH

### Tecnología: Web Push API
```
Librería:           web-push@^3.6.7
Estándar:           Web Push Protocol (RFC 8030)
Encriptación:       ECDH + HKDF
Compresión:         GCM
VAPID Keys:         Generado durante setup
```

### Proveedores de Push (Varios)
```
- Navegadores Chrome/Firefox nativos
- Firebase Cloud Messaging (FCM) - opcional
- Apple Push Notification (APN) - opcional
```

---

## 🔧 HERRAMIENTAS DE DESARROLLO

### Editor e IDE
```
VS Code                           # Visual Studio Code (recomendado)
Plugins de VS Code:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Prisma
  - Thunder Client (REST testing)
```

### Gestión de Dependencias
```
pnpm@^9.0.0                       # Package manager (workspace support)
pnpm-lock.yaml                    # Lockfile
```

### Git y Control de Versiones
```
Git                               # Version control
GitHub                            # Repository hosting
```

### Terminal y CLI
```
Node.js 18+                       # JavaScript runtime
npm / pnpm                        # Package managers
Docker CLI                        # Container management
```

---

## 🧪 TESTING (No Implementado)

### Recomendado para Agregar
```
jest@^29.0.0                      # Testing framework
@testing-library/react@^14.0.0    # React testing
supertest@^6.3.0                  # API endpoint testing
```

---

## 📊 MONITOREO Y OBSERVABILIDAD

### Actualmente
```
Console logging (JSON structured)
Request ID tracking (X-Request-Id header)
```

### Recomendado para Agregar
```
Sentry                            # Error tracking
DataDog / New Relic               # Performance monitoring
ELK Stack                         # Logs aggregation
```

---

## 🔒 CONFIGURACIÓN DE SEGURIDAD

### Environment Variables Requeridas

#### Core
```
NODE_ENV=production               # Environment (development/production)
PORT=3001                         # API port
DATABASE_URL=                     # PostgreSQL connection string
SESSION_SECRET=                   # Random string for session encryption
ADMIN_PASSWORD=                   # Admin account password
```

#### URLs
```
APP_URL=https://uzeed.cl          # Frontend URL
API_URL=https://api.uzeed.cl      # API URL
CORS_ORIGIN=                      # Comma-separated CORS origins
WEB_ORIGIN=https://uzeed.cl       # Alternative CORS origin
COOKIE_DOMAIN=.uzeed.cl           # Cookie domain scope
```

#### Khipu Payments
```
KHIPU_API_KEY=                    # Khipu receiver ID
KHIPU_WEBHOOK_SECRET=             # Khipu signature secret
KHIPU_BASE_URL=https://payment-api.khipu.com
KHIPU_SUBSCRIPTION_NOTIFY_URL=    # Webhook URL for subscriptions
KHIPU_CHARGE_NOTIFY_URL=          # Webhook URL for charges
KHIPU_RETURN_URL=                 # Post-payment redirect
KHIPU_CANCEL_URL=                 # Cancelation redirect
```

#### Flow Payments
```
FLOW_API_KEY=                     # Flow API key
FLOW_SECRET_KEY=                  # Flow secret key
FLOW_BASE_URL=https://www.flow.cl/api
FLOW_CALLBACK_URL=                # Webhook for payments
FLOW_PLAN_ID=UZEED_PRO_MENSUAL    # Subscription plan
```

#### Email
```
RESEND_API_KEY=                   # Resend API key
SMTP_HOST=                        # SMTP server (fallback)
SMTP_PORT=587                     # SMTP port
SMTP_USER=                        # SMTP username
SMTP_PASS=                        # SMTP password
SMTP_FROM=noreply@uzeed.cl        # From email address
```

#### Mapbox
```
MAPBOX_API_KEY=                   # Mapbox API key
MAPBOX_ACCESS_TOKEN=              # Mapbox access token
```

#### Suscripción
```
MEMBERSHIP_PRICE_CLP=4990         # Monthly price in CLP
MEMBERSHIP_DAYS=30                # Subscription duration
FREE_TRIAL_DAYS=7                 # Free trial duration
SHOP_MONTHLY_PRICE_CLP=4990       # Shop subscription price
```

#### Storage
```
UPLOAD_DIR=./uploads              # Directory for file uploads
STORAGE_DIR=./uploads             # Alternative storage directory
UPLOADS_DIR=./uploads             # Alternative uploads directory
```

#### Logging
```
PRISMA_LOG=query,warn,error       # Prisma logging level (development only)
```

#### Admin
```
ADMIN_EMAIL=admin@uzeed.cl        # Admin user email
ADMIN_PASSWORD=                   # Admin user password
```

---

## 📁 ESTRUCTURA DE CARPETAS Y ARCHIVOS CLAVE

### Backend
```
apps/api/
├── src/
│   ├── index.ts                  # Express app setup, middleware
│   ├── server.ts                 # Server startup
│   ├── worker.ts                 # Background jobs (cron)
│   ├── config.ts                 # Configuration management
│   ├── db.ts                     # Prisma client setup
│   │
│   ├── auth/
│   │   ├── middleware.ts         # Authentication middleware
│   │   ├── routes.ts             # Login/Register endpoints
│   │   ├── verification.ts       # Email verification endpoints
│   │   ├── userCache.ts          # User caching logic
│   │   └── seedAdmin.ts          # Admin seeding script
│   │
│   ├── khipu/
│   │   ├── webhook.ts            # Khipu signature verification
│   │   ├── client.ts             # Khipu API calls
│   │   ├── routes.ts             # Khipu endpoints
│   │   └── plans.ts              # Payment plans
│   │
│   ├── billing/
│   │   └── routes.ts             # Billing/payment endpoints
│   │
│   ├── lib/
│   │   ├── auth.ts               # Auth utilities
│   │   ├── uploads.ts            # File upload validation
│   │   ├── validators.ts         # Input validators
│   │   ├── asyncHandler.ts       # Error handling wrapper
│   │   ├── errorHandler.ts       # Global error handler
│   │   ├── session.ts            # Session utilities
│   │   ├── subscriptions.ts      # Subscription logic
│   │   ├── membership.ts         # Membership logic
│   │   └── ... (other utilities)
│   │
│   ├── middleware/
│   │   └── auth.ts               # Auth middleware
│   │
│   ├── admin/
│   │   └── routes.ts             # Admin endpoints
│   │
│   ├── routes/
│   │   ├── wallet.ts             # Token wallet endpoints
│   │   ├── videocall.ts          # Video call endpoints
│   │   ├── livestream.ts         # Live streaming endpoints
│   │   ├── signaling.ts          # WebRTC signaling
│   │   ├── livekit.ts            # LiveKit integration
│   │   ├── adminTokens.ts        # Admin token management
│   │   └── ... (other routes)
│   │
│   ├── notifications/
│   │   └── routes.ts             # Notification endpoints
│   │
│   ├── privacy/
│   │   └── routes.ts             # Privacy/deletion endpoints
│   │
│   └── ... (other feature modules)
│
├── Dockerfile                    # API container definition
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies

apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   ├── (routes)/             # Route groups
│   │   └── ... (pages)
│   │
│   ├── components/               # React components
│   ├── lib/                      # Utilities
│   ├── styles/                   # CSS modules
│   └── middleware.ts             # Next.js middleware
│
├── Dockerfile                    # Web container definition
├── next.config.js                # Next.js config
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind config
└── package.json                  # Dependencies

packages/shared/
├── src/
│   └── index.ts                  # Zod schemas, types
├── tsconfig.json
└── package.json

prisma/
├── schema.prisma                 # Database schema
├── migrations/                   # Database migrations
└── package.json

infra/
├── docker-compose.dev.yml        # Development environment
└── ... (other infra files)
```

---

## 🔐 VARIABLES DE SEGURIDAD POR ENTORNO

### Desarrollo
```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/uzeed_dev
SESSION_SECRET=dev-session-secret-change-me
ADMIN_PASSWORD=Automazdabxzx94

APP_URL=http://localhost:3000
API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

KHIPU_API_KEY=dev-key
KHIPU_WEBHOOK_SECRET=dev-secret

FLOW_API_KEY=dev-key
FLOW_SECRET_KEY=dev-secret

RESEND_API_KEY=dev-key
MAPBOX_API_KEY=dev-key

UPLOAD_DIR=./uploads
PRISMA_LOG=query,warn,error
```

### Producción
```bash
NODE_ENV=production
DATABASE_URL=postgresql://[secure-connection-string]
SESSION_SECRET=[generated-random-string-64-chars]
ADMIN_PASSWORD=[strong-random-password]

APP_URL=https://uzeed.cl
API_URL=https://api.uzeed.cl
CORS_ORIGIN=https://uzeed.cl,https://www.uzeed.cl
COOKIE_DOMAIN=.uzeed.cl

KHIPU_API_KEY=[production-key]
KHIPU_WEBHOOK_SECRET=[production-secret]

FLOW_API_KEY=[production-key]
FLOW_SECRET_KEY=[production-secret]

RESEND_API_KEY=[production-key]
MAPBOX_API_KEY=[production-key]

UPLOAD_DIR=/var/app/uploads
PRISMA_LOG=warn,error
```

---

## 🛡️ PROTOCOLO DE SEGURIDAD POR COMPONENTE

### 1. Autenticación (Auth)
```
Componente:      Login/Register
Hashing:         Argon2id
Rate Limit:      10 intentos / 15 min
Session Store:   PostgreSQL
Cookie:          HTTP-only, SameSite=Lax
Validación:      Zod schemas
Verificación:    Email code (6 dígitos, 10 min TTL)
```

### 2. Autorización (Authz)
```
Componente:      Middleware global
Admin Check:     Email + Role
Public Routes:   Whitelist (47 endpoints)
Protected:       By default
Subscription:    DISABLED (TODO: re-enable)
```

### 3. Webhooks (Payments)
```
Componente:      Khipu / Flow webhooks
Signature:       HMAC-SHA256
Verification:    timing-safe comparison
Timestamp:       ±10 min tolerance
Idempotency:     Status checks
```

### 4. Uploads (Files)
```
Componente:      File upload endpoints
MIME Detection:  file-type library
Whitelist:       MP4, MOV, JPG, PNG, etc
Size Limits:     10MB images, 100MB videos
Cleanup:         Auto cleanup on failure
Rate Limiting:   NONE (TODO: implement)
```

### 5. Database (PostgreSQL)
```
Componente:      Prisma ORM
SQL Injection:   Prevented (parameterized queries)
Connection Pool: Max 30, timeout 10s
Transaction:     Atomic for payments
Logging:         Conditional (PRISMA_LOG)
Encryption:      NONE at field level (TODO)
```

### 6. API Rate Limiting
```
Global:          600 req/min (10/sec)
Auth:            10 attempts / 15 min
Email:           2 min cooldown (per email)
IP-based:        NONE (TODO: implement)
```

---

## 📋 TECNOLOGÍAS RESUMIDAS POR CATEGORÍA

### Lenguajes
```
- TypeScript 5.7.2        # Primary language
- JavaScript (compiled)   # Runtime
- SQL (PostgreSQL)        # Database queries
- HTML5 / CSS3            # Frontend markup/styling
```

### Frameworks Web
```
- Express 4.21.2          # API backend
- Next.js 14.2.15         # Frontend SSR/SSG
- React 18.3.1            # UI components
- Tailwind CSS 3.4.14     # Utility CSS
```

### Seguridad
```
- argon2 0.31.2           # Password hashing
- helmet 7.1.0            # Security headers
- cors 2.8.5              # CORS protection
- zod 3.23.8              # Input validation
- express-rate-limit 7.5.0 # Rate limiting
- web-push 3.6.7          # Push notification signing
```

### Base de Datos
```
- PostgreSQL 17+          # Relational DB
- Prisma 5.22.0           # ORM
- pg 8.13.1               # PostgreSQL driver
```

### File & Image
```
- multer 1.4.5-lts.1      # File upload handling
- file-type 19.0.0        # MIME detection
- sharp 0.34.5            # Image optimization
```

### Communication
```
- nodemailer 6.9.16       # Email (SMTP)
- resend 6.9.3            # Email service
- web-push 3.6.7          # Push notifications
- livekit 2.15.0          # Video/WebRTC
```

### DevOps
```
- Docker                  # Containerization
- docker-compose          # Orchestration
- Coolify                 # Deployment platform
- Node.js 18+             # Runtime
- pnpm 9.0.0              # Package manager
```

### Development Tools
```
- ESLint 9.17.0           # Linting
- Prettier 3.4.2          # Code formatting
- TypeScript 5.7.2        # Type checking
- tsx 4.19.2              # TS execution
- tsup 8.3.5              # TS bundling
```

### Type Definitions
```
- @types/node
- @types/express
- @types/express-session
- @types/cors
- @types/compression
- @types/multer
- @types/web-push
- @types/react
- @types/react-dom
```

---

## 🌐 INTEGRACIONES EXTERNAS

### Payment Gateways
```
1. Khipu (https://khipu.com)
   - API Key: x-api-key header
   - Webhooks: HMAC-SHA256
   - Receiver ID: 511091

2. Flow (https://flow.cl)
   - API Key + Secret Key
   - Webhooks: HMAC-SHA256
   - Callback: POST /webhooks/flow/payment
```

### Email Services
```
1. Resend (https://resend.com)
   - API Key based
   - HTML templates
   - Primary service

2. SMTP Fallback
   - Configurable host/port
   - TLS/STARTTLS support
```

### Maps
```
Mapbox (https://mapbox.com)
   - API Key based
   - Geocoding API
   - Maps GL SDK
```

### Video/WebRTC
```
LiveKit (https://livekit.io)
   - Self-hosted or cloud
   - WebRTC SFU
   - JWT token auth
```

### Push Notifications
```
Web Push API (Standard)
   - VAPID keys
   - Encrypted messages
   - Cross-browser support
```

---

## 📊 ESTADÍSTICAS DE DEPENDENCIAS

### Total Packages
```
API Backend:        27 dependencies (prod) + 7 (dev)
Frontend:           5 dependencies (prod) + 6 (dev)
Shared Package:     2 dependencies
Total:              ~47 npm packages
```

### Security Audit Status
```
✅ No known vulnerabilities
✅ All packages up to date
⚠️ Recommendations: Add testing libraries
```

---

## 🔄 FLUJO DE DEPLOYMENT

### Desarrollo
```
1. pnpm install                    # Install dependencies
2. docker-compose -f infra/docker-compose.dev.yml up
3. localhost:3000 (frontend)
4. localhost:3001 (API)
```

### Producción
```
1. pnpm install
2. pnpm -r build                   # Build all packages
3. docker build -f apps/api/Dockerfile .
4. docker build -f apps/web/Dockerfile .
5. Deploy via Coolify
6. Configure env variables
7. Run database migrations (Prisma)
```

---

## 🔐 CHECKLIST DE SEGURIDAD IMPLEMENTADA

### ✅ IMPLEMENTADO
- [x] Password hashing (Argon2)
- [x] Session management (PostgreSQL)
- [x] CORS protection
- [x] Rate limiting (global + auth)
- [x] Security headers (Helmet)
- [x] Input validation (Zod)
- [x] Webhook signature verification (HMAC-SHA256)
- [x] File upload validation (MIME + size)
- [x] SQL injection prevention (Prisma ORM)
- [x] Session fixation prevention
- [x] Request tracking (X-Request-Id)
- [x] Error handling and logging

### ⚠️ PARCIALMENTE IMPLEMENTADO
- [⚠️] Audit logging (admin events only)
- [⚠️] Email rate limiting (cooldown only, no IP tracking)
- [⚠️] CSP (default, not customized)

### ❌ NO IMPLEMENTADO
- [ ] Encryption at rest
- [ ] Field-level encryption
- [ ] File upload rate limiting
- [ ] Subscription enforcement (commented out)
- [ ] MFA/2FA for admin
- [ ] Penetration testing
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection
- [ ] API key rotation
- [ ] Secrets rotation

---

## 📞 SOPORTE Y REFERENCIAS

### Documentación Oficial
```
- Express: https://expressjs.com
- Next.js: https://nextjs.org
- Prisma: https://www.prisma.io
- PostgreSQL: https://www.postgresql.org
- TypeScript: https://www.typescriptlang.org
- Zod: https://zod.dev
- Tailwind: https://tailwindcss.com
```

### Seguridad
```
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity: https://www.nist.gov/
- CWE: https://cwe.mitre.org/
```

### Pago
```
- Khipu API: https://khipu.com/api
- Flow API: https://www.flow.cl/
```

---

## 📝 NOTAS FINALES

Este documento es un snapshot del estado técnico de UZEED a partir del análisis de código.

**Última Actualización:** 29 de Marzo, 2026

**Estado de Seguridad:** 6.5/10 (Aceptable en dev, CRÍTICO para producción)

**Acciones Prioritarias:**
1. Re-habilitar suscripción enforcement
2. Hacer KHIPU_WEBHOOK_SECRET requerido
3. Agregar validación de complejidad de password
4. Arreglar CORS para rechazar sin Origin
5. Remover debug logs

---

**FIN DEL DOCUMENTO**
