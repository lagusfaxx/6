"use client";

import { Wallet } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  StepList,
  TopicHeader,
} from "../_components";

export default function AyudaBilleteraPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Wallet}
        title="Billetera"
        subtitle="Tu billetera virtual en UZEED: aquí compras tokens, pagas servicios digitales y retiras tus ganancias si eres creador o profesional."
      />

      <Section title="¿Qué es la billetera?">
        <p>
          La billetera es el monedero interno de UZEED. Cada cuenta tiene una
          billetera asociada donde se registra el saldo en <strong>tokens</strong>,
          la moneda virtual de la plataforma. Desde ella puedes recargar saldo,
          ver tu historial de movimientos y solicitar retiros.
        </p>
      </Section>

      <Section title="Cómo recargar tu billetera">
        <StepList
          steps={[
            {
              title: "Abre la sección Billetera",
              body: "La encuentras en el menú lateral (desktop) o en el menú hamburguesa (móvil), dentro de la sección Mi cuenta.",
            },
            {
              title: "Elige un paquete de tokens",
              body: "Puedes comprar paquetes predefinidos (5, 10, 25, 50, 100 o 200 tokens) o ingresar la cantidad que prefieras.",
            },
            {
              title: "Selecciona tu método de pago",
              body: "Aceptamos tarjetas de crédito y débito a través de Flow, y también transferencia bancaria con subida de comprobante.",
            },
            {
              title: "Confirma y listo",
              body: "Los tokens se acreditan automáticamente en tu billetera una vez aprobado el pago. Recibirás una notificación cuando el saldo esté disponible.",
            },
          ]}
        />
      </Section>

      <Section title="Cómo se calcula el valor de los tokens">
        <p>
          La equivalencia entre tokens y pesos chilenos se muestra directamente
          en tu billetera. Por defecto, <strong>1 token equivale a $1.000 CLP</strong>,
          pero puede ajustarse en promociones o descuentos por paquetes grandes.
          El valor vigente siempre aparece en pantalla antes de confirmar la
          recarga.
        </p>
      </Section>

      <Section title="En qué puedes gastar los tokens">
        <BulletList
          items={[
            "Videollamadas privadas con profesionales.",
            "Propinas durante transmisiones en vivo.",
            "Acceso a contenido exclusivo de creadoras en U-Mate.",
            "Regalos virtuales para demostrar apoyo a tus creadores favoritos.",
            "Funciones destacadas como impulsar visibilidad de tu perfil (para profesionales).",
          ]}
        />
      </Section>

      <Section title="Retiros (para creadores y profesionales)">
        <p>
          Si recibes tokens como propinas, videollamadas o ventas de contenido,
          puedes convertirlos nuevamente en dinero y retirarlos a tu cuenta
          bancaria.
        </p>
        <StepList
          steps={[
            {
              title: "Solicita un retiro",
              body: "Desde la billetera, presiona “Retirar” e indica cuántos tokens quieres convertir a CLP.",
            },
            {
              title: "Ingresa tus datos bancarios",
              body: "Banco, tipo de cuenta, número de cuenta, nombre completo y RUT del titular. Solo aceptamos retiros a cuentas propias.",
            },
            {
              title: "Revisión y transferencia",
              body: "Nuestro equipo revisa cada solicitud antes de aprobarla. Una vez aprobada, el dinero se transfiere a tu cuenta bancaria.",
            },
          ]}
        />
        <Callout tone="info">
          UZEED puede aplicar una comisión por procesamiento de retiros. El monto
          exacto se muestra en la ventana de confirmación antes de enviar la
          solicitud.
        </Callout>
      </Section>

      <Section title="Historial de movimientos">
        <p>
          En tu billetera verás un listado cronológico con todos los movimientos:
          recargas, compras, propinas enviadas y recibidas, videollamadas y
          retiros. Usa este historial para llevar un control claro de tus
          finanzas dentro de la plataforma.
        </p>
      </Section>

      <Section title="Problemas frecuentes">
        <BulletList
          items={[
            <><strong>Mi recarga no aparece:</strong> las recargas por transferencia pueden tardar mientras se verifica el comprobante. Si pasaron más de 24 horas, contáctanos.</>,
            <><strong>No puedo retirar:</strong> asegúrate de haber completado la verificación de tu cuenta y de que los datos bancarios coincidan con tu identidad.</>,
            <><strong>Me equivoqué con el monto:</strong> contacta a soporte antes de enviar el pago y te ayudaremos a corregirlo.</>,
          ]}
        />
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/tokens", label: "Cómo funcionan los tokens" },
          { href: "/ayuda/videollamadas", label: "Pagar una videollamada" },
          { href: "/ayuda/tiers", label: "Tiers y planes" },
          { href: "/ayuda/seguridad", label: "Seguridad" },
        ]}
      />
    </PageBody>
  );
}
