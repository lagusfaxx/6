"use client";

import Link from "next/link";
import Image from "next/image";

export type PublicProfile = {
  id: string;
  displayName: string;
  city: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
};

const benefits = [
  {
    title: "Seguridad",
    description: "Verificación de identidad y moderación activa contra perfiles falsos.",
  },
  {
    title: "Control total",
    description: "Decides qué publicar, a quién responder y cuándo pausar tu perfil.",
  },
  {
    title: "Tarifa baja",
    description: "La comisión más baja del mercado chileno. Te quedas con casi todo.",
  },
  {
    title: "Feed completo",
    description: "Publicaciones, historias, mensajes directos. Tu mini red social.",
  },
  {
    title: "Anuncios en la plataforma",
    description: "Apareces en el inicio, feed y búsquedas frente a clientes que pagan.",
  },
  {
    title: "Campañas de marketing",
    description: "Tráfico recurrente desde nuestras redes y campañas hacia tu perfil.",
  },
  {
    title: "Contacto directo",
    description: "Chat interno o WhatsApp desde tu perfil. Sin intermediarios.",
  },
  {
    title: "Perfil verificado",
    description: "La insignia Verificada multiplica hasta 5 veces tus contactos.",
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

export default function CreadorasClient({ profiles = [] }: { profiles?: PublicProfile[] }) {
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
          width={320}
          height={90}
          priority
          className="h-20 w-auto sm:h-24"
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
            href="/empezar"
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
                Gratis
              </span>
            </div>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              Registra tu perfil hoy y accede a todas las funciones sin pagar
              nada. Sin letra chica, sin pruebas limitadas y sin cobros
              automáticos. Las creadoras que se sumen ahora quedan como
              fundadoras y conservan beneficios preferentes.
            </p>

            <ul className="mx-auto mt-5 grid max-w-xl grid-cols-1 gap-2 text-left text-sm text-white/70 sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Todas las funciones activas sin costo
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
                Beneficios de creadora fundadora
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mt-8 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.03] py-5 text-center backdrop-blur">
        <div>
          <div className="text-lg font-bold text-white sm:text-2xl">+300</div>
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

      {/* Benefits — carrusel horizontal */}
      <section className="mt-14">
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Beneficios al publicar en UZEED
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
            Hecho para que tengas más clientes y menos complicaciones.
          </p>
        </header>

        <div
          className="group relative -mx-4 overflow-hidden sm:-mx-6"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          <div className="flex w-max gap-3 animate-marquee-left py-1 [animation-duration:55s] group-hover:[animation-play-state:paused]">
            {[...benefits, ...benefits].map((b, i) => (
              <article
                key={`${b.title}-${i}`}
                className="flex w-[260px] shrink-0 flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors hover:border-fuchsia-500/25 hover:bg-white/[0.05] sm:w-[280px]"
              >
                <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/55 sm:text-sm">
                  {b.description}
                </p>
              </article>
            ))}
          </div>
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

      {/* Community — marquee de creadoras ya registradas */}
      {profiles.length > 0 && (
        <section className="mt-14">
          <header className="mb-6 text-center">
            <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Comunidad UZEED
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Creadoras ya en la plataforma
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/55">
              Un vistazo a perfiles activos hoy. Todas verificadas por el equipo
              de UZEED.
            </p>
          </header>

          <div
            className="relative -mx-4 overflow-hidden sm:-mx-6"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            {/* Row 1 */}
            <div className="flex w-max animate-marquee-left gap-4 py-3">
              {[...profiles, ...profiles].map((p, i) => (
                <ProfileChip key={`r1-${p.id}-${i}`} profile={p} />
              ))}
            </div>
            {/* Row 2 — sentido contrario */}
            <div className="mt-2 flex w-max animate-marquee-right gap-4 py-3">
              {[...profiles.slice().reverse(), ...profiles.slice().reverse()].map((p, i) => (
                <ProfileChip key={`r2-${p.id}-${i}`} profile={p} />
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/escorts"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-white/70 transition-colors hover:border-fuchsia-500/30 hover:text-white"
            >
              Ver más perfiles en UZEED
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>
      )}

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
            href="/empezar"
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

function ProfileChip({ profile }: { profile: PublicProfile }) {
  return (
    <Link
      href={`/profesional/${profile.id}`}
      className="group flex shrink-0 items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 pr-5 backdrop-blur-sm transition-all duration-200 hover:border-fuchsia-500/25 hover:bg-white/[0.06]"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/40">
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        {profile.isVerified && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#08080d] bg-fuchsia-500">
            <svg className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 10l3.5 3.5L15 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="line-clamp-1 text-xs font-semibold text-white/85">
          {profile.displayName}
        </span>
        {profile.city && (
          <span className="line-clamp-1 text-[10px] text-white/40">
            {profile.city}
          </span>
        )}
      </div>
    </Link>
  );
}
