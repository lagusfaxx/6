"use client";

import { User } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaCuentaPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={User}
        title="Cuenta y perfil"
        subtitle="Todo lo que debes saber para registrar, personalizar y proteger tu cuenta en UZEED."
      />

      <Section title="Tipos de cuenta">
        <BulletList
          items={[
            <><strong>Cliente:</strong> para explorar la plataforma, contactar profesionales, hacer videollamadas y usar todas las funciones de cliente.</>,
            <><strong>Profesional:</strong> para publicar tu perfil, subir fotos, recibir mensajes y agendar videollamadas.</>,
            <><strong>Establecimiento:</strong> para moteles, hospedajes y locales que quieran publicar habitaciones y tarifas.</>,
            <><strong>Tienda (shop):</strong> para sex shops con catálogo de productos.</>,
          ]}
        />
      </Section>

      <Section title="Crear tu cuenta">
        <StepList
          steps={[
            {
              title: "Toca “Crear cuenta”",
              body: "Desde la pantalla de login o desde el menú superior / hamburguesa.",
            },
            {
              title: "Elige el tipo de cuenta",
              body: "Cliente si vienes a explorar, o profesional / establecimiento / tienda si vas a publicar.",
            },
            {
              title: "Completa tus datos",
              body: "Usuario, correo y contraseña segura. Aceptas los términos y condiciones y la política de privacidad.",
            },
            {
              title: "Verifica tu correo",
              body: "Recibirás un email para confirmar la cuenta. Este paso es obligatorio para usar la plataforma.",
            },
          ]}
        />
      </Section>

      <Section title="Verificación de identidad">
        <p>
          Los profesionales pueden pasar por un proceso de verificación que
          otorga una insignia visible en su perfil. Sube tu documento de
          identidad y una foto según las instrucciones. La verificación
          incrementa la confianza de los clientes y mejora tu visibilidad.
        </p>
        <Callout tone="info">
          UZEED nunca comparte tu documento con terceros. Solo se usa para
          verificar tu identidad.
        </Callout>
      </Section>

      <Section title="Editar tu perfil">
        <BulletList
          items={[
            "Foto de perfil y galería (si eres profesional).",
            "Nombre visible, biografía y tags descriptivos.",
            "Ubicación, disponibilidad y horarios.",
            "Tarifas de videollamadas, lives y servicios presenciales.",
            "Métodos de contacto habilitados.",
          ]}
        />
        <p>
          Todo se edita desde <strong>Dashboard &gt; Editar perfil</strong>.
          Los cambios se publican en tiempo real.
        </p>
      </Section>

      <Section title="Contraseña y seguridad">
        <BulletList
          items={[
            "Usa una contraseña de al menos 8 caracteres, combinando letras, números y símbolos.",
            "Cámbiala periódicamente desde la sección Cuenta.",
            "Si olvidas la contraseña, usa “¿Olvidaste tu contraseña?” en el login para recibir un enlace de recuperación.",
            "No compartas tu contraseña con nadie. UZEED nunca la solicita por correo ni por chat.",
          ]}
        />
      </Section>

      <Section title="Notificaciones">
        <p>
          Puedes permitir notificaciones push para recibir avisos incluso
          cuando no tengas la página abierta: mensajes, reservas de
          videollamadas, respuestas en el foro y actualizaciones importantes.
          Configura los permisos desde tu navegador o sistema.
        </p>
      </Section>

      <Section title="Eliminar tu cuenta">
        <p>
          Puedes solicitar la eliminación definitiva de tu cuenta desde la
          sección Cuenta. Este proceso elimina tus datos personales según lo
          establecido en la política de privacidad. Ten en cuenta que el
          saldo restante en tokens puede perderse si la cuenta se cierra.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/seguridad", label: "Seguridad y privacidad" },
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/servicios", label: "Servicios" },
          { href: "/ayuda/tiers", label: "Tiers y planes" },
        ]}
      />
    </PageBody>
  );
}
