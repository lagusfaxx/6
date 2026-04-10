"use client";

import { Video } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaVideollamadasPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Video}
        title="Videollamadas"
        subtitle="Agenda sesiones privadas 1 a 1 con profesionales y disfruta desde cualquier lugar con total privacidad."
      />

      <Section title="¿Qué son las videollamadas?">
        <p>
          Son sesiones privadas por video, pagadas en tokens, entre un usuario
          y un profesional. Ocurren dentro de UZEED, con una sala cifrada que
          solo está activa durante el tiempo reservado. No necesitas instalar
          apps externas: todo se hace desde el navegador.
        </p>
      </Section>

      <Section title="Cómo reservar una videollamada">
        <StepList
          steps={[
            {
              title: "Encuentra a la profesional",
              body: "Desde la sección Videollamadas (menú) verás a quienes tienen la función habilitada, junto con su tarifa por minuto o por sesión.",
            },
            {
              title: "Elige el horario",
              body: "Abre su calendario y selecciona un bloque disponible. El sistema te muestra la zona horaria local de Chile.",
            },
            {
              title: "Confirma y paga con tokens",
              body: "El costo se bloquea desde tu billetera al momento de reservar. Si la videollamada no ocurre, los tokens vuelven automáticamente.",
            },
            {
              title: "Únete a la hora acordada",
              body: "A la hora programada recibirás una notificación con el botón “Unirme”. También puedes entrar desde la sección Videollamadas de tu cuenta.",
            },
          ]}
        />
      </Section>

      <Section title="Durante la llamada">
        <BulletList
          items={[
            "Video y audio bidireccional con cifrado extremo a extremo.",
            "Indicador del tiempo restante si la llamada se cobra por duración.",
            "Botones rápidos para silenciar micrófono, apagar cámara o finalizar.",
            "Chat interno para enviar mensajes sin interrumpir la conversación.",
          ]}
        />
        <Callout tone="warn">
          Respeta siempre al profesional: no grabes ni captures pantalla sin
          consentimiento. UZEED puede sancionar este tipo de conductas.
        </Callout>
      </Section>

      <Section title="Requisitos técnicos">
        <BulletList
          items={[
            "Conexión a Internet estable (mínimo recomendado 3 Mbps bajada / 1 Mbps subida).",
            "Cámara y micrófono funcionando, con permisos activos en el navegador.",
            "Navegador moderno actualizado: Chrome, Safari, Edge o Firefox.",
            "En móvil, se recomienda usar Wi-Fi para evitar cortes por cobertura.",
          ]}
        />
      </Section>

      <Section title="Cancelaciones y reembolsos">
        <p>
          Puedes cancelar una videollamada hasta cierto tiempo antes del inicio
          (el plazo exacto lo define cada profesional en sus políticas). Si
          cancelas dentro del plazo permitido, los tokens se devuelven a tu
          billetera. Si no llegas a la hora reservada, la sesión puede
          considerarse perdida y no habrá reembolso.
        </p>
      </Section>

      <Section title="Para profesionales: configurar tus videollamadas">
        <StepList
          steps={[
            {
              title: "Activa la función",
              body: "En tu Dashboard > Videollamadas, habilita la opción para aceptar reservas.",
            },
            {
              title: "Define tu tarifa",
              body: "Establece el precio en tokens por minuto o por sesión y la duración por defecto.",
            },
            {
              title: "Configura tu disponibilidad",
              body: "Marca los días y horarios en los que deseas recibir sesiones. Puedes bloquear cualquier momento en que no quieras recibir llamadas.",
            },
            {
              title: "Prepara tu setup",
              body: "Cámara estable, buena iluminación y un lugar privado sin interrupciones.",
            },
          ]}
        />
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/tokens", label: "Tokens" },
          { href: "/ayuda/live", label: "Transmisiones en vivo" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
        ]}
      />
    </PageBody>
  );
}
