"use client";

import { ShoppingBag } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaMarketplacePage() {
  return (
    <PageBody>
      <TopicHeader
        icon={ShoppingBag}
        title="Marketplace"
        subtitle="Compra y vende packs de fotos, videos, ropa y artículos personales dentro de UZEED, con el pago protegido de punta a punta."
      />

      <Section title="¿Qué es el marketplace?">
        <p>
          Es la tienda interna de UZEED. Las profesionales publican sus propios
          artículos —packs de fotos, videos, ropa usada, fetiches o pedidos
          personalizados— y los clientes compran directamente desde la
          plataforma. Nada de transferencias a ciegas ni de coordinar la compra
          por fuera: el pedido, el pago y la entrega quedan registrados en UZEED.
        </p>
      </Section>

      <Section title="Cómo comprar">
        <StepList
          steps={[
            {
              title: "Elige tu artículo",
              body: "Desde Marketplace ves el catálogo completo, con fotos de vitrina, precio y las formas de entrega que acepta cada vendedora.",
            },
            {
              title: "Presiona comprar y elige la entrega",
              body: "Entrega digital (llega dentro de UZEED), entrega acordada con la vendedora, o envío a domicilio con la tarifa de tu región.",
            },
            {
              title: "Paga por la pasarela o por transferencia",
              body: "Con la pasarela la confirmación es automática. Si transfieres, subes el comprobante y lo validamos antes de avisar a la vendedora.",
            },
            {
              title: "Confirma cuando lo recibas",
              body: "Marca el pedido como recibido para liberar el pago. Si no lo haces, se libera automáticamente al cumplirse el plazo de retención.",
            },
          ]}
        />
      </Section>

      <Callout tone="info">
        <strong>Tu pago queda retenido.</strong> Cuando pagas, el dinero queda retenido por UZEED. Recién se le entrega a
        la vendedora cuando confirmas la recepción o cuando vence el plazo de
        retención configurado. Si algo sale mal, escríbenos antes de confirmar.
      </Callout>

      <Section title="¿Y si el pedido no llega?">
        <p>
          Desde tu compra puedes abrir un reclamo mientras el pago siga retenido. Al hacerlo el dinero deja de liberarse
          solo: queda congelado hasta que administración revise el caso y decida. Avisamos a la vendedora para que
          responda por el chat del pedido con lo que tenga —comprobante de envío, seguimiento o lo acordado— y resolvemos
          reembolsando a la clienta o liberando el pago a la vendedora.
        </p>
        <p>
          Un día antes de que venza el plazo de retención te avisamos, para que alcances a reclamar si el pedido nunca
          llegó. Si el pago ya se liberó, escríbenos igual y lo revisamos con la vendedora.
        </p>
      </Section>

      <Section title="Contenido digital protegido">
        <BulletList
          items={[
            "Las fotos y los videos que compras se ven dentro de UZEED: no hay botón de descarga ni enlace que se pueda compartir.",
            "Cada archivo se muestra con una marca de agua con tus datos, así que una copia siempre se puede rastrear.",
            "El visor se oculta cuando la ventana deja de estar activa, para dificultar las capturas de pantalla.",
            "Los enlaces del contenido caducan a los pocos minutos y se renuevan solos mientras lo estás viendo.",
          ]}
        />
      </Section>

      <Section title="Cómo vender (perfiles profesionales)">
        <StepList
          steps={[
            {
              title: "Abre tu tienda",
              body: "En Marketplace → Vender creas tu tienda con nombre, descripción y tus datos bancarios para recibir los pagos.",
            },
            {
              title: "Publica tus artículos",
              body: "Subes fotos de vitrina (públicas) y, aparte, el contenido real que recibirá quien compre. Ese contenido queda en almacenamiento privado.",
            },
            {
              title: "Activa la entrega automática",
              body: "Si vendes fotos o videos, el pedido se entrega solo apenas se confirma el pago. No tienes que estar conectada.",
            },
            {
              title: "Cobra tus ventas",
              body: "Cuando el pago se libera, queda disponible en tus ganancias. Pides el retiro y lo transferimos a tu cuenta.",
            },
          ]}
        />
      </Section>

      <Section title="Envíos y entregas">
        <BulletList
          items={[
            "Digital: el contenido llega al instante dentro del ecosistema, protegido contra descargas.",
            "Entrega acordada: coordinas día, hora y lugar con la otra parte desde el chat del pedido.",
            "Envío: el costo lo define la administración según la región de quien compra y se le paga íntegro a la vendedora.",
          ]}
        />
      </Section>

      <Section title="Comisiones">
        <p>
          UZEED cobra una comisión sobre el valor del artículo en cada venta
          concretada; el costo del envío se transfiere completo a la vendedora.
          El porcentaje vigente aparece en tu panel de ventas y en la ficha de
          cada pedido, antes de que aceptes nada.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/chat", label: "Chat y mensajes" },
          { href: "/ayuda/servicios", label: "Servicios y directorio" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
        ]}
      />
    </PageBody>
  );
}
