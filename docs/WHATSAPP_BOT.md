# Bot de avisos por WhatsApp

Las profesionales usan UZEED como PWA y muchas no tienen notificaciones push
activas, por lo que no se enteran cuando un cliente les escribe. Este bot les
envía un WhatsApp automático cuando hay actividad importante en la app.

## Qué avisa y cuándo

| Evento | Cuándo envía | Anti-spam |
|---|---|---|
| Mensaje nuevo de un cliente | Solo si la profesional NO está activa en la app en ese momento | Máx. 1 aviso cada 30 min (configurable) |
| Nueva solicitud de encuentro | Siempre | Máx. 1 cada 5 min |
| Videollamada agendada | Siempre | Sin límite |
| Actualización de reserva | Siempre | Máx. 1 cada 5 min |
| Solicitud de servicio | Siempre | Máx. 1 cada 5 min |

Solo se avisa a cuentas tipo `PROFESSIONAL`, `ESTABLISHMENT` o `SHOP` que
tengan teléfono registrado y la cuenta activa. Los clientes nunca reciben
estos avisos.

El envío se engancha automáticamente al sistema de notificaciones existente
(`Notification.create`), así que no hay que tocar ningún flujo: cualquier
notificación de los tipos de la tabla genera el aviso.

## Setup (WhatsApp Business Cloud API de Meta — oficial)

1. **Crear la app en Meta**
   - Entra a https://developers.facebook.com → *My Apps* → *Create App* → tipo **Business**.
   - En el dashboard de la app agrega el producto **WhatsApp**.

2. **Número de teléfono**
   - Meta te da un número de prueba (sirve para testear con hasta 5 números).
   - Para producción: en *WhatsApp → API Setup* agrega un número propio del
     negocio (NO puede estar registrado en la app normal de WhatsApp; usa un
     chip nuevo o da de baja el WhatsApp normal de ese número primero).
   - Copia el **Phone number ID** (no es el número, es un ID numérico).

3. **Token permanente**
   - El token del dashboard expira en 24 h. Para producción crea un
     **System User**: business.facebook.com → *Settings* → *System Users* →
     crear → asignar la app con permiso `whatsapp_business_messaging` →
     *Generate token* (sin expiración).

4. **Crear la plantilla** (los mensajes iniciados por el negocio requieren
   plantilla aprobada por Meta)
   - WhatsApp Manager → *Message templates* → *Create template*.
   - Categoría: **Utility** · Nombre: `uzeed_notificacion` · Idioma: **es**.
   - Cuerpo (las dos variables son obligatorias):

     ```
     Hola {{1}} 👋 Tienes novedades en UZEED: {{2}}.
     Entra ahora para responder y no perder al cliente.
     ```

   - (Opcional) Botón de tipo *Visit website* con URL `https://uzeed.cl/chats`.
   - La aprobación de plantillas Utility suele tardar minutos.

5. **Variables de entorno del API**

   ```env
   WHATSAPP_TOKEN=EAAG...            # token permanente del system user
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   # Opcionales (estos son los defaults):
   WHATSAPP_TEMPLATE_NAME=uzeed_notificacion
   WHATSAPP_TEMPLATE_LANG=es
   WHATSAPP_GRAPH_VERSION=v21.0
   WHATSAPP_MESSAGE_COOLDOWN_MIN=30
   ```

   Sin `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` el bot queda apagado y
   la app funciona igual que siempre.

## Probar

Con sesión de admin:

```bash
# Estado de configuración
curl -b cookies.txt https://api.uzeed.cl/notifications/whatsapp/status

# Enviar prueba a un número (o al phone del admin si no se pasa)
curl -b cookies.txt -X POST https://api.uzeed.cl/notifications/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "+56 9 1234 5678"}'
```

También sirve mandarse un mensaje de chat a una cuenta profesional de prueba
(con la profesional sin sesión abierta) y verificar que llega el WhatsApp.

## Costos

Meta cobra por mensaje de plantilla entregado. Categoría Utility en Chile:
~USD $0.005–0.02 por mensaje (ver tarifas vigentes en
https://developers.facebook.com/docs/whatsapp/pricing). Con los cooldowns
configurados, una profesional activa genera a lo más ~2-3 avisos diarios.

## Notas

- Los teléfonos se normalizan automáticamente a formato chileno
  (`9 1234 5678` → `56912345678`). Números inválidos se ignoran en silencio.
- El cooldown vive en memoria del proceso: tras un reinicio el peor caso es
  un aviso repetido.
- Si más adelante se quiere botón de "no recibir avisos", basta agregar un
  flag en el perfil y chequearlo en `maybeNotifyByWhatsApp`
  (`apps/api/src/notifications/whatsapp.ts`).
