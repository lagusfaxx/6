"use client";

import { Coins } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  TopicHeader,
} from "../_components";

export default function AyudaTokensPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Coins}
        title="Tokens"
        subtitle="Los tokens son la moneda virtual de UZEED. Con ellos pagas propinas, contenido exclusivo y más."
      />

      <Section title="¿Qué son los tokens?">
        <p>
          Los tokens son la unidad interna de valor de UZEED. Se compran desde
          tu billetera con pesos chilenos y se gastan dentro de la plataforma
          en cualquier funcionalidad pagada. Son una forma segura y rápida de
          operar sin compartir tus datos de tarjeta cada vez que consumes un
          servicio.
        </p>
      </Section>

      <Section title="¿Cuánto vale un token?">
        <p>
          Por defecto, <strong>1 token = $1.000 CLP</strong>. El valor exacto
          siempre se muestra en la pantalla de recarga y puede variar si activas
          una promoción o compras paquetes grandes con descuento.
        </p>
        <Callout tone="info">
          Los precios de propinas, contenido y planes siempre se
          muestran en tokens, para que sepas de inmediato el costo final.
        </Callout>
      </Section>

      <Section title="Cómo conseguir tokens">
        <BulletList
          items={[
            "Recargando tu billetera con tarjeta de crédito o débito.",
            "Realizando una transferencia bancaria y subiendo el comprobante.",
            "Como creador: recibiendo propinas o vendiendo contenido exclusivo.",
            "Participando en promociones puntuales que regalan tokens.",
          ]}
        />
      </Section>

      <Section title="En qué puedes usar tus tokens">
        <BulletList
          items={[
            <><strong>U-Mate:</strong> suscribirte a creadores premium y acceder a contenido exclusivo.</>,
            <><strong>Chat:</strong> enviar mensajes premium o contenido pagado (cuando el profesional lo habilita).</>,
            <><strong>Visibilidad:</strong> impulsar tu perfil profesional para aparecer destacado en las búsquedas.</>,
          ]}
        />
      </Section>

      <Section title="¿Los tokens caducan?">
        <p>
          Los tokens no caducan mientras tu cuenta permanezca activa. Si tu
          cuenta es cerrada por incumplir las reglas de la comunidad, podrías
          perder el saldo disponible, por eso te recomendamos revisar los{" "}
          <a href="/terminos" className="text-fuchsia-400 underline hover:text-fuchsia-300">
            términos y condiciones
          </a>.
        </p>
      </Section>

      <Section title="¿Puedo transferir tokens a otro usuario?">
        <p>
          No de forma directa entre billeteras. Los tokens solo se transfieren
          al usar un servicio (propina, suscripción, contenido),
          lo cual asegura que cada movimiento quede trazado y seguro para ambas
          partes.
        </p>
      </Section>

      <Section title="Devoluciones">
        <p>
          Por ser una moneda virtual, los tokens no se devuelven una vez
          gastados en un servicio consumido. Si hubo un problema con el servicio
          (por ejemplo, un contenido que nunca llegó), puedes reportarlo y
          evaluaremos un reembolso caso a caso.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/marketplace", label: "Marketplace" },
          { href: "/ayuda/tiers", label: "Tiers y planes" },
        ]}
      />
    </PageBody>
  );
}
