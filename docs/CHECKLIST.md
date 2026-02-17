# Checklist final (antes de decir “listo para producción”)

## Build local
- [ ] `pnpm install` genera `pnpm-lock.yaml`
- [ ] `pnpm -r build` OK (shared, api, web)
- [ ] `docker build -f apps/api/Dockerfile .` OK
- [ ] `docker build -f apps/web/Dockerfile .` OK

## Dev compose
- [ ] `docker compose -f infra/docker-compose.dev.yml up --build` OK
- [ ] `GET http://localhost:3001/health` → `{ ok: true }`
- [ ] Register/Login OK
- [ ] Feed muestra blur sin membresía
- [ ] Admin crea post + upload OK

## Khipu
- [ ] `POST /payments/create` genera `payment_url` y redirige a Khipu
- [ ] Webhook `/webhooks/khipu` valida firma
- [ ] Webhook idempotente (mismo evento no duplica)
- [ ] Server-to-server `GET /payments/{id}` valida `status=done`
- [ ] Activación membresía +30 días en `membershipExpiresAt`

## Producción
- [ ] `COOKIE_DOMAIN=.uzeed.cl`
- [ ] `WEB_ORIGIN=https://uzeed.cl`
- [ ] `API_BASE_URL=https://api.uzeed.cl`
- [ ] SSL OK en ambos dominios
- [ ] Postgres 17 OK
