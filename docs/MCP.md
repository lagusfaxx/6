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

| Herramienta           | Para qué                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `resumen_general`     | Foto actual del negocio (la misma del dashboard admin).                                      |
| `kpis_periodo`        | KPIs de un rango con comparación contra el periodo anterior.                                 |
| `serie_temporal`      | Evolución diaria/semanal/mensual de 22 métricas, sin huecos (los días sin actividad van en 0). |
| `analitica_trafico`   | Visitas, sesiones, páginas, secciones, referentes, ciudades, acciones.                       |
| `buscar_usuarios`     | Buscar/filtrar usuarios por texto, tipo, ciudad, tier, estado, inactividad, registro.        |
| `ver_usuario`         | Ficha completa de un usuario con actividad, pagos y pendientes.                              |
| `ranking_perfiles`    | Top por visitas, WhatsApp, mensajes, favoritos, solicitudes, ganancias...                    |
| `membresias`          | Activas, por vencer, vencidas y pruebas vencidas sin pago.                                   |
| `informe_ingresos`    | Finanzas del periodo: por propósito, método, tokens, marketplace, U-Mate, top pagadores.     |
| `listar_pagos`        | Pagos filtrados por estado, propósito, método y fecha.                                       |
| `pendientes`          | Todas las colas que esperan al equipo, con los casos más antiguos.                           |
| `resumen_marketplace` | Pedidos, ventas, comisión, top vendedoras y productos.                                       |
| `resumen_umate`       | Creadoras, suscripciones, top creadoras y libro contable.                                    |
| `describir_esquema`   | Tablas, columnas y enums de la base.                                                         |
| `consulta_sql`        | SELECT libre de sólo lectura para cualquier cosa que falte.                                  |
| `ver_bitacora`        | Qué acciones y consultas se hicieron por el MCP.                                             |

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
bitácora (`McpAuditLog`). A propósito **no hay** herramientas que muevan dinero
(depósitos, retiros, reembolsos, saldos) ni que borren: eso sigue en el panel,
con su 2FA.

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
