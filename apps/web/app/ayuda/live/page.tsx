"use client";

import { Radio } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaLivePage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Radio}
        title="Transmisiones en vivo"
        subtitle="Conecta en tiempo real con los creadores: mira streams, envía propinas y participa desde cualquier dispositivo."
      />

      <Section title="¿Qué son los lives en UZEED?">
        <p>
          Los lives son transmisiones en vivo donde los creadores interactúan
          con su audiencia en tiempo real. Cualquier usuario puede verlas desde
          la sección <strong>En Vivo</strong> del menú, y los usuarios
          registrados pueden enviar reacciones, mensajes y propinas.
        </p>
      </Section>

      <Section title="Cómo ver un live">
        <StepList
          steps={[
            {
              title: "Entra a En Vivo",
              body: "En la barra lateral (desktop) o en la barra inferior (móvil) encontrarás el acceso “En Vivo”, marcado con un punto rojo pulsante cuando hay transmisiones activas.",
            },
            {
              title: "Elige un stream",
              body: "Verás las transmisiones activas con el título, miniatura y cantidad de espectadores. Toca la que te interese para entrar.",
            },
            {
              title: "Interactúa",
              body: "Una vez dentro, puedes escribir en el chat en vivo, enviar reacciones rápidas y, si tienes saldo, propinas en tokens.",
            },
          ]}
        />
      </Section>

      <Section title="Enviar propinas y regalos">
        <p>
          Las propinas se pagan en tokens. Elige un monto o un regalo virtual,
          confirma y se descuenta automáticamente de tu billetera. El creador
          recibirá el aviso en pantalla y verá tu nombre destacado.
        </p>
        <Callout tone="info">
          Las propinas son una forma directa de apoyar a los creadores. El 100%
          del detalle de tus envíos queda registrado en el historial de tu
          billetera.
        </Callout>
      </Section>

      <Section title="Cómo hacer tu propio live (creadores)">
        <StepList
          steps={[
            {
              title: "Accede a Live Studio",
              body: "Desde tu Dashboard, abre la sección “Live” o “Live Studio”.",
            },
            {
              title: "Configura tu stream",
              body: "Escribe un título atractivo, elige una portada y revisa la cámara y el micrófono.",
            },
            {
              title: "Empieza a transmitir",
              body: "Presiona “Iniciar transmisión”. Tu live aparecerá en la portada de En Vivo y tus seguidores recibirán una notificación.",
            },
            {
              title: "Interactúa con tu audiencia",
              body: "Responde mensajes, agradece propinas y mantén la energía para que tu stream crezca.",
            },
            {
              title: "Finaliza cuando quieras",
              body: "Al terminar, verás un resumen con espectadores, propinas recibidas y tokens generados.",
            },
          ]}
        />
      </Section>

      <Section title="Requisitos técnicos">
        <BulletList
          items={[
            "Conexión estable (recomendado mínimo 5 Mbps de subida para transmitir).",
            "Cámara y micrófono funcionando con permisos activos en el navegador.",
            "Navegador moderno: Chrome, Edge, Safari o Firefox actualizados.",
            "En móvil: permitir acceso a cámara y micrófono cuando el navegador lo solicite.",
          ]}
        />
      </Section>

      <Section title="Reglas de la comunidad en lives">
        <BulletList
          items={[
            "Prohibido cualquier contenido que involucre a menores de edad.",
            "No se permite acoso, amenazas ni discurso de odio en el chat.",
            "Los creadores deben cumplir las reglas de UZEED y las leyes de Chile.",
            "UZEED puede finalizar transmisiones que incumplan las normas sin previo aviso.",
          ]}
        />
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/videollamadas", label: "Videollamadas" },
          { href: "/ayuda/tokens", label: "Tokens" },
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
        ]}
      />
    </PageBody>
  );
}
