"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  TopicHeader,
} from "../_components";

export default function AyudaSeguridadPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={ShieldCheck}
        title="Seguridad y privacidad"
        subtitle="Tu seguridad es prioridad. Conoce cómo protegemos tu información y cómo protegerte a ti mismo."
      />

      <Section title="Solo mayores de edad">
        <p>
          UZEED es una plataforma exclusiva para mayores de 18 años. Está
          prohibido registrar cuentas falsas o a nombre de menores. Cualquier
          sospecha es reportable y puede derivar en sanciones legales.
        </p>
      </Section>

      <Section title="Cómo protegemos tu información">
        <BulletList
          items={[
            "Conexiones cifradas (HTTPS) en todo momento.",
            "Contraseñas almacenadas con hashing seguro, nunca en texto plano.",
            "Verificación de correo y validación de números en acciones sensibles.",
            "Pagos procesados por proveedores certificados (Flow, bancos).",
            "Acceso restringido a datos sensibles: solo personal autorizado.",
          ]}
        />
      </Section>

      <Section title="Consejos para cuidarte al contratar">
        <BulletList
          items={[
            "Prefiere perfiles con insignia de verificación.",
            "Lee reseñas y comentarios del foro antes de decidir.",
            "Comunícate siempre primero por el chat interno de UZEED.",
            "No pagues por fuera de la plataforma: sin historial no hay protección.",
            "Si algo no te cuadra, reporta al profesional antes de avanzar.",
          ]}
        />
      </Section>

      <Section title="Señales de alerta">
        <BulletList
          items={[
            "Presión para pagar fuera de la plataforma.",
            "Pedidos de datos personales sensibles (claves bancarias, direcciones completas).",
            "Fotos que parecen robadas de otros sitios.",
            "Precios demasiado bajos comparados con el mercado.",
            "Cuentas recién creadas sin verificación.",
          ]}
        />
        <Callout tone="warn">
          Si detectas cualquiera de estas señales, no avances con el contacto
          y usa el botón de reportar para que nuestro equipo investigue.
        </Callout>
      </Section>

      <Section title="Privacidad de tus datos">
        <p>
          Solo recopilamos la información necesaria para operar la plataforma
          (correo, datos de perfil, transacciones). No vendemos tus datos a
          terceros y cumplimos con la legislación chilena vigente. Puedes leer
          la{" "}
          <Link href="/privacidad" className="text-fuchsia-400 underline hover:text-fuchsia-300">
            política de privacidad completa
          </Link>{" "}
          para más detalles.
        </p>
      </Section>

      <Section title="Reportar un problema">
        <p>
          Dentro de chats, perfiles y publicaciones del foro verás la opción
          de reportar. También puedes escribirnos desde la{" "}
          <Link href="/contacto" className="text-fuchsia-400 underline hover:text-fuchsia-300">
            página de contacto
          </Link>{" "}
          para cualquier situación que involucre tu seguridad o la de otros.
          Tomamos cada reporte en serio.
        </p>
      </Section>

      <Section title="Recursos legales">
        <BulletList
          items={[
            <><Link className="text-fuchsia-400 underline hover:text-fuchsia-300" href="/terminos">Términos y condiciones</Link></>,
            <><Link className="text-fuchsia-400 underline hover:text-fuchsia-300" href="/privacidad">Política de privacidad</Link></>,
            <><Link className="text-fuchsia-400 underline hover:text-fuchsia-300" href="/contacto">Contacto y soporte</Link></>,
          ]}
        />
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/cuenta", label: "Cuenta y perfil" },
          { href: "/ayuda/chat", label: "Chat y mensajes" },
          { href: "/ayuda/billetera", label: "Billetera" },
        ]}
      />
    </PageBody>
  );
}
