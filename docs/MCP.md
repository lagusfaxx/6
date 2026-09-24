# Servidor MCP de UZEED (Claude)

La API expone un servidor [MCP](https://modelcontextprotocol.io) en `/mcp`. Con
él, Claude (claude.ai, la app de escritorio o Claude Code) se conecta directo a
la base de UZEED para sacar estadísticas, armar informes y hacer algunas
acciones del panel admin, pidiéndolo en lenguaje natural.

Código: `apps/api/src/mcp/`.

## 1. Activarlo

1. **Activa el 2FA** en tu cuenta de administrador (panel → Doble factor). Sin
   2FA nadie puede conectar Claude.
2. En Coolify, app **API**, agrega:

   ```
   MCP_ENABLED=true
   MCP_SQL_PASSWORD=<clave aleatoria de 16+ caracteres>
   ```

   Genera la clave con `openssl rand -hex 32` (sólo letras, números, `.`, `-`, `_`).
3. Redeploy. No hay que entrar a la terminal: al arrancar, la API crea sola el
   usuario de base de datos `uzeed_mcp_sql` con esa clave (Postgres recibe el
   hash, no la clave), lo deja sólo en el rol lector `uzeed_mcp_reader`, en
   sólo lectura y con 20 s por consulta, y prueba la conexión. Usa el mismo
   host y base de `DATABASE_URL`. Para cambiar la clave, cambia la variable y
   redeploy.

   Si falta `MCP_SQL_PASSWORD`, es débil o el usuario de la base no puede
   crear roles, el log lo dice y sólo `consulta_sql` queda apagada; el resto
   del MCP funciona.

Con `MCP_ENABLED` distinto de `true`, `/mcp` y todo el OAuth responden 404.

## 2. Conectarlo

**claude.ai / Claude Desktop** → Configuración → Conectores → *Agregar conector
personalizado* → URL `https://api.uzeed.cl/mcp` (sin nada más).

**Claude Code**:

```bash
claude mcp add --transport http uzeed https://api.uzeed.cl/mcp
```

Claude abre una pestaña de autorización en `api.uzeed.cl`. Tienes que tener la
sesión de admin abierta en uzeed.cl en ese navegador; la pantalla muestra qué
aplicación pide acceso y a dónde vuelve, y se aprueba con el **código 2FA del
momento**. No se entrega la contraseña.

- El acceso dura 1 hora y Claude lo renueva solo; como máximo **30 días**,
  después hay que volver a aprobar con 2FA.
- Cada autorización nueva manda un aviso a todos los administradores.
- **Revocar**: panel → **Claude** (`/admin/claude`) muestra quién tiene acceso,
  desde qué IP y cuándo lo usó por última vez; se corta uno o todos (todos pide 2FA).
- Si al administrador le quitan el rol o apaga el 2FA, sus accesos mueren al instante.

## 3. Qué se le puede pedir

Ejemplos:

- "Dame el informe semanal" (o usa el prompt **informe_semanal**).
- "Informe mensual de agosto" (prompt **informe_mensual**, argumento `2026-08`).
- "¿Qué está pendiente hoy y en qué orden lo atiendo?" (prompt **revision_operativa**).
- "¿Cuánto facturamos este mes vs. el anterior, por tipo de plan?"
- "Top 20 profesionales de Santiago por contactos de WhatsApp en los últimos 30 días."
- "¿Qué perfiles convierten mejor visitas en contactos?" (ranking `tasa_contacto`).
- "¿Qué perfiles tienen la membresía por vencer esta semana?"
- "Cohorte de registros de junio: ¿cuántas siguen activas y cuántas pagaron?"
  (usa `consulta_sql`).
- "Oculta el perfil de @usuaria, está duplicado." (pide confirmación antes).

### Herramientas de lectura

**Filtros comunes** (casi todas los aceptan): `region`, `ciudad`, `comuna`
(normalizadas a la geografía de Chile; las comunas del Gran Santiago cuentan
como ciudad Santiago), `categoria`, `tipoPerfil`, `tier` (PREMIUM/GOLD/SILVER/
NINGUNO), `verificado`, `estadoPerfil` (publicado/oculto/pendiente/rechazado),
`dispositivo` (movil/desktop/tablet), `modo` (pwa/web), `fuente` (organico/
directo/redes/referidos/ads/campana), `tipoUsuario` (nuevo/recurrente),
`sesion` (registrado/anonimo) y `segmento` (un segmento guardado). Bots,
equipo, `/admin` y perfiles de prueba se excluyen siempre.

**Periodos**: `hoy`, `ayer`, `7d`, `30d`, `mes`, `mes_anterior`,
`semana_actual`, `90d`, `365d`, `anio_actual` o `desde`/`hasta`
(personalizado). Agrupación `hora`, `dia`, `semana` o `mes` en las series.

| Herramienta | Para qué |
| --- | --- |
| `resumen_general` | Foto actual del negocio (la misma del dashboard admin). |
| `kpis_periodo` | KPIs de un rango con comparación contra el periodo anterior. |
| `tarjetas_kpi` | Cada KPI con valor, delta vs periodo anterior y mini-sparkline de 14 días. |
| `comparar` | Periodos (anterior y mismo periodo del año anterior), entidades lado a lado (ciudades, categorías, tiers, perfiles), perfil vs promedio de su ciudad y tier, antes/después de una anotación. |
| `serie_temporal` | 22 métricas por hora/día/semana/mes sin huecos, con filtros y serie del año anterior. |
| `analitica_trafico` | Volumen (visitas, únicos, sesiones, páginas/sesión, duración, rebote), fuentes y campañas UTM, landing y salida, heatmap día × hora, búsquedas internas, dispositivos/PWA/navegadores, nuevos vs recurrentes, ubicación normalizada, acciones. |
| `inventario_anuncios` | Publicados, pendientes, ocultos, rechazados; nuevos, editados y vencidos en el periodo. |
| `exposicion_anuncios` | Impresiones, posición media, vistas, CTR listado→perfil, contactos por canal, tasa contacto/visitante, favoritos; ranking ordenable, embudo y dispersión. |
| `calidad_anuncios` | Completitud, fotos, antigüedad y última actualización, con distribución. |
| `alertas_anuncios` | Con vistas sin contactos, sin vistas, sin actualizar hace más de N días. |
| `contactos_detalle` | Por perfil, ciudad, categoría, hora y fuente; únicos vs repetidos; tiempo al primer contacto; respuesta a mensajes internos y efecto de la respuesta automática. |
| `profesionales` | Altas por día y origen (formulario, Google, Publícate Gold, admin, referidos), tiempo registro→publicado y colas, actividad (login, edición, historias), tiers (distribución, altas, bajas, vencen en 7 días). |
| `ver_usuario` | Ficha 360: datos, actividad, tendencia 30 días, exposición, historial de tier, cambios de nombre/teléfono, reportes, pagos. |
| `clientes` | Registrados vs anónimos, recurrencia y frecuencia; fichas por sesión y contactos por cliente; favoritos; cohortes semanales de retención (semana 1, 2, 4 y 8). |
| `oferta_demanda` | Por zona y categoría: anuncios vs búsquedas, vistas y contactos, con semáforo oportunidad/saturada. |
| `monetizacion` | Ingresos por tier, MRR, renovaciones, churn y conversión gratis→pago. |
| `verticales` | ON/OFF de marketplace, U-Mate, videollamadas, tokens y live; métricas sólo de las que están ON. |
| `buscar_usuarios`, `ranking_perfiles`, `membresias`, `informe_ingresos`, `listar_pagos`, `pendientes`, `resumen_marketplace`, `resumen_umate` | Igual que antes. |
| `detalle_registros` | Drill-down: las filas detrás de cualquier número (visitas, sesiones, contactos, registros, perfiles, pagos, búsquedas, mensajes, favoritos, impresiones). |
| `exportar_csv` | Lo mismo en CSV. |
| `ubicacion_clientes` | De dónde son los clientes por región/ciudad/comuna: visitantes, los que vieron fichas y los que contactaron; flujo zona del cliente → zona del perfil contactado (% local, principales orígenes de cada ciudad); búsquedas en otra zona; cuentas cliente por ciudad declarada; visitas desde el extranjero por país. |
| `describir_esquema`, `consulta_sql` | Esquema (con los valores de cada enum y las vistas `mcp_*`) y SELECT libre de sólo lectura. Si la consulta falla, el error explica qué corregir (valor de enum inválido con los válidos, columna inexistente, dato sensible, tiempo agotado). `pesada=true` da 60 s en vez de 20 s, máximo 5 por hora. |
| `ver_bitacora` | Qué se hizo por el MCP. |

#### Vistas para `consulta_sql`

Responden preguntas sobre columnas que el lector no puede leer, sin entregar el dato:

| Vista | Qué trae |
| --- | --- |
| `mcp_cuenta_datos` | Por cuenta: si tiene email, teléfono, ubicación exacta, dirección, tarjeta guardada, 2FA, verificación por teléfono; dominio del correo sólo si es masivo (gmail, hotmail...), si no `otro`. |
| `mcp_zona_perfiles` | Perfiles por celda de ~1 km y tipo; sólo celdas con 3 o más perfiles. |
| `mcp_mensajes_diarios` | Mensajes por día (hora de Chile) y par remitente → destinatario, leídos y largo promedio, sin el texto. |

La API las concede al rol lector al arrancar (`mcp_reader_refresh_grants`).

### Herramientas del panel (guardan configuración)

| Herramienta | Para qué |
| --- | --- |
| `segmentos` | Guardar filtros con nombre ("GOLD Santiago sin contactos 7d") y usarlos con `segmento`. |
| `anotaciones` | Marcar campañas, deploys, caídas y cambios de UI en el timeline; sirven para `comparar` antes/después. |
| `alertas` | Alertas que el servidor evalúa cada hora (ej. "contactos −30% vs semana anterior", "perfil top sin actualizar"); avisan por notificación y correo con 24 h de enfriamiento. |
| `informe_semanal_email` | Informe automático los lunes 09:00 (Chile) por correo; activar, destinatarios, enviar ahora. |

Cada respuesta trae un campo `grafico` que dice cómo conviene dibujarla
(línea, dona, heatmap, barras, embudo, dispersión, mapa/semáforo, tarjetas
con sparkline): Claude lo dibuja con esos datos si se lo pides.

### Qué se captura desde este cambio

- **UTM** (`utm_source`, `utm_medium`, `utm_campaign`) de la URL de llegada.
- **Dispositivo** (móvil/desktop/tablet, del user agent) y **PWA** (app instalada).
- **Impresiones en listados** por perfil y día, con la posición (para CTR y posición media).
- **Búsquedas internas** con término o filtros explícitos y cuántos resultados dieron.
- **Origen del registro** (formulario, Google, Publícate Gold, admin) y **última edición de la ficha**.
- **Historial de tier** (cada cambio queda registrado).

Los periodos anteriores al deploy no tienen estos datos: las herramientas lo
indican con `null` o con una nota.

### Cómo se cuenta (precisión)

Todas las herramientas usan los mismos criterios (`apps/api/src/lib/statsFilters.ts`)
y cada respuesta los repite en `criterios`:

- **Días en hora de Chile**, incluidos los cambios de horario. Antes "hoy" en
  el panel partía a las 21:00/20:00 del día anterior (hora UTC del servidor).
- **Tráfico real**: sin bots ni herramientas (por user agent), sin el equipo
  (ADMIN/MODERATOR) y sin páginas `/admin`. Cada resumen dice cuánto se excluyó.
- **Visitantes únicos** por navegador (`visitorId` en localStorage). Antes el
  único id era por pestaña. Las visitas anteriores a este cambio no lo tienen:
  `pctVisitasSinVisitorId` dice qué parte del periodo se aproxima por pestaña.
- **Fuentes de tráfico** por sesión (referente de la primera página), no por
  página: `document.referrer` se repite en toda la navegación interna.
- **Contactos por WhatsApp/teléfono únicos**: una vez por persona, perfil y
  día (doble click o botón de arriba + el fijo cuentan 1). También se dan los
  clicks brutos.
- **Visitas a fichas** por `/profesional/<id>` (antes se buscaba por username y
  daban casi 0).
- **Usuarios** sin perfiles de prueba (`@testseed.uzeed.cl`) ni cuentas del
  equipo; "registros orgánicos" excluye además los perfiles cargados por admin.
- **Ingresos** sin doble conteo: los depósitos de tokens por Flow ya son un
  pago `TOKEN_PURCHASE`; sólo se suman aparte los de transferencia. Marketplace
  neto de pedidos reembolsados, cancelados o rechazados.
- **Comparaciones justas**: si el periodo está en curso se compara hasta la
  misma hora del periodo anterior; los meses contra el mes anterior desde el
  día 1. `baseChica` avisa cuando el % se calcula sobre menos de 20 casos.

Los periodos aceptan `periodo` (`hoy`, `ayer`, `7d`, `30d`, `90d`, `365d`,
`semana_actual`, `mes_actual`, `mes_anterior`, `anio_actual`) o `desde`/`hasta`
en `YYYY-MM-DD`. Todo se calcula en hora de Chile.

### Acciones (sólo administrador)

`cambiar_estado_perfil`, `aprobar_verificacion`, `rechazar_verificacion`,
`cambiar_tier`. Hacen lo mismo que el botón equivalente del panel y quedan en la
bitácora (`McpAuditLog`).

Trabajo del equipo (también sólo administrador y en la bitácora):

| Herramienta | Para qué |
| --- | --- |
| `bandeja_admin` | Avisos del panel (eliminación de datos, contacto, contenido reportado, depósitos, retiros, verificaciones, alertas): listar pendientes y marcarlos atendidos para todo el equipo. Los correos de quien escribió salen enmascarados. Marcar atendido no aprueba ni rechaza nada. |
| `notas_internas` | Notas del equipo sobre un usuario (el usuario no las ve). Salen también en `ver_usuario`. No se borran desde Claude. |
| `enviar_aviso` | Notificación en la app (con push) y/o correo a un usuario o a un grupo por filtros de perfil o segmento. Siempre devuelve primero una vista previa con un código; sólo envía si se repite con ese código. Máximo 1.000 destinatarios por envío, 300 correos por envío y 2.000 avisos por día. El correo sólo va a quien acepta avisos por correo y lleva enlace de baja. El enlace sólo puede ser una ruta de uzeed.cl. |

A propósito **no hay** herramientas que muevan dinero
(depósitos, retiros, reembolsos, saldos) ni que borren: eso sigue en el panel,
con su 2FA.

### Google Search Console (opcional)

Claude consulta el SEO de uzeed.cl directo en Google, con una cuenta de
servicio de sólo lectura:

| Herramienta | Para qué |
| --- | --- |
| `search_console` | Clics, impresiones, CTR y posición media, totales o por consulta, página, país, dispositivo, fecha o apariencia, contra el periodo anterior. Filtros: consulta, página, ficha de un perfil (`usuario`), país, dispositivo y `sinMarca` (sin búsquedas de "uzeed"). |
| `search_console_oportunidades` | Consultas en posición 4-20 con muchas impresiones, consultas en top 10 con CTR bajo lo esperado, páginas que más clics perdieron, canibalización (varias páginas por la misma consulta) y **demanda por zona**: búsquedas en Google que nombran una comuna contra perfiles publicados en esa ciudad. |
| `search_console_indexacion` | Sitemaps (errores, advertencias, última lectura) e inspección de hasta 10 URLs o de la ficha de un perfil: indexada o no, último rastreo, canónica elegida por Google, móvil y datos estructurados. |

Activarlo:

1. Google Cloud Console → crea (o elige) un proyecto → **APIs y servicios** →
   habilita **Google Search Console API**.
2. **IAM → Cuentas de servicio** → crea una (sin roles) → **Claves** →
   *Agregar clave* → JSON. Se descarga un archivo.
3. Search Console → propiedad de uzeed.cl → **Configuración → Usuarios y
   permisos** → *Agregar usuario* con el `client_email` de la cuenta de
   servicio, permiso **Restringido** (basta para leer).
4. En Coolify, app **API**:

   ```
   GSC_SERVICE_ACCOUNT_JSON=<contenido del JSON, o el JSON en base64>
   GSC_SITE_URL=sc-domain:uzeed.cl   # o https://uzeed.cl/ si la propiedad es por prefijo
   ```

   Para base64: `base64 -w0 clave.json`. Redeploy.

Sin `GSC_SERVICE_ACCOUNT_JSON` las tres herramientas no aparecen. La API pide
el token con el scope `webmasters.readonly`: aunque la clave se filtrara no
sirve para cambiar nada en Search Console. Si la cuenta no tiene acceso a la
propiedad, la herramienta lo dice con el correo que hay que agregar.

Google entrega los datos con 2-3 días de atraso y los días en hora del
Pacífico; la inspección de URLs tiene un tope de 2.000 al día por propiedad.

## 4. Seguridad

Pensado para una app masiva y con gente intentando entrar. Capas, de afuera
hacia adentro:

| Capa | Qué hace |
| ---- | -------- |
| Interruptor | Todo apagado salvo `MCP_ENABLED=true`. |
| IPs (opcional) | `MCP_ALLOWED_IPS` limita quién puede llamar a `/mcp`. |
| OAuth 2.1 + PKCE | Sin tokens fijos ni tokens en la URL. Sólo `Authorization: Bearer`. |
| Aprobación humana | Sesión de admin + código 2FA vigente (no reutilizable) en cada autorización. |
| Redirecciones | Sólo `claude.ai`, `claude.com` y `localhost` (Claude Code). Un tercero no puede recibir códigos. |
| Tokens | Guardados como hash. Acceso de 1 h, refresh rotativo; reusar un refresh o un código viejo revoca toda la familia (señal de robo). Máximo 30 días. |
| Revalidación | Cada llamada revisa token, rol y 2FA de la cuenta. |
| Permisos | Acciones sólo con scope `mcp:write` (administrador). Nada mueve dinero ni borra. |
| SQL | `consulta_sql` usa un usuario de base de datos propio (`uzeed_mcp_sql`, sin forma de volver al dueño de la base): la **base** niega credenciales, email, teléfonos, mensajes privados, datos bancarios, RUT, IPs, ubicación exacta, documentos, fotos de verificación, sesiones y tokens. Transacción de sólo lectura, 20 s, 2 conexiones máximo. La API crea ese usuario al arrancar (clave como hash SCRAM). Las columnas o tablas nuevas quedan invisibles salvo que no sean sensibles por nombre. |
| Fuerza bruta | 20 tokens inválidos desde una IP → bloqueada 30 min. Límites por endpoint y 120 llamadas/min por token. |
| Consentimiento | Sin JavaScript, CSP estricta, no se puede enmarcar (clickjacking), CSRF por solicitud, 5 intentos de código máximo. |
| Bitácora | Cada llamada y cada evento de autorización con cuenta, cliente e IP. Visible en `/admin/claude`. |
| Errores | Las respuestas no muestran detalles internos; quedan en la bitácora. |

Las cuentas de equipo (MODERATOR) no pueden conectar Claude: el 2FA es sólo
para administradores.
