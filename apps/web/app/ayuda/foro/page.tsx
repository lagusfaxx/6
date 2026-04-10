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
          abrir nuevos hilos, responder a los existentes, votar publicaciones
          y seguir temas que te interesen. Es ideal para compartir
          recomendaciones, hacer preguntas y conectar con otros usuarios.
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
              body: "Verás los hilos ordenados por actividad. Puedes filtrar por categoría o buscar un tema específico.",
            },
            {
              title: "Crea un hilo o responde",
              body: "Pulsa “Nuevo hilo” para crear uno propio o entra a un hilo existente para responder.",
            },
            {
              title: "Vota y guarda",
              body: "Con un clic puedes dar tu voto a un hilo o respuesta y mantener lo más útil en la cima.",
            },
          ]}
        />
      </Section>

      <Section title="Notificaciones del foro">
        <p>
          Cuando haya actividad nueva en hilos que sigues o donde hayas
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
