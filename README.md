# UZEED

Plataforma de suscripción mensual tipo OnlyFans para Chile (Khipu), con paywall, perfiles, servicios y sesiones seguras.

## Estructura
- `apps/web` Next.js 14 App Router (UI)
- `apps/api` Node.js + Express (API)
- `packages/shared` tipos y schemas (compila a JS)
- `prisma` schema + migrations
- `infra` docker-compose dev

## Reglas críticas
- Node en producción ejecuta **solo JS** (api y shared compilan a CJS)
- Backend-first: DB + API es la fuente de verdad

## Dev local (Docker)
1) Copia `.env.example` a `.env` y ajusta valores.
2) Ejecuta:
```bash
cd infra
docker compose -f docker-compose.dev.yml up --build
```
3) Abre:
- Web: http://localhost:3000
- API: http://localhost:3001/health

## Deploy
Ver `docs/COOLIFY.md`

## PWA + Push notifications (iOS/Android)
1) Genera claves VAPID:
```bash
npx web-push generate-vapid-keys
```
2) Configura en `.env`:
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (mismo valor que `VAPID_PUBLIC_KEY`)
3) Ejecuta migraciones para crear `PushSubscription`:
```bash
pnpm --filter prisma prisma migrate deploy
```
4) iOS: las notificaciones push web funcionan cuando el usuario instala la app desde Safari ("Añadir a pantalla de inicio") y acepta permisos.
