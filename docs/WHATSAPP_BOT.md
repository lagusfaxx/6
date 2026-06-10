# Bot de avisos por WhatsApp

Las profesionales usan UZEED como PWA y muchas no tienen notificaciones push
activas, por lo que no se enteran cuando un cliente les escribe. Este bot les
envía un WhatsApp automático cuando hay actividad importante en la app.

Soporta **dos proveedores** (se elige por variables de entorno):

| Proveedor | Costo | Riesgo | Cómo se activa |
|---|---|---|---|
| **Baileys** (recomendado para empezar) | Gratis | No oficial: Meta puede banear el número → usar chip dedicado | `WHATSAPP_PROVIDER=baileys` + escanear QR |
| **Cloud API de Meta** (oficial) | ~$5–20 CLP por aviso | Ninguno | `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` |

## Qué avisa y cuándo

| Evento | Cuándo envía | Anti-spam |
|---|---|---|
| Mensaje nuevo de un cliente | Solo si la profesional NO está activa en la app en ese momento | Máx. 1 aviso cada 30 min (configurable) |
| Nueva solicitud de encuentro | Siempre | Máx. 1 cada 5 min |
| Videollamada agendada | Siempre | Sin límite |
| Actualización de reserva | Siempre | Máx. 1 cada 5 min |
| Solicitud de servicio | Siempre | Máx. 1 cada 5 min |

Solo se avisa a cuentas tipo `PROFESSIONAL`, `ESTABLISHMENT` o `SHOP` con
teléfono registrado y cuenta activa. Los clientes nunca reciben estos avisos.
Los teléfonos se normalizan automáticamente a formato chileno
(`9 1234 5678` → `56912345678`).

El envío se engancha al sistema de notificaciones existente
(`Notification.create`), así que cualquier notificación de esos tipos genera
el aviso sin tocar ningún flujo.

---

## Opción A — Baileys (gratis)

Usa un número de WhatsApp **normal** conectado por el protocolo de WhatsApp
Web. El mensaje llega como texto normal desde ese número.

**Importante**: es una integración no oficial. Meta puede banear el número si
detecta automatización. Con este volumen (avisos a tus propias profesionales,
que tienen el número agendado y le responden) el riesgo es bajo, pero usa
SIEMPRE un **chip dedicado barato**, nunca un número personal. Si lo banean:
chip nuevo, `logout`, escanear QR de nuevo.

### Pasos

1. Consigue un chip prepago y actívale WhatsApp en cualquier teléfono.
2. Configura en el API:

   ```env
   WHATSAPP_PROVIDER=baileys
   # Opcional: dónde guardar la sesión (ponlo en un volumen persistente)
   WHATSAPP_SESSION_DIR=/data/wa-session
   ```

3. Despliega/reinicia el API. En los logs verás
   `[whatsapp:baileys] QR listo`.
4. Con tu sesión de **admin** abre en el navegador:

   ```
   https://api.uzeed.cl/notifications/whatsapp/qr
   ```

   y escanéalo desde el teléfono del chip: WhatsApp → Ajustes →
   **Dispositivos vinculados** → Vincular dispositivo.
5. Listo. El estado queda `connected` (verificable en
   `/notifications/whatsapp/status`) y la sesión sobrevive reinicios si
   `WHATSAPP_SESSION_DIR` está en un volumen persistente.

### ⚠️ Importante: volumen persistente (o re-escanearás el QR en cada deploy)

Por defecto la sesión queda en `/app/.wa-session`, **dentro del contenedor**:
cada deploy o reinicio crea un contenedor nuevo y la borra, obligando a
escanear el QR otra vez. Para que la sesión sobreviva:

1. En Coolify: tu app del API → **Storages** → *Add* → Volume Mount.
   - Destination path: `/data`
2. Agrega la variable de entorno: `WHATSAPP_SESSION_DIR=/data/wa-session`
3. Redeploy y escanea el QR **una última vez**. Desde ahí la sesión persiste
   entre deploys y reinicios.

### Mantenimiento

- `GET /notifications/whatsapp/status` — estado de conexión (admin).
- `POST /notifications/whatsapp/logout` — desvincula y borra la sesión para
  conectar otro chip (admin).
- Si el server queda `logged_out` (cerraste sesión desde el teléfono), repite
  el paso del QR.
- Recomendación: deja el teléfono del chip encendido y con internet de vez en
  cuando; no es estrictamente necesario (WhatsApp multi-dispositivo), pero
  ayuda a la estabilidad de la sesión.

---

## Opción B — Cloud API oficial de Meta (pagada, cero riesgo)

1. **App en Meta**: https://developers.facebook.com → *Create App* → tipo
   **Business** → agregar producto **WhatsApp**.
2. **Número**: en *WhatsApp → API Setup* agrega un número del negocio (no
   puede estar registrado en la app normal de WhatsApp). Copia el
   **Phone number ID**.
3. **Token permanente**: business.facebook.com → *Settings* → *System Users*
   → crear → asignar la app con permiso `whatsapp_business_messaging` →
   *Generate token*.
4. **Plantilla** (obligatoria para mensajes iniciados por el negocio):
   WhatsApp Manager → *Message templates* → crear:
   - Categoría **Utility** · Nombre `uzeed_notificacion` · Idioma **es**
   - Cuerpo:

     ```
     Hola {{1}} 👋 Tienes novedades en UZEED: {{2}}.
     Entra ahora para responder y no perder al cliente.
     ```

5. **Variables de entorno**:

   ```env
   WHATSAPP_TOKEN=EAAG...
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   # Opcionales (defaults):
   WHATSAPP_TEMPLATE_NAME=uzeed_notificacion
   WHATSAPP_TEMPLATE_LANG=es
   WHATSAPP_GRAPH_VERSION=v21.0
   ```

Tarifas vigentes: https://developers.facebook.com/docs/whatsapp/pricing
(categoría Utility en Chile ≈ USD $0.005–0.02 por mensaje).

---

## Variables comunes

```env
WHATSAPP_MESSAGE_COOLDOWN_MIN=30        # cooldown de avisos de mensajes
WHATSAPP_NOTIFY_URL=https://uzeed.cl/chats   # link incluido en el aviso (Baileys)
```

Si `WHATSAPP_PROVIDER=baileys` está definido, Baileys tiene prioridad aunque
existan credenciales de la Cloud API.

## Probar

Con sesión de admin:

```bash
# Estado (proveedor activo, conexión Baileys, etc.)
curl -b cookies.txt https://api.uzeed.cl/notifications/whatsapp/status

# Enviar prueba a un número (o al phone del admin si no se pasa)
curl -b cookies.txt -X POST https://api.uzeed.cl/notifications/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "+56 9 1234 5678"}'
```

También sirve escribirle a una cuenta profesional de prueba (con la
profesional sin sesión abierta) y verificar que llega el WhatsApp.

## Notas

- El cooldown vive en memoria del proceso: tras un reinicio el peor caso es
  un aviso repetido.
- Si más adelante se quiere botón de "no recibir avisos" por profesional,
  basta agregar un flag en el perfil y chequearlo en `maybeNotifyByWhatsApp`
  (`apps/api/src/notifications/whatsapp.ts`).
