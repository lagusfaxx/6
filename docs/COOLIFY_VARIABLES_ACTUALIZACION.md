# ¿Debo agregar Environment Variables en Coolify?

## Respuesta Rápida: **SÍ** ✅

Después de implementar el sistema de suscripciones con Khipu, **DEBES actualizar/agregar las siguientes variables en Coolify:**

## 🆕 Variables NUEVAS que DEBES agregar:

```bash
# Sistema de suscripciones (NUEVO)
FREE_TRIAL_DAYS=7                    # ← NUEVA: Periodo de prueba gratis
```

## 🔄 Variables que DEBES CAMBIAR:

```bash
# Antes:
SHOP_MONTHLY_PRICE_CLP=10000

# Ahora:
SHOP_MONTHLY_PRICE_CLP=4990          # ← CAMBIADO: Precio unificado de 4990 CLP
```

## ✅ Variables que ya deberías tener (verifica que estén):

```bash
# Khipu - Sistema de Pagos
KHIPU_API_KEY=5c24de64-13fd-4f64-bdd4-acabe2c46bbb
KHIPU_BASE_URL=https://payment-api.khipu.com
KHIPU_SUBSCRIPTION_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/subscription
KHIPU_CHARGE_NOTIFY_URL=https://api.uzeed.cl/webhooks/khipu/charge
KHIPU_RETURN_URL=https://uzeed.cl/dashboard
KHIPU_CANCEL_URL=https://uzeed.cl/dashboard
KHIPU_WEBHOOK_SECRET=

# Precios
MEMBERSHIP_PRICE_CLP=4990            # ← VERIFICAR: Debe ser 4990
MEMBERSHIP_DAYS=30
```

## 📋 Checklist de Acción en Coolify:

1. **Abre tu aplicación API en Coolify**
   - Ve a Resources → Tu API

2. **Accede a Environment Variables**
   - Busca la sección de variables de entorno

3. **Agrega la nueva variable:**
   ```
   FREE_TRIAL_DAYS=7
   ```

4. **Actualiza estas variables si son diferentes:**
   ```
   MEMBERSHIP_PRICE_CLP=4990
   SHOP_MONTHLY_PRICE_CLP=4990
   ```

5. **Verifica que tengas todas las variables de Khipu:**
   - KHIPU_API_KEY
   - KHIPU_SUBSCRIPTION_NOTIFY_URL
   - KHIPU_CHARGE_NOTIFY_URL
   - KHIPU_RETURN_URL
   - KHIPU_CANCEL_URL

6. **Guarda los cambios**

7. **Redeploy la aplicación** para que tome las nuevas variables

8. **IMPORTANTE: Ejecuta las migraciones de base de datos**
   
   Conecta al contenedor de la API y ejecuta:
   ```bash
   cd /app && npx prisma migrate deploy --schema=prisma/schema.prisma
   ```
   
   O desde tu máquina local:
   ```bash
   pnpm --filter @uzeed/prisma migrate:deploy
   ```

## ¿Qué pasa si NO agregas estas variables?

❌ **Sin FREE_TRIAL_DAYS:**
- El sistema usará el valor por defecto de 7 días
- Pero es mejor tenerlo explícito en Coolify

❌ **Sin actualizar SHOP_MONTHLY_PRICE_CLP a 4990:**
- Los perfiles SHOP pagarán 10000 CLP en lugar de 4990 CLP
- Precio inconsistente con PROFESSIONAL y ESTABLISHMENT

❌ **Sin ejecutar las migraciones:**
- Los nuevos campos de suscripción no estarán en la base de datos
- El sistema de pagos automáticos fallará

## ¿Cómo verifico que funcionó?

Después de actualizar las variables y redeploy:

1. **Verifica el health check:**
   ```
   GET https://api.uzeed.cl/health
   ```
   Debe retornar: `{ ok: true }`

2. **Verifica las suscripciones:**
   ```
   GET https://api.uzeed.cl/billing/subscription/status
   ```
   (requiere autenticación)

3. **Prueba el registro de un perfil PROFESSIONAL/SHOP:**
   - Debe obtener 7 días de prueba gratis
   - En `/auth/me` debe aparecer `requiresPayment: true`

## 🎯 Resumen de Cambios

El nuevo sistema de suscripciones implementa:

✅ **7 días de prueba gratis** (antes eran 30)
✅ **Precio unificado de 4990 CLP** para todos los perfiles de negocio
✅ **Bloqueo automático** cuando expira el periodo de prueba
✅ **Webhooks de Khipu** para procesar pagos automáticamente

## 📚 Documentación Completa

Para ver la lista completa de todas las variables de entorno, revisa:
- `docs/ENVIRONMENT_VARIABLES.md` - Lista completa con explicaciones
- `docs/COOLIFY.md` - Guía de despliegue completa en Coolify
- `.env.example` - Plantilla con todas las variables

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs del contenedor API en Coolify
2. Verifica que todas las URLs de webhook sean accesibles por HTTPS
3. Confirma que la base de datos esté conectada
4. Asegúrate de haber ejecutado las migraciones
