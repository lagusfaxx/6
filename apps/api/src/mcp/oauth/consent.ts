/**
 * Páginas HTML del consentimiento OAuth. Sin JavaScript y sin recursos
 * externos: la CSP las deja sin nada que cargar ni dónde enmarcarse.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
  :root { color-scheme: light dark; --bg:#0f0f14; --card:#1a1a22; --fg:#f2f2f5; --muted:#a6a6b3; --line:#2c2c38; --accent:#e0457b; --warn:#f5b041; --bad:#ff6b6b; }
  @media (prefers-color-scheme: light) { :root { --bg:#f5f5f7; --card:#fff; --fg:#14141a; --muted:#5c5c68; --line:#e1e1e8; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:16px; }
  main { width:100%; max-width:440px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; }
  h1 { font-size:20px; margin:0 0 4px; }
  p { margin:8px 0; color:var(--muted); }
  dl { margin:16px 0; padding:12px 14px; border:1px solid var(--line); border-radius:12px; }
  dt { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  dd { margin:2px 0 10px; word-break:break-word; }
  dd:last-child { margin-bottom:0; }
  ul { margin:4px 0 0; padding-left:18px; }
  .warn { border-left:3px solid var(--warn); padding:8px 12px; margin:14px 0; color:var(--fg); }
  .error { border-left:3px solid var(--bad); padding:8px 12px; margin:14px 0; color:var(--fg); }
  label { display:block; font-weight:600; margin-top:16px; }
  input[type=text] { width:100%; margin-top:6px; padding:12px; font-size:22px; letter-spacing:.3em; text-align:center; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--fg); }
  .row { display:flex; gap:10px; margin-top:18px; }
  button { flex:1; padding:12px; font-size:15px; font-weight:600; border-radius:10px; border:1px solid var(--line); cursor:pointer; background:transparent; color:var(--fg); }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  a { color:var(--accent); }
`;

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>`;
}

export function errorPage(message: string): string {
  return page(
    "No se pudo autorizar",
    `<h1>No se pudo autorizar</h1><div class="error">${esc(message)}</div>
     <p>Cierra esta pestaña y vuelve a conectar desde Claude.</p>`,
  );
}

export function loginRequiredPage(appUrl: string, retryUrl: string): string {
  return page(
    "Inicia sesión",
    `<h1>Conectar Claude a UZEED</h1>
     <p>Para autorizar el acceso tienes que tener la sesión de administrador abierta en este navegador, con el doble factor ya verificado.</p>
     <div class="row"><a href="${esc(appUrl)}/login" target="_blank" rel="noopener noreferrer"><button class="primary" type="button">Iniciar sesión en UZEED</button></a></div>
     <p>Después vuelve a esta pestaña y <a href="${esc(retryUrl)}">reintenta</a>.</p>`,
  );
}

export function twoFactorRequiredPage(): string {
  return page(
    "Activa el doble factor",
    `<h1>Falta el doble factor</h1>
     <div class="warn">Sólo cuentas del equipo con doble factor (2FA) activado pueden conectar Claude. Actívalo en el panel de administración y vuelve a intentar.</div>`,
  );
}

export function consentPage(input: {
  requestId: string;
  clientName: string;
  redirectHost: string;
  loopback: boolean;
  email: string;
  scopes: string[];
  error?: string;
}): string {
  const perms = [
    `<li>Ver estadísticas, informes, perfiles, pagos y pendientes de UZEED.</li>`,
    input.scopes.includes("mcp:write")
      ? `<li><strong>Hacer acciones</strong>: ocultar o publicar perfiles, aprobar o rechazar verificaciones y cambiar tiers.</li>`
      : "",
  ].join("");
  return page(
    "Autorizar a Claude",
    `<h1>Autorizar acceso a UZEED</h1>
     <p>Una aplicación pide acceso al panel con tu cuenta.</p>
     <dl>
       <dt>Aplicación</dt><dd>${esc(input.clientName)}</dd>
       <dt>Devolverá el acceso a</dt><dd>${esc(input.redirectHost)}</dd>
       <dt>Tu cuenta</dt><dd>${esc(input.email)}</dd>
       <dt>Podrá</dt><dd><ul>${perms}</ul></dd>
     </dl>
     ${
       input.loopback
         ? `<div class="warn">El acceso vuelve a un programa en tu computador (Claude Code o Claude Desktop). Apruébalo sólo si <strong>tú</strong> acabas de iniciar esta conexión.</div>`
         : ""
     }
     <p>No se entrega tu contraseña. El acceso dura como máximo 30 días y se puede revocar desde el panel.</p>
     ${input.error ? `<div class="error">${esc(input.error)}</div>` : ""}
     <form method="post" action="/mcp-oauth/authorize" autocomplete="off">
       <input type="hidden" name="request_id" value="${esc(input.requestId)}">
       <label for="code">Código de tu app de doble factor</label>
       <input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required autofocus>
       <div class="row">
         <button type="submit" name="decision" value="deny" formnovalidate>Rechazar</button>
         <button type="submit" name="decision" value="approve" class="primary">Autorizar</button>
       </div>
     </form>`,
  );
}
