# Verificación de identidad automatizada (Didit / KYC)

Reemplaza la verificación manual por llamada telefónica con un flujo
automático: el profesional escanea su cédula y hace una selfie con prueba de
vida (liveness). Un proveedor externo (Didit) valida el documento, compara la
cara, extrae la fecha de nacimiento (bloquea menores) y valida contra
registros oficiales. Si aprueba, el perfil obtiene el sello **Verificada**
automáticamente.

**El documento y la biometría los procesa y guarda Didit, no UZEED.** Nosotros
solo guardamos el resultado y datos mínimos (mayoría de edad, tipo de doc).

Queda **apagado** hasta configurar las variables de entorno; mientras tanto la
verificación manual del admin sigue funcionando igual.

## Por qué Didit

- Tier gratis real: **500 verificaciones/mes para siempre** (suficiente para
  empezar; ver didit.me/pricing).
- Liveness real (anti-foto/anti-deepfake) que no conviene construir uno mismo.
- Soporta documentos chilenos y extrae fecha de nacimiento → control de edad.
- Webhooks firmados con HMAC.

## Setup

1. **Cuenta y workflow**
   - Crea cuenta en https://business.didit.me
   - Crea un *Workflow* de verificación que incluya **ID Verification +
     Liveness + Face Match** (y, si está disponible para Chile, *Database/AML*).
   - Copia el **Workflow ID**.

2. **API key y webhook secret**
   - En la consola: *Settings → API Keys* → copia la **API Key**.
   - Configura el **Webhook**: URL `https://api.uzeed.cl/verification/identity/webhook`
     y copia el **Webhook Secret** (HMAC).
   - (Opcional) En el workflow, configura la *Return URL* a
     `https://uzeed.cl/cuenta/verificacion` para que el usuario vuelva a la app
     al terminar.

3. **Variables de entorno del API**

   ```env
   DIDIT_API_KEY=tu_api_key
   DIDIT_WORKFLOW_ID=tu_workflow_id
   DIDIT_WEBHOOK_SECRET=tu_webhook_secret
   # Opcional (default mostrado):
   DIDIT_BASE_URL=https://verification.didit.me
   ```

   Sin `DIDIT_API_KEY` + `DIDIT_WORKFLOW_ID` el flujo automático queda
   deshabilitado y el botón muestra "aún no habilitada".

4. **Migración de base de datos**: se aplica sola en el deploy
   (`prisma migrate deploy`). Crea la tabla `IdentityVerification`.

## Flujo

1. El profesional entra a **Cuenta → Verificar identidad**
   (`/cuenta/verificacion`).
2. Toca "Verificar mi identidad ahora" → el API crea una sesión en Didit
   (`POST /v3/session/`) y lo redirige a la URL de Didit.
3. Escanea cédula + selfie con liveness en Didit.
4. Didit nos avisa por webhook (`POST /verification/identity/webhook`, firmado
   HMAC). El API:
   - valida la firma,
   - si **Approved** consulta la decisión completa y verifica `age >= 18`,
   - marca al usuario `isVerified = true` y le agrega el tag `verificada`,
   - si el documento indica **menor de edad**, lo rechaza aunque Didit aprobara.
5. La página del profesional refleja el estado (hace polling mientras está en
   curso) y muestra el sello al aprobarse.

## Endpoints

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| POST | `/verification/identity/start` | profesional (sesión) | crea sesión y devuelve la URL de Didit |
| GET | `/verification/identity/status` | usuario (sesión) | estado actual de su verificación |
| POST | `/verification/identity/webhook` | Didit (HMAC) | recibe el resultado |

## Seguridad y privacidad

- El webhook se valida con HMAC-SHA256 sobre el cuerpo crudo
  (`req.rawBody`) y rechaza timestamps viejos (>5 min) para frenar reenvíos.
- No almacenamos imágenes de documentos ni biometría: solo el resultado, la
  mayoría de edad y el tipo de documento, en la tabla `IdentityVerification`.
- La mayoría de edad es un requisito duro: un documento de menor se rechaza
  automáticamente.

## Notas

- La verificación manual del admin (`/admin/verification`) sigue disponible
  como respaldo o para casos especiales.
- Para cobrar el sello o exigir verificación antes de publicar, basta chequear
  `user.isVerified` donde corresponda (no incluido aquí).
