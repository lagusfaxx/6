"use client";

import Link from "next/link";
import {
  Wallet,
  Coins,
  Radio,
  Video,
  Crown,
  MessageCircle,
  MessageSquare,
  Sparkles,
  User,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

type Topic = {
  href: string;
  title: string;
  description: string;
  icon: typeof Wallet;
  accent: string;
};

const TOPICS: Topic[] = [
  {
    href: "/ayuda/billetera",
    title: "Billetera",
    description: "Recarga saldo, administra tus tokens y retira tus ganancias.",
    icon: Wallet,
    accent: "from-fuchsia-500/20 to-violet-500/10",
  },
  {
    href: "/ayuda/tokens",
    title: "Tokens",
    description: "Qué son, cuánto valen y cómo se usan dentro de UZEED.",
    icon: Coins,
    accent: "from-amber-500/20 to-orange-500/10",
  },
  {
    href: "/ayuda/live",
    title: "Transmisiones en vivo",
    description: "Mira y realiza streams, envía propinas y disfruta en tiempo real.",
    icon: Radio,
    accent: "from-rose-500/20 to-red-500/10",
  },
  {
    href: "/ayuda/videollamadas",
    title: "Videollamadas",
    description: "Agenda sesiones privadas 1 a 1 pagadas con tokens.",
    icon: Video,
    accent: "from-sky-500/20 to-indigo-500/10",
  },
  {
    href: "/ayuda/tiers",
    title: "Tiers y planes",
    description: "Descubre los planes Silver, Gold y Diamond y sus beneficios.",
    icon: Crown,
    accent: "from-yellow-500/20 to-amber-500/10",
  },
  {
    href: "/ayuda/chat",
    title: "Chat y mensajes",
    description: "Conversa con profesionales de forma directa y privada.",
    icon: MessageCircle,
    accent: "from-cyan-500/20 to-teal-500/10",
  },
  {
    href: "/ayuda/foro",
    title: "Foro",
    description: "Participa en la comunidad: publica, comenta y vota.",
    icon: MessageSquare,
    accent: "from-emerald-500/20 to-green-500/10",
  },
  {
    href: "/ayuda/servicios",
    title: "Servicios y directorio",
    description: "Escorts, masajistas, moteles, sex shops y más.",
    icon: Sparkles,
    accent: "from-pink-500/20 to-fuchsia-500/10",
  },
  {
    href: "/ayuda/cuenta",
    title: "Cuenta y perfil",
    description: "Registro, verificación, perfil y configuración.",
    icon: User,
    accent: "from-violet-500/20 to-purple-500/10",
  },
  {
    href: "/ayuda/seguridad",
    title: "Seguridad y privacidad",
    description: "Cómo protegemos tu información y cómo cuidarte.",
    icon: ShieldCheck,
    accent: "from-lime-500/20 to-green-500/10",
  },
];

export default function AyudaIndexPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Todo lo que necesitas saber sobre UZEED
        </h2>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          Bienvenido al Centro de Ayuda. Aquí encontrarás guías detalladas sobre cada
          función de la plataforma: billetera, tokens, transmisiones en vivo,
          videollamadas, planes premium, chat, foro y más. Elige un tema para empezar.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <Link
              key={topic.href}
              href={topic.href}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-fuchsia-500/30 hover:bg-white/[0.04]"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${topic.accent} opacity-0 transition-opacity group-hover:opacity-100`}
              />
              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-fuchsia-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{topic.title}</h3>
                    <ArrowRight className="h-3.5 w-3.5 translate-x-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-fuchsia-400" />
                  </div>
                  <p className="mt-1 text-xs text-white/55 leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-transparent p-5">
        <h3 className="text-base font-semibold text-white">¿No encuentras lo que buscas?</h3>
        <p className="mt-1 text-sm text-white/60">
          Si tu consulta no está en esta guía, contáctanos desde la{" "}
          <Link href="/contacto" className="text-fuchsia-400 underline hover:text-fuchsia-300">
            página de contacto
          </Link>{" "}
          y te responderemos lo antes posible.
        </p>
      </section>
    </div>
  );
}
