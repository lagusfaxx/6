"use client";

import { Crown, Diamond, Sparkles } from "lucide-react";
import {
  BulletList,
  Callout,
  PageBody,
  RelatedLinks,
  Section,
  TopicHeader,
} from "../_components";

type Tier = {
  key: "SILVER" | "GOLD" | "DIAMOND";
  name: string;
  icon: typeof Sparkles;
  color: string;
  subtitle: string;
  features: string[];
};

const TIERS: Tier[] = [
  {
    key: "SILVER",
    name: "Silver",
    icon: Sparkles,
    color: "from-slate-400/15 to-slate-600/5",
    subtitle: "Entrada al mundo premium",
    features: [
      "Sigue a 1 creadora premium al mismo tiempo.",
      "Acceso a fotos y videos exclusivos de tu creadora suscrita.",
      "Soporte estándar con respuesta en horario hábil.",
      "Renovación automática mensual que puedes cancelar cuando quieras.",
    ],
  },
  {
    key: "GOLD",
    name: "Gold",
    icon: Crown,
    color: "from-amber-400/20 to-amber-600/5",
    subtitle: "El plan más elegido",
    features: [
      "Sigue hasta 3 creadoras premium en simultáneo.",
      "Contenido exclusivo sin límites de sus perfiles.",
      "Soporte prioritario con atención más rápida.",
      "Insignia de fan Gold visible en comentarios y chats.",
      "Acceso a promociones especiales para suscriptores.",
    ],
  },
  {
    key: "DIAMOND",
    name: "Diamond",
    icon: Diamond,
    color: "from-violet-400/20 to-fuchsia-600/5",
    subtitle: "Máximo nivel, acceso total",
    features: [
      "Sigue hasta 5 creadoras premium en simultáneo.",
      "Acceso completo a todo el contenido de cada una.",
      "Beneficios VIP exclusivos solo para Diamond.",
      "Acceso anticipado a nuevas funciones y drops.",
      "Insignia destacada en toda la plataforma.",
      "Soporte VIP con atención directa.",
    ],
  },
];

export default function AyudaTiersPage() {
  return (
    <PageBody>
      <TopicHeader
        icon={Crown}
        title="Tiers y planes"
        subtitle="UZEED ofrece tres niveles de suscripción para acceder al contenido premium de las creadoras: Silver, Gold y Diamond."
      />

      <Section title="¿Qué son los tiers?">
        <p>
          Los tiers son planes de suscripción mensual que te dan acceso a
          contenido premium de las creadoras que elijas dentro de <strong>U-Mate</strong>,
          la sección exclusiva de UZEED. Cada nivel define cuántas creadoras
          puedes seguir en paralelo y qué beneficios extra recibes.
        </p>
      </Section>

      <Section title="Comparativa de planes">
        <div className="grid gap-3 md:grid-cols-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.key}
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tier.color} p-5`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/15">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{tier.name}</p>
                    <p className="text-[11px] text-white/50">{tier.subtitle}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-white/70">
                  {tier.features.map((f, idx) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-fuchsia-400/80" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Cómo elegir el plan correcto">
        <BulletList
          items={[
            <><strong>Silver</strong> es ideal si recién empiezas y quieres probar la experiencia premium con una sola creadora.</>,
            <><strong>Gold</strong> es la mejor relación beneficios/precio para quienes siguen a varias creadoras y quieren atención preferente.</>,
            <><strong>Diamond</strong> es para fans intensos que quieren acceso total, máximo número de creadoras y ventajas VIP.</>,
          ]}
        />
      </Section>

      <Section title="Cómo activar un plan">
        <p>
          Entra a la sección <strong>U-Mate &gt; Planes</strong> desde el menú,
          elige el tier que quieras y presiona “Activar plan”. Serás redirigido
          a una página de pago segura. Una vez confirmado el pago, el plan
          queda activo de inmediato y podrás empezar a suscribirte a las
          creadoras que prefieras.
        </p>
        <Callout tone="info">
          Solo puedes tener un plan activo a la vez. Si cambias de tier, el
          nuevo plan reemplaza al anterior y se ajusta proporcionalmente.
        </Callout>
      </Section>

      <Section title="Renovación y cancelación">
        <BulletList
          items={[
            "Todos los planes se renuevan automáticamente cada mes.",
            "Puedes cancelar la renovación en cualquier momento desde tu cuenta.",
            "Al cancelar, conservas los beneficios hasta que termine el período ya pagado.",
            "No hay reembolsos por períodos parciales ya consumidos.",
          ]}
        />
      </Section>

      <Section title="Tiers para creadoras">
        <p>
          Si eres creadora, los tiers también definen tu alcance: tus
          suscriptores Silver, Gold y Diamond verán tu contenido según el
          plan que tengan activo. Configurar bien tu contenido premium y tu
          portada ayuda a atraer suscriptores de todos los niveles.
        </p>
      </Section>

      <RelatedLinks
        links={[
          { href: "/ayuda/billetera", label: "Billetera" },
          { href: "/ayuda/tokens", label: "Tokens" },
          { href: "/ayuda/cuenta", label: "Cuenta y perfil" },
          { href: "/ayuda/servicios", label: "Servicios" },
        ]}
      />
    </PageBody>
  );
}
