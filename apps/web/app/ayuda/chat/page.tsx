"use client";

import { MessageCircle } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaChatPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={MessageCircle}
        title="Chat y mensajes"
        subtitle="Conversa de forma privada con profesionales y otros usuarios, con notificaciones en tiempo real."
      />

      <Section title="¿Cómo funciona el chat?">
        <p>
          El chat te permite enviar mensajes directos a perfiles verificados.
          Las conversaciones están listadas en la sección <strong>Chat</strong>{" "}
          del menú. Los mensajes son en tiempo real: cuando alguien te escribe,
          recibes una notificación y un indicador en el menú lateral.
        </p>
      </Section>

      <Section title="Iniciar una conversación">
        <StepList
          steps={[
            {
              title: "Abre un perfil",
              body: "Ingresa al perfil del profesional que te interesa desde cualquier sección (Escorts, Masajistas, etc.).",
            },
            {
              title: "Presiona “Enviar mensaje”",
              body: "Se abrirá la ventana de chat donde puedes escribir tu primer mensaje.",
            },
            {
              title: "Sé claro y respetuoso",
              body: "Preséntate y explica qué buscas. El trato amable siempre mejora la respuesta.",
            },
          ]}
        />
      </Section>

      <Section title="Notificaciones de mensajes">
        <BulletList
          items={[
            "Verás un punto y un contador fucsia en el icono de Chat cuando tengas mensajes sin leer.",
            "Si permites notificaciones push, recibirás avisos aunque no tengas UZEED abierto.",
            "Al abrir la conversación, los mensajes se marcan como leídos automáticamente.",
          ]}
        />
      </Section>

      <Section title="Privacidad en el chat">
        <BulletList
          items={[
            "Los mensajes solo los ven tú y el destinatario.",
            "Nunca compartimos tu contenido con terceros.",
            "Puedes bloquear o reportar a un usuario desde la cabecera de la conversación.",
          ]}
        />
        <Callout tone="warn">
          Nunca envíes datos sensibles como claves bancarias, direcciones
          completas o documentos personales por chat. UZEED nunca te los
          pedirá.
        </Callout>
      </Section>

      <Section title="Bloqueos y reportes">
        <p>
          Si alguien te incomoda, tienes dos opciones: <strong>bloquear</strong>{" "}
          (dejarás de recibir mensajes de esa persona) o <strong>reportar</strong>{" "}
          (nuestro equipo revisará el caso y aplicará sanciones si
          corresponde). Ambas acciones están en el menú de la conversación.
        </p>
      </Section>

      <Section title="Chat y videollamadas">
        <p>
          Desde el chat puedes coordinar una videollamada con el profesional.
          Recuerda que las videollamadas se pagan en tokens y se agendan desde
          el perfil: no pagues nunca fuera de la plataforma.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/videollamadas", label: "Videollamadas" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
          { href: "/ayuda/servicios", label: "Servicios" },
          { href: "/ayuda/cuenta", label: "Cuenta y perfil" },
        ]}
      />
    </PageBody>
  );
}
