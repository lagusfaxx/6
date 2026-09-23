# Servidor MCP de UZEED (Claude)

La API expone un servidor [MCP](https://modelcontextprotocol.io) en `/mcp`. Con
él, Claude (claude.ai, la app de escritorio o Claude Code) se conecta directo a
la base de UZEED para sacar estadísticas, armar informes y hacer algunas
acciones del panel admin, pidiéndolo en lenguaje natural.

Código: `apps/api/src/mcp/`.

## 1. Activarlo

1. Genera un token: `openssl rand -hex 32`.
2. En Coolify, en la app **API**, agrega `MCP_TOKEN=<token>` (y opcionalmente
   `MCP_READ_TOKEN=<otro token>` para un acceso sólo de lectura).
3. Redeploy. La migración `add_mcp_audit_log` crea la tabla de bitácora sola.

Sin tokens configurados, `/mcp` responde 404.

| Token            | Herramientas                               |
| ---------------- | ------------------------------------------ |
| `MCP_TOKEN`      | Todas: lecturas + acciones                 |
| `MCP_READ_TOKEN` | Sólo lecturas (las acciones ni aparecen)   |

## 2. Conectarlo

**claude.ai / Claude Desktop** → Configuración → Conectores → *Agregar conector
personalizado* → URL:

```
https://api.uzeed.cl/mcp/<MCP_TOKEN>
```

(Los conectores personalizados no permiten cabeceras, por eso el token va en
la ruta. Trátala como una contraseña.)

**Claude Code** (token en cabecera, no queda en la URL):

```bash
claude mcp add --transport http uzeed https://api.uzeed.cl/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

Para cambiar o revocar el acceso, cambia el token en Coolify y redeploy.

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

### Acciones (sólo con `MCP_TOKEN`)

`cambiar_estado_perfil`, `aprobar_verificacion`, `rechazar_verificacion`,
`cambiar_tier`. Hacen lo mismo que el botón equivalente del panel y quedan en la
bitácora (`McpAuditLog`). A propósito **no hay** herramientas que muevan dinero
(depósitos, retiros, reembolsos, saldos) ni que borren: eso sigue en el panel,
con su 2FA.

## 4. Seguridad

- Token comparado en tiempo constante; mínimo 32 caracteres.
- `consulta_sql` corre en una transacción `READ ONLY` con 20 s de límite, una
  sola sentencia, y rechaza funciones de sistema, la tabla `session` y las
  columnas de credenciales.
- Toda respuesta tapa `passwordHash`, `twoFactorSecret`, `passwordSetToken`,
  `tokenHash` y claves de push, aunque se pidan con `SELECT *`.
- Límite de 240 llamadas por minuto.
- Los errores del MCP no loguean la URL (puede llevar el token).
