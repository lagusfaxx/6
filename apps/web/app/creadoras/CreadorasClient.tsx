"use client";

import Link from "next/link";
import Image from "next/image";

const benefits = [
  {
    title: "Seguridad",
    description:
      "Verificación de identidad, protección de tus datos y moderación activa contra perfiles falsos y mensajes abusivos.",
  },
  {
    title: "Control total",
    description:
      "Tú decides qué publicar, a quién aceptar y cuándo responder. Pausas, ocultas o eliminas tu perfil cuando quieras.",
  },
  {
    title: "Tarifa baja",
    description:
      "La comisión más baja del mercado chileno. Te quedas con la mayor parte de cada suscripción y propina.",
  },
  {
    title: "Feed completo",
    description:
      "Publicaciones, galerías, historias y mensajes directos. Todo el feed tipo red social integrado en tu perfil.",
  },
  {
    title: "Anuncios dentro de la plataforma",
    description:
      "Aparece en los espacios destacados del feed, del inicio y de las búsquedas, frente a usuarios que ya pagan por contenido.",
  },
  {
    title: "Campañas de marketing",
    description:
      "Participas en campañas recurrentes en redes y dentro de UZEED que traen tráfico nuevo a tu perfil cada semana.",
  },
  {
    title: "Contacto directo con clientes",
    description:
      "Los interesados te escriben por chat interno o WhatsApp desde tu perfil. Sin intermediarios, sin esperas.",
  },
  {
    title: "Perfil verificado y destacado",
    description:
      "La insignia Verificada multiplica tus visitas. Los perfiles verificados reciben hasta cinco veces más contactos.",
  },
];

const advantages = [
  {
    number: "01",
    title: "Registro simple",
    text: "Creas tu perfil en pocos minutos con tus fotos, tarifas y zona de trabajo. Sin papeleos innecesarios.",
  },
  {
    number: "02",
    title: "Panel de creadora",
    text: "Administras fotos, horarios, servicios y estadísticas desde un panel pensado para que puedas trabajar desde el celular.",
  },
  {
    number: "03",
    title: "Soporte humano",
    text: "Un equipo chileno te ayuda por WhatsApp cuando necesites apoyo con tu perfil, pagos o verificación.",
  },
];

const steps = [
  "Regístrate con tu correo y crea tu contraseña.",
  "Sube tus fotos, describe tus servicios y fija tus tarifas.",
  "Envía tu verificación y publica tu perfil para recibir contactos.",
];

export default function CreadorasClient() {
  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
        <div className="h-64 w-[32rem] rounded-full bg-fuchsia-500/[0.08] blur-3xl" />
      </div>

      {/* Logo */}
      <div className="mb-10 flex items-center justify-center">
        <Image
          src="/brand/logo.png"
          alt="UZEED"
          width={140}
          height={40}
          priority
          className="h-10 w-auto opacity-90"
        />
      </div>

      {/* Hero */}
      <section className="text-center">
        <span className="inline-block rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">
          Invitación para creadoras
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Trabaja con independencia en la plataforma líder de Chile
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
          UZEED es la plataforma chilena que reúne directorio de perfiles,
          feed de contenido y suscripciones en un solo lugar. Creas tu perfil,
          publicas tu contenido, decides tus precios y hablas directamente con
          tus clientes. Seguridad, control total y la tarifa más baja del
          mercado.
        </p>

        {/* Primary CTAs */}
        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(217,70,239,0.25)] transition-transform hover:scale-[1.02]"
          >
            Registrarse
          </Link>
          <Link
            href="/login"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            Ingresar
          </Link>
        </div>

        <div className="mt-3 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-white/50 transition-colors hover:text-fuchsia-300"
          >
            Ir a la app
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Pricing promo */}
      <section className="mt-12">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.03] to-fuchsia-500/[0.05] p-6 text-center sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative">
            <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Promoción de lanzamiento
            </span>

            <div className="mt-5 flex flex-wrap items-end justify-center gap-3">
              <span className="text-lg font-medium text-white/40 line-through sm:text-xl">
                $70.000 / mes
              </span>
              <span className="text-4xl font-extrabold tracking-tight text-emerald-300 sm:text-5xl">
                Gratis ahora
              </span>
            </div>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              Registra tu perfil hoy y accede a todas las funciones sin pagar
              nada. Sin letra chica, sin pruebas limitadas y sin cobros
              automáticos. Cuando empecemos a cobrar, tu tarifa quedará
              congelada.
            </p>

            <ul className="mx-auto mt-5 grid max-w-xl grid-cols-1 gap-2 text-left text-sm text-white/70 sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Todas las funciones activas
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Publicaciones y feed ilimitados
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Campañas y promoción incluidas
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Sin comisiones ocultas
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mt-8 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.03] py-5 text-center backdrop-blur">
        <div>
          <div className="text-lg font-bold text-white sm:text-2xl">+20</div>
          <div className="mt-0.5 text-[11px] text-white/50 sm:text-xs">Ciudades en Chile</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white sm:text-2xl">Gratis</div>
          <div className="mt-0.5 text-[11px] text-white/50 sm:text-xs">Membresía mensual</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white sm:text-2xl">24/7</div>
          <div className="mt-0.5 text-[11px] text-white/50 sm:text-xs">Tu perfil visible</div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-14">
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Beneficios al publicar en UZEED
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
            Hecho para que tengas más clientes reales y menos complicaciones.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((b) => (
            <article
              key={b.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-colors hover:border-fuchsia-500/20 hover:bg-white/[0.05]"
            >
              <h3 className="text-sm font-semibold text-white sm:text-base">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{b.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Advantages */}
      <section className="mt-14">
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ventajas frente a otras plataformas
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
            Una herramienta chilena, pensada para ti y sin letra chica.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {advantages.map((a) => (
            <article
              key={a.number}
              className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600/30 to-violet-600/30 text-xs font-bold text-fuchsia-200">
                {a.number}
              </div>
              <h3 className="text-sm font-semibold text-white sm:text-base">{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{a.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
        <header className="mb-5 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cómo empezar
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
            En tres pasos ya estarás recibiendo contactos.
          </p>
        </header>

        <ol className="mx-auto max-w-2xl space-y-3">
          {steps.map((s, i) => (
            <li
              key={s}
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-xs font-bold text-fuchsia-300">
                {i + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-white/70">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy note */}
      <section className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
        <h3 className="text-sm font-semibold text-white">Tu privacidad está protegida</h3>
        <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-relaxed text-white/55">
          No publicamos tu número, tu dirección ni datos personales sin tu
          autorización. Puedes pausar, ocultar o eliminar tu perfil en
          cualquier momento desde tu panel.
        </p>
      </section>

      {/* Final CTA */}
      <section className="mt-12 text-center">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Todo listo para tu perfil
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
          Únete hoy y empieza a recibir contactos en las próximas horas.
        </p>

        <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(217,70,239,0.25)] transition-transform hover:scale-[1.02]"
          >
            Registrarse
          </Link>
          <Link
            href="/login"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            Ingresar
          </Link>
        </div>

        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-white/50 transition-colors hover:text-fuchsia-300"
        >
          Ir a la app
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

      {/* Footer note */}
      <p className="mt-12 text-center text-[11px] text-white/35">
        Al registrarte aceptas los términos y condiciones de UZEED. Plataforma
        exclusiva para mayores de 18 años.
      </p>
    </div>
  );
}
