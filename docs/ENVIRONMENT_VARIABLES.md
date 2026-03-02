# Variables de Entorno para Coolify - UZEED

Esta es la lista completa de variables de entorno que necesitas configurar en Coolify para la API de UZEED.

## 📋 Variables REQUERIDAS

### Core - Base del Sistema
```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/uzeed?schema=public
SESSION_SECRET=<genera-un-string-largo-aleatorio-seguro>
SESSION_COOKIE_NAME=uzeed_session
COOKIE_DOMAIN=.uzeed.cl
```

### URLs y CORS
```bash
APP_URL=https://uzeed.cl
API_URL=https://api.uzeed.cl
CORS_ORIGIN=https://uzeed.cl,https://www.uzeed.cl
WEB_ORIGIN=https://uzeed.cl
API_BASE_URL=https://api.uzeed.cl
```

### Storage
```bash
UPLOADS_DIR=uploads
```

### Admin
```bash
ADMIN_EMAIL=admin@uzeed.cl
ADMIN_PASSWORD=<CAMBIA-ESTO-POR-UNA-CLAVE-SEGURA>
```

## 💳 Khipu - Sistema de Pagos (REQUERIDO)

```bash
# API Key de Khipu (Receiver ID: 511091)
KHIPU_API_KEY=5c24de64-13fd-4f64-bdd4-acabe2c46bbb

# Base URL de la API de Khipu
KHIPU_BASE_URL=https://payment-api.khipu.com

# URLs de Webhooks (deben ser accesibles públicamente vía HTTPS)
KHIPU_SUBSCRIPTION_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/subscription
KHIPU_CHARGE_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/charge

# URLs de retorno después del pago
KHIPU_RETURN_URL=https://uzeed.cl/dashboard
KHIPU_CANCEL_URL=https://uzeed.cl/dashboard

# Secret para webhooks (opcional, déjalo vacío si Khipu no lo provee)
KHIPU_WEBHOOK_SECRET=
```

## 📆 Suscripciones - Sistema Nuevo (REQUERIDO)

```bash
# Precio mensual para todos los perfiles de negocio (PROFESSIONAL, ESTABLISHMENT, SHOP)
MEMBERSHIP_PRICE_CLP=4990
SHOP_MONTHLY_PRICE_CLP=4990

# Periodo de prueba gratis (días)
FREE_TRIAL_DAYS=7

# Duración de cada periodo de pago (días)
MEMBERSHIP_DAYS=30
```

### ⚠️ Importante sobre las suscripciones:
- Todos los perfiles de negocio pagan **4990 CLP/mes**
- Obtienen **7 días de prueba gratis** al registrarse
- Después del periodo de prueba, deben pagar para seguir usando la app
- Los perfiles CLIENT, VIEWER y CREATOR NO pagan

## 📧 SMTP - Email (OPCIONAL)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
SMTP_FROM=no-reply@uzeed.cl
```

## 🔔 Web Push Notifications (OPCIONAL)

Genera las claves VAPID con:
```bash
npx web-push generate-vapid-keys
```

Luego configura:
```bash
VAPID_SUBJECT=mailto:soporte@uzeed.cl
VAPID_PUBLIC_KEY=<tu-clave-publica-vapid>
VAPID_PRIVATE_KEY=<tu-clave-privada-vapid>
```

## 🚀 Despliegue en Coolify

### Paso 1: Crear la aplicación API
1. En Coolify → **Resources** → **New** → **Application**
2. Conecta tu repositorio de GitHub
3. Configura:
   - Build Pack: **Dockerfile**
   - Base Directory: `/`
   - Dockerfile Path: `apps/api/Dockerfile`
   - Port: `3001`
   - Domain: `https://api.uzeed.cl`

### Paso 2: Agregar las variables de entorno
1. En la aplicación creada → **Environment Variables**
2. Copia y pega las variables de arriba
3. **IMPORTANTE:** Reemplaza los valores de ejemplo por los reales:
   - `DATABASE_URL` → obtén de tu servicio PostgreSQL en Coolify
   - `SESSION_SECRET` → genera uno aleatorio largo y seguro
   - `ADMIN_PASSWORD` → cambia la contraseña por defecto
   - URLs → ajusta según tu dominio

### Paso 3: Ejecutar migraciones
Después del primer deploy, conecta al contenedor y ejecuta:
```bash
cd /app && npx prisma migrate deploy --schema=prisma/schema.prisma
```

O desde tu máquina local:
```bash
pnpm --filter @uzeed/prisma migrate:deploy
```

## ✅ Verificación

Después del deploy, verifica:
1. **Health check:** `GET https://api.uzeed.cl/health` → debe retornar `{ ok: true }`
2. **Autenticación:** Inicia sesión con las credenciales de admin
3. **Estado de suscripción:** `GET https://api.uzeed.cl/billing/subscription/status` (requiere auth)
4. **Webhooks:** Verifica que Khipu pueda alcanzar tus URLs de webhook

## 🔒 Seguridad

- ✅ Usa HTTPS en todos los dominios
- ✅ Configura Cloudflare en modo "Full (Strict)"
- ✅ Cambia `ADMIN_PASSWORD` de la contraseña por defecto
- ✅ Genera un `SESSION_SECRET` aleatorio y seguro
- ✅ No compartas tus credenciales de Khipu
- ✅ Verifica que los webhooks solo acepten llamadas de Khipu

## 📝 Notas Adicionales

### Sobre KHIPU_API_KEY
El API Key `5c24de64-13fd-4f64-bdd4-acabe2c46bbb` corresponde al Receiver ID `511091`. Este es el cobrador configurado en Khipu para recibir los pagos.

### Sobre el precio unificado
Anteriormente SHOP tenía un precio diferente (10000 CLP). Ahora todos los perfiles de negocio pagan lo mismo: **4990 CLP/mes**.

### Sobre el periodo de prueba
El periodo de prueba se redujo de 30 días a **7 días** para todos los perfiles de negocio (PROFESSIONAL, ESTABLISHMENT, SHOP). Esto está configurado en `FREE_TRIAL_DAYS=7`.

### Base de datos
Asegúrate de tener PostgreSQL 17 configurado en Coolify con el nombre de base de datos `uzeed`.

## 🆘 Solución de Problemas

### Error: "SUBSCRIPTION_EXPIRED"
- El usuario agotó su periodo de prueba o suscripción
- Debe realizar un pago para continuar
- El sistema bloqueará el acceso a rutas protegidas

### Error: "Failed to fetch" desde el frontend
- Verifica que el certificado SSL de `api.uzeed.cl` sea válido
- Revisa CORS_ORIGIN incluya tu dominio web
- Confirma que API_URL esté correctamente configurado en el frontend

### Webhooks de Khipu no funcionan
- Verifica que las URLs sean accesibles públicamente vía HTTPS
- Revisa los logs del contenedor API para ver las llamadas
- Confirma que Khipu tenga las URLs correctas configuradas
