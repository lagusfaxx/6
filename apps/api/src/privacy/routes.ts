import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";

export const privacyRouter = Router();

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes. Intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── HTML Legal Pages (required by App Store & Google Play) ──────────────

const legalPageStyle = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; line-height: 1.7; padding: 24px; max-width: 720px; margin: 0 auto; }
    h1 { color: #fff; font-size: 1.75rem; margin-bottom: 8px; }
    h2 { color: #fff; font-size: 1.15rem; margin-top: 28px; margin-bottom: 8px; }
    p, li { font-size: 0.95rem; color: #a3a3a3; margin-bottom: 10px; }
    ul { padding-left: 20px; }
    a { color: #a78bfa; }
    .date { font-size: 0.8rem; color: #737373; margin-bottom: 24px; }
  </style>
`;

privacyRouter.get("/legal/privacidad", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Política de Privacidad – Uzeed</title>${legalPageStyle}</head><body>
<h1>Política de Privacidad</h1>
<p class="date">Última actualización: 2 de abril de 2026</p>

<p>Uzeed ("nosotros", "la plataforma") opera la aplicación móvil Uzeed y el sitio web uzeed.cl. Esta política describe cómo recopilamos, usamos y protegemos tu información personal.</p>

<h2>1. Información que recopilamos</h2>
<ul>
  <li><strong>Datos de cuenta:</strong> nombre, correo electrónico, teléfono, ciudad y foto de perfil que proporcionas al registrarte.</li>
  <li><strong>Contenido del usuario:</strong> mensajes, fotos de galería y transmisiones en vivo que compartes en la plataforma.</li>
  <li><strong>Datos de uso:</strong> interacciones con la app, horarios de conexión y preferencias.</li>
  <li><strong>Datos de transacciones:</strong> historial de compras de tokens, depósitos y retiros procesados por Flow.cl.</li>
  <li><strong>Datos técnicos:</strong> tipo de dispositivo, sistema operativo y dirección IP.</li>
</ul>

<h2>2. Cómo usamos tu información</h2>
<ul>
  <li>Proveer y mejorar los servicios de la plataforma.</li>
  <li>Procesar transacciones y gestionar tu billetera de tokens.</li>
  <li>Facilitar la comunicación entre usuarios (mensajes y videollamadas).</li>
  <li>Enviar notificaciones relevantes sobre tu actividad.</li>
  <li>Prevenir fraude y garantizar la seguridad de la plataforma.</li>
</ul>

<h2>3. Compartición de datos</h2>
<p>No vendemos tu información personal. Compartimos datos limitados con:</p>
<ul>
  <li><strong>Flow.cl:</strong> para procesar pagos de forma segura.</li>
  <li><strong>LiveKit:</strong> para facilitar videollamadas y transmisiones en vivo.</li>
  <li><strong>Autoridades:</strong> cuando sea requerido por ley.</li>
</ul>

<h2>4. Almacenamiento y seguridad</h2>
<p>Tu información se almacena en servidores seguros. Usamos cifrado HTTPS para todas las comunicaciones, autenticación basada en sesiones con cookies seguras, y controles de acceso estrictos.</p>

<h2>5. Tus derechos</h2>
<p>Puedes en cualquier momento:</p>
<ul>
  <li>Acceder y editar tu información personal desde tu perfil.</li>
  <li>Solicitar la eliminación de tu cuenta y datos.</li>
  <li>Exportar tus datos personales.</li>
  <li>Retirar tu consentimiento para comunicaciones opcionales.</li>
</ul>

<h2>6. Eliminación de cuenta</h2>
<p>Puedes solicitar la eliminación de tu cuenta directamente desde la app en Perfil → Eliminar cuenta, o enviando un correo a <a href="mailto:contacto@uzeed.cl">contacto@uzeed.cl</a>. Procesaremos tu solicitud en un máximo de 30 días.</p>

<h2>7. Menores de edad</h2>
<p>Uzeed está destinado exclusivamente a personas mayores de 18 años. No recopilamos intencionalmente datos de menores.</p>

<h2>8. Cambios a esta política</h2>
<p>Notificaremos cualquier cambio material a esta política a través de la app. El uso continuado constituye aceptación de los cambios.</p>

<h2>9. Contacto</h2>
<p>Para consultas sobre privacidad: <a href="mailto:contacto@uzeed.cl">contacto@uzeed.cl</a></p>
</body></html>`);
});

privacyRouter.get("/legal/seguridad-infantil", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Estándares de Seguridad Infantil – Uzeed</title>${legalPageStyle}</head><body>
<h1>Estándares de Seguridad Infantil</h1>
<p class="date">Última actualización: 2 de abril de 2026</p>

<p>Uzeed tiene tolerancia cero con la explotación y el abuso sexual infantil (EASI) en nuestra plataforma. Estamos comprometidos con la seguridad de los menores y cumplimos con todas las leyes aplicables.</p>

<h2>1. Restricción de edad</h2>
<p>Uzeed está destinado exclusivamente a personas mayores de 18 años. Verificamos la edad durante el registro y prohibimos el acceso a menores de edad.</p>

<h2>2. Prohibición de contenido EASI</h2>
<p>Está estrictamente prohibido en Uzeed:</p>
<ul>
  <li>Publicar, compartir o solicitar material de abuso sexual infantil (CSAM) en cualquier forma.</li>
  <li>Usar la plataforma para contactar, atraer o explotar a menores de edad.</li>
  <li>Compartir contenido que sexualice a menores de cualquier manera.</li>
  <li>Cualquier conducta que ponga en riesgo la seguridad de un menor.</li>
</ul>

<h2>3. Detección y prevención</h2>
<ul>
  <li>Moderación activa de contenido reportado por usuarios.</li>
  <li>Sistema de reportes accesible dentro de la aplicación para denunciar contenido o comportamiento inapropiado.</li>
  <li>Revisión y acción inmediata ante cualquier reporte relacionado con seguridad infantil.</li>
  <li>Suspensión inmediata de cuentas involucradas en actividades relacionadas con EASI.</li>
</ul>

<h2>4. Reportar</h2>
<p>Si encuentras contenido o comportamiento que ponga en riesgo a menores:</p>
<ul>
  <li>Usa el botón "Reportar usuario" dentro de la aplicación.</li>
  <li>Envía un correo a <a href="mailto:contacto@uzeed.cl">contacto@uzeed.cl</a> con el asunto "Seguridad Infantil".</li>
</ul>
<p>Todos los reportes relacionados con seguridad infantil son tratados con máxima prioridad.</p>

<h2>5. Cooperación con autoridades</h2>
<p>Uzeed coopera plenamente con las autoridades policiales y judiciales. Reportamos cualquier caso de EASI identificado a las autoridades competentes, incluyendo el NCMEC (National Center for Missing & Exploited Children) y las autoridades chilenas correspondientes.</p>

<h2>6. Contacto</h2>
<p>Para reportar problemas de seguridad infantil: <a href="mailto:contacto@uzeed.cl">contacto@uzeed.cl</a></p>
</body></html>`);
});

privacyRouter.get("/legal/terminos", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Términos de Servicio – Uzeed</title>${legalPageStyle}</head><body>
<h1>Términos de Servicio</h1>
<p class="date">Última actualización: 2 de abril de 2026</p>

<p>Al usar Uzeed aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.</p>

<h2>1. Descripción del servicio</h2>
<p>Uzeed es una plataforma que conecta profesionales de servicios con clientes, facilitando comunicación, videollamadas y transmisiones en vivo.</p>

<h2>2. Requisitos de uso</h2>
<ul>
  <li>Debes ser mayor de 18 años.</li>
  <li>Debes proporcionar información veraz al registrarte.</li>
  <li>Eres responsable de mantener la seguridad de tu cuenta.</li>
</ul>

<h2>3. Conducta del usuario</h2>
<p>Al usar Uzeed te comprometes a:</p>
<ul>
  <li>No publicar contenido ilegal, difamatorio o que viole derechos de terceros.</li>
  <li>No utilizar la plataforma para actividades fraudulentas.</li>
  <li>No acosar, amenazar o intimidar a otros usuarios.</li>
  <li>No crear cuentas falsas o suplantar identidades.</li>
  <li>Respetar las normas de la comunidad en transmisiones en vivo.</li>
</ul>

<h2>4. Sistema de tokens y pagos</h2>
<ul>
  <li>Los tokens son una moneda virtual dentro de la plataforma.</li>
  <li>Las compras de tokens se procesan a través de Flow.cl y son finales.</li>
  <li>Los profesionales pueden solicitar retiros de sus ganancias según las condiciones vigentes.</li>
  <li>Nos reservamos el derecho de suspender la billetera en caso de actividad sospechosa.</li>
</ul>

<h2>5. Contenido del usuario</h2>
<p>Eres responsable del contenido que publicas. Al subir contenido, nos otorgas una licencia no exclusiva para mostrarlo dentro de la plataforma. Nos reservamos el derecho de eliminar contenido que viole estos términos.</p>

<h2>6. Videollamadas y transmisiones</h2>
<ul>
  <li>Las videollamadas son privadas entre los participantes.</li>
  <li>Está prohibido grabar videollamadas sin consentimiento.</li>
  <li>Las transmisiones en vivo deben cumplir con las normas de la comunidad.</li>
</ul>

<h2>7. Limitación de responsabilidad</h2>
<p>Uzeed es un intermediario tecnológico. No somos responsables por la calidad de los servicios prestados por profesionales, disputas entre usuarios, ni interrupciones técnicas fuera de nuestro control.</p>

<h2>8. Suspensión y terminación</h2>
<p>Podemos suspender o eliminar cuentas que violen estos términos, sin previo aviso en casos graves. Puedes eliminar tu cuenta en cualquier momento desde la app.</p>

<h2>9. Propiedad intelectual</h2>
<p>La marca Uzeed, su diseño y código son propiedad de sus creadores. No puedes copiar, modificar o distribuir ningún elemento de la plataforma sin autorización.</p>

<h2>10. Ley aplicable</h2>
<p>Estos términos se rigen por las leyes de la República de Chile. Cualquier disputa se resolverá ante los tribunales competentes de Santiago.</p>

<h2>11. Contacto</h2>
<p>Para consultas: <a href="mailto:contacto@uzeed.cl">contacto@uzeed.cl</a></p>
</body></html>`);
});

/**
 * POST /privacy/request-deletion
 * Public endpoint – anyone can request account/data deletion.
 * Body: { type: "account" | "data", email: string, message?: string }
 */
privacyRouter.post(
  "/privacy/request-deletion",
  publicFormLimiter,
  asyncHandler(async (req, res) => {
    const { type, email, message } = req.body || {};

    if (!type || !["account", "data"].includes(type)) {
      return res.status(400).json({ error: "INVALID_TYPE", message: "Tipo debe ser 'account' o 'data'." });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "INVALID_EMAIL", message: "Debes proporcionar un correo válido." });
    }

    const sanitizedEmail = email.trim().slice(0, 254);
    const sanitizedMessage = typeof message === "string" ? message.trim().slice(0, 1000) : "";
    const label = type === "account" ? "cuenta y datos" : "datos";

    await emitAdminEvent({
      type: "deletion_requested",
      user: sanitizedEmail,
      contentType: "profile",
      targetId: type,
    });

    console.info("[privacy] deletion request", { type, timestamp: new Date().toISOString() });

    return res.json({
      ok: true,
      message: `Solicitud de eliminación de ${label} recibida. Nos pondremos en contacto contigo.`,
    });
  }),
);

/**
 * POST /contact
 * Public endpoint – contact form submissions.
 * Body: { name?: string, email: string, category: string, message: string }
 */
privacyRouter.post(
  "/contact",
  publicFormLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, category, message } = req.body || {};

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "INVALID_EMAIL", message: "Debes proporcionar un correo válido." });
    }
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return res.status(400).json({ error: "INVALID_MESSAGE", message: "El mensaje debe tener al menos 5 caracteres." });
    }

    const sanitizedEmail = email.trim().slice(0, 254);
    const sanitizedName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    const sanitizedCategory = typeof category === "string" ? category.trim().slice(0, 50) : "general";
    const sanitizedMessage = message.trim().slice(0, 2000);

    await emitAdminEvent({
      type: "contact_form",
      user: sanitizedName ? `${sanitizedName} (${sanitizedEmail})` : sanitizedEmail,
      contentType: "message",
      targetId: sanitizedCategory,
    });

    console.info("[contact] form submission", {
      category: sanitizedCategory,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: "Tu mensaje ha sido enviado. Te responderemos a la brevedad.",
    });
  }),
);
