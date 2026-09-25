"use client";

import { MessageSquare } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaForoPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={MessageSquare}
        title="Foro de la comunidad"
        subtitle="Un espacio para compartir experiencias, reseñas y consejos con otros usuarios de UZEED."
      />

      <Section title="¿Qué es el foro?">
        <p>
          El foro es el lugar donde la comunidad de UZEED conversa. Puedes
          hacer preguntas, responder, dar &ldquo;me gusta&rdquo; a los mensajes
          útiles y dejar tu opinión sobre los perfiles de la plataforma. Solo
          se muestra tu nickname.
        </p>
      </Section>

      <Section title="Cómo participar">
        <StepList
          steps={[
            {
              title: "Abre la sección Foro",
              body: "Disponible en el menú lateral (desktop), en el menú hamburguesa (móvil) y en el menú superior.",
            },
            {
              title: "Explora los hilos",
              body: "Verás las conversaciones ordenadas por actividad. Filtra por categoría, busca un tema o cambia a “Opiniones de perfiles”.",
            },
            {
              title: "Pregunta o responde",
              body: "Escribe tu pregunta en el cuadro de arriba (los detalles son opcionales) o entra a un tema para responder. Si no has iniciado sesión, guardamos lo que escribiste mientras entras.",
            },
            {
              title: "Dale me gusta y cita",
              body: "Marca con un corazón los mensajes útiles o usa “Citar” para responder a alguien en particular.",
            },
          ]}
        />
      </Section>

      <Section title="Notificaciones del foro">
        <p>
          Cuando alguien responda en temas que abriste o donde hayas
          comentado, verás un contador junto al icono de Foro. También recibes
          una notificación en el panel de campana del encabezado. Así no te
          pierdes respuestas importantes.
        </p>
      </Section>

      <Section title="Reglas del foro">
        <BulletList
          items={[
            "Respeto ante todo: cero acoso, insultos o discurso de odio.",
            "Prohibido publicar datos personales de terceros (fotos, direcciones, teléfonos).",
            "No se permite contenido ilegal, spam ni publicidad de servicios externos.",
            "Mantén los hilos en el tema. Fuera de tema puede ser movido o eliminado.",
            "Los moderadores pueden ocultar, mover o eliminar publicaciones que incumplan las reglas.",
          ]}
        />
        <Callout tone="warn">
          Si ves una publicación que rompe las reglas, repórtala. Nuestro
          equipo revisa cada reporte y toma medidas.
        </Callout>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/chat", label: "Chat y mensajes" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
          { href: "/ayuda/cuenta", label: "Cuenta y perfil" },
        ]}
      />
    </PageBody>
  );
}
