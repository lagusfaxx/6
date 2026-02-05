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
