# CLAUDE.md - Uzeed

## Proyecto

Uzeed es una plataforma marketplace/social chilena para profesionales de servicios, establecimientos y comercios. Incluye videollamadas monetizadas, livestreaming, sistema de tokens/wallet y suscripciones.

## Stack

- **Monorepo**: pnpm 9.12.3 workspaces
- **API**: Express.js 4.21 + TypeScript (puerto 3001)
- **Web**: Next.js 14.2 con App Router + Tailwind CSS (puerto 3000)
- **DB**: PostgreSQL 17 con Prisma 5.22 (60+ modelos)
- **Shared**: Paquete compartido con esquemas Zod, tipos y enums
- **Runtime**: Node.js 20
- **Video**: LiveKit (videollamadas y livestreaming)
- **Pagos**: Khipu + Flow (CLP)

## Estructura

```
apps/api/       - Backend Express (40+ routers)
apps/web/       - Frontend Next.js (App Router, 40+ rutas)
packages/shared/ - Tipos, esquemas Zod, enums compartidos
prisma/         - Schema y migraciones de Prisma
infra/          - Docker Compose y Dockerfiles
docs/           - Documentacion del proyecto
scripts/        - Scripts de utilidad
```

## Comandos

```bash
pnpm install              # Instalar dependencias
pnpm -r build             # Build de todos los paquetes (valida merge markers primero)
pnpm -r dev               # Dev mode (API en :3001, Web en :3000)
pnpm -r lint              # Linting
pnpm -r format            # Formateo con Prettier
pnpm -r typecheck         # Verificacion de tipos

# Docker (desarrollo)
docker compose -f infra/docker-compose.dev.yml up

# Base de datos
npx prisma migrate dev --schema=prisma/schema.prisma    # Crear migracion
npx prisma migrate deploy --schema=prisma/schema.prisma # Aplicar migraciones
npx prisma generate --schema=prisma/schema.prisma       # Regenerar cliente
```

## Convenciones

- **Validacion**: Usar esquemas Zod del paquete `@uzeed/shared` para validar inputs
- **Tipos de perfil**: CLIENT, VIEWER, CREATOR, PROFESSIONAL, ESTABLISHMENT, SHOP
- **Autenticacion**: Sesiones con cookies httpOnly respaldadas en PostgreSQL
- **Archivos**: Subida local a `./uploads`, procesamiento con Sharp
- **Seguridad**: CSRF por validacion de Origin, rate limiting (600 req/min), helmet, CORS
- **Cron jobs**: Worker separado (`worker.ts`), deduplicacion via DB con `ReminderLog`
- **Precios**: En CLP. Membresia mensual: $4990 CLP. Trial: 7 dias

## Arquitectura clave

- El API es monolitico con routers modulares en `apps/api/src/routes/`
- Sistema de tokens con wallet: depositos, escrow para videollamadas, tips, retiros
- SSE para eventos en tiempo real
- Notificaciones: push web + email (Resend/SMTP) + in-app
- Build: `tsup` para API y shared, `next build` (standalone) para web

## Base de datos

- Schema en `prisma/schema.prisma`
- Modelos principales: User, Wallet, TokenTransaction, Post, Media, VideocallBooking, LiveStream, ServiceItem, Notification, Payment, UmateCreator
- Siempre correr `prisma generate` despues de modificar el schema

## Health checks

- `GET /health` - Siempre 200
- `GET /ready` - Verifica conectividad con DB

## Pre-commit

- `scripts/validate-no-merge-markers.mjs` detecta marcadores de conflicto sin resolver (se ejecuta antes del build)
