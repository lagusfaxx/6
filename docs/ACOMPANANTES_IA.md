# Acompañantes IA

Personajes virtuales ficticios y adultos con chat, roleplay, memoria e imágenes
personalizadas. Vive en `/acompanantes-ia` (web) y `/ai-companions/*` (API).

## Recorrido del usuario

1. Entra a `/acompanantes-ia` (catálogo público, filtro mujeres/hombres).
2. Abre la ficha `/acompanantes-ia/<slug>`: presentación, edad ficticia,
   personalidades, estilo, roleplay, intereses y galería.
3. "Conversar" lleva a `/acompanantes-ia/chat/<slug>` (pide sesión).
4. La primera vez confirma que es mayor de 18 (fecha de nacimiento si la
   cuenta no la tiene) y acepta las reglas. Menores de 18: no entran.
5. Chatea. En ⚙ elige personalidad, intensidad y cómo quiere que lo llamen,
   y ve, corrige o borra lo que el personaje recuerda y el historial.
6. En 📷 pide una foto del personaje; se cobra en tokens y llega al chat.
7. `/acompanantes-ia/planes`: compra Premium o VIP con tokens de la billetera.

## Planes y cobro

Todo se paga con los tokens de la billetera (`/wallet`), así se reutilizan
Flow y transferencias. Cada cobro queda en `TokenTransaction` con tipo
`AI_COMPANION`.

| | Gratis | Premium | VIP |
|---|---|---|---|
| Mensajes al día | 25 | 300 | 1500 |
| Recuerdos por personaje | 10 | 60 | 200 |
| Contexto que ve el modelo | 12 msj | 30 msj | 50 msj |
| Memoria automática y resumen | — | ✔ | ✔ |
| Personajes | Gratis | + Premium | Todos, incl. exclusivos |

- Precios por defecto: Premium 10 tokens, VIP 25 tokens por 30 días; imagen
  2 tokens (1 en VIP). Se cambian en `/admin/acompanantes-ia` → Precios
  (sólo el administrador). Ajustarlos cuando se mida el costo real.
- Los límites por plan están en `apps/api/src/companions/plans.ts`.
- Personajes `EXCLUSIVE`: se desbloquean uno a uno (tokens y días por
  personaje) o vienen con VIP.
- Una imagen fallida o bloqueada devuelve sus tokens.

## Seguridad

- Edad: la base exige `age >= 18` (CHECK) y la API rechaza personajes de
  menos de 18. El usuario declara su fecha de nacimiento (18+).
- Filtros (`companions/safety.ts`) sobre lo que escribe el usuario, lo que
  responde el modelo, los pedidos de imagen y el prompt final:
  menores (siempre), personas reales (imágenes), violencia sexual / sin
  consentimiento y otros límites duros. Lo bloqueado queda en
  `AiCompanionFlag` y se revisa en el panel → Bloqueos, con el conteo por
  usuario para detectar insistencia.
- El prompt de sistema repite las reglas; las imágenes llevan siempre un
  prompt negativo contra apariencia infantil y personas reales.
- No se pueden subir fotos: las imágenes salen sólo de la descripción fija
  del personaje (más una semilla fija), así no hay forma de usar la cara de
  una persona real.
- Las imágenes generadas se guardan en el almacenamiento privado y sólo las
  ve su dueño (`/ai-companions/images/:id/file`).
- Contenido explícito: apagado salvo `AI_CHAT_ALLOW_EXPLICIT` /
  `AI_IMAGE_ALLOW_EXPLICIT`. Activarlo sólo con proveedores cuyos términos
  lo permitan expresamente. Sin eso, la intensidad máxima es "Picante".

## Proveedores

Ver variables `AI_CHAT_*` y `AI_IMAGE_*` en
[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). Se usa el formato
compatible con OpenAI. Las imágenes envían `prompt`, `negative_prompt`,
`seed`, `size` y `response_format: "b64_json"`, más lo que se ponga en
`AI_IMAGE_EXTRA_JSON`.

## Datos

Tablas `AiCompanion`, `AiCompanionAccount`, `AiCompanionChat`,
`AiCompanionMessage`, `AiCompanionMemory`, `AiCompanionImage`,
`AiCompanionUnlock`, `AiCompanionFlag` (migración
`20261125120000_ai_companions`). Todo se borra en cascada con la cuenta del
usuario. El catálogo inicial (8 personajes) se crea solo si la tabla está
vacía.
