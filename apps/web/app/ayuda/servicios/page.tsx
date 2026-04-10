"use client";

import { Sparkles } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  TopicHeader,
} from "../_components";

export default function AyudaServiciosPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Sparkles}
        title="Servicios y directorio"
        subtitle="UZEED reúne escorts, masajistas, moteles y sex shops en un solo lugar, con búsqueda, favoritos y perfiles verificados."
      />

      <Section title="¿Qué categorías existen?">
        <BulletList
          items={[
            <><strong>Escorts:</strong> perfiles de acompañantes con fotos, descripción, tarifas y disponibilidad.</>,
            <><strong>Masajistas:</strong> servicios de masajes relajantes, sensuales y terapéuticos.</>,
            <><strong>Moteles:</strong> hospedaje privado por horas con fotos de habitaciones y tarifas.</>,
            <><strong>Sex Shops:</strong> tiendas de productos para adultos con catálogo y ubicación.</>,
            <><strong>Despedidas:</strong> servicios especializados en fiestas de despedida.</>,
          ]}
        />
      </Section>

      <Section title="Explorar y filtrar">
        <p>
          Cada categoría tiene su propia página con filtros específicos:
          ubicación, precio, tags, atributos físicos, idiomas, verificación y
          más. En la sección <strong>Cerca tuyo</strong> también puedes ver
          todos los perfiles disponibles en tu ciudad ordenados por distancia.
        </p>
      </Section>

      <Section title="Cómo elegir tu ubicación">
        <p>
          En la parte superior hay un selector con tu ciudad. Puedes usar tu
          ubicación GPS (requiere permiso del navegador) o elegir manualmente
          una ciudad chilena del listado. El filtro de ubicación afecta a
          todas las secciones del directorio.
        </p>
      </Section>

      <Section title="Perfiles verificados">
        <p>
          Los perfiles con insignia de verificación pasaron por un proceso de
          validación de identidad. Esto aumenta tu tranquilidad al contratar
          un servicio o contactar al profesional. Busca la insignia junto al
          nombre del perfil.
        </p>
      </Section>

      <Section title="Favoritos">
        <p>
          Desde cualquier tarjeta o perfil puedes tocar el corazón para
          guardarlo en tus favoritos. Luego los encuentras rápidamente en la
          sección <strong>Favoritos</strong> del menú para volver cuando
          quieras.
        </p>
      </Section>

      <Section title="Contactar un perfil">
        <BulletList
          items={[
            "Abre el perfil y usa el botón de chat para conversar dentro de UZEED.",
            "Si el profesional tiene videollamadas habilitadas, puedes agendar desde su perfil.",
            "Evita contactar por canales externos antes de conocer bien a la persona.",
          ]}
        />
        <Callout tone="warn">
          Nunca realices pagos por fuera de UZEED. Las transacciones dentro de
          la plataforma están protegidas y dejan un historial verificable.
        </Callout>
      </Section>

      <Section title="Publicar mi perfil (profesionales y establecimientos)">
        <p>
          Si ofreces un servicio, puedes crear tu perfil desde la opción{" "}
          <strong>Publicate</strong> y elegir el tipo: profesional,
          establecimiento (motel, hospedaje) o tienda (sex shop). Desde tu
          Dashboard podrás editar fotos, datos, tarifas y disponibilidad.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/cuenta", label: "Cuenta y perfil" },
          { href: "/ayuda/chat", label: "Chat y mensajes" },
          { href: "/ayuda/videollamadas", label: "Videollamadas" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
        ]}
      />
    </PageBody>
  );
}
