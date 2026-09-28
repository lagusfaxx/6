import Link from "next/link";
import type { ReactNode } from "react";
import { CITY_LANDINGS } from "../../lib/cities";
import type { EscortLanding } from "../../lib/escortLandings";

/*
 * Landing del lado oferta (/creadoras, /trabajar-de-escort, /vender-contenido,
 * /publicar-anuncio-escort). Sin estado ni hooks: se renderiza entero en el
 * servidor para que todo el texto (H1, bloque SEO, FAQ, enlaces internos)
 * llegue en el HTML inicial.
 */

export type RelatedLanding = { slug: string; eyebrow: string; h1: string };

export type PublicProfile = {
  id: string;
  displayName: string;
  city: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
};

type IconName =
  | "shield"
  | "sliders"
  | "percent"
  | "grid"
  | "megaphone"
  | "chart"
  | "chat"
  | "badge"
  | "lock"
  | "check"
  | "arrow"
  | "pin"
  | "phone"
  | "support";

const benefits: { title: string; description: string; icon: IconName }[] = [
  {
    title: "Seguridad",
    description: "Verificación de identidad y moderación activa contra perfiles falsos.",
    icon: "shield",
  },
  {
    title: "Control total",
    description: "Decides qué publicar, a quién responder y cuándo pausar tu perfil.",
    icon: "sliders",
  },
  {
    title: "Tarifa baja",
    description: "La comisión más baja del mercado chileno. Te quedas con casi todo.",
    icon: "percent",
  },
  {
    title: "Feed completo",
    description: "Publicaciones, historias, mensajes directos. Tu mini red social.",
    icon: "grid",
  },
  {
    title: "Anuncios en la plataforma",
    description: "Apareces en el inicio, feed y búsquedas frente a clientes que pagan.",
    icon: "megaphone",
  },
  {
    title: "Campañas de marketing",
    description: "Tráfico recurrente desde nuestras redes y campañas hacia tu perfil.",
    icon: "chart",
  },
  {
    title: "Contacto directo",
    description: "Chat interno o WhatsApp desde tu perfil. Sin intermediarios.",
    icon: "chat",
  },
  {
    title: "Perfil verificado",
    description: "La insignia Verificada multiplica hasta 5 veces tus contactos.",
    icon: "badge",
  },
];

const advantages: { title: string; text: string; icon: IconName }[] = [
  {
    title: "Registro simple",
    text: "Creas tu perfil en pocos minutos con tus fotos, tarifas y zona de trabajo. Sin papeleos innecesarios.",
    icon: "check",
  },
  {
    title: "Panel de creadora",
    text: "Administras fotos, horarios, servicios y estadísticas desde un panel pensado para que puedas trabajar desde el celular.",
    icon: "phone",
  },
  {
    title: "Soporte humano",
    text: "Un equipo chileno te ayuda por WhatsApp cuando necesites apoyo con tu perfil, pagos o verificación.",
    icon: "support",
  },
];

const steps = [
  { title: "Crea tu cuenta", text: "Regístrate con tu correo y crea tu contraseña." },
  { title: "Arma tu perfil", text: "Sube tus fotos, describe tus servicios y fija tus tarifas." },
  { title: "Publica", text: "Envía tu verificación y publica tu perfil para recibir contactos." },
];

const promoItems = [
  "Todas las funciones activas sin costo",
  "Publicaciones y feed ilimitados",
  "Campañas y promoción incluidas",
];

export default function CreadorasClient({
  profiles = [],
  landing,
  related = [],
}: {
  profiles?: PublicProfile[];
  /** Variante de landing: define eyebrow, H1, intro, bloque SEO y FAQ. */
  landing: EscortLanding;
  related?: RelatedLanding[];
}) {
  const heroProfiles = profiles.filter((p) => p.avatarUrl).slice(0, 3);
  const communityProfiles = profiles.slice(0, 12);

  return (
    <div className="relative w-full overflow-x-clip">
      {/* Fondo del hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" aria-hidden="true">
        <div className="absolute left-1/2 top-[-160px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-fuchsia-600/[0.13] blur-[120px]" />
        <div className="absolute right-[-120px] top-40 h-72 w-72 rounded-full bg-violet-500/[0.12] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="grid items-center gap-12 pb-12 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pb-20">
          <div>
            <nav aria-label="Ruta" className="mb-5 text-xs text-white/40">
              <Link href="/" className="transition-colors hover:text-white/70">
                Inicio
              </Link>
              <span className="mx-2">/</span>
              <span className="text-white/60">{landing.eyebrow}</span>
            </nav>

            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 py-1 pl-1.5 pr-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
              <span className="rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] tracking-wider text-white">
                Gratis
              </span>
              {landing.eyebrow}
            </span>

            <h1 className="mt-5 font-display text-[2.6rem] font-extrabold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
              {landing.h1}
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65 sm:text-base">
              {landing.intro}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta />
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
              >
                Ya tengo cuenta
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
              {["Sin tarjeta", "Verificación el mismo día", "Soporte por WhatsApp"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="h-3.5 w-3.5 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroVisual profiles={heroProfiles} />
        </section>

        {/* ── Cifras ───────────────────────────────────────── */}
        <section
          aria-label="UZEED en cifras"
          className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]"
        >
          {[
            { value: "+300", label: "Ciudades en Chile" },
            { value: "Gratis", label: "Membresía mensual" },
            { value: "24/7", label: "Tu perfil visible" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`px-3 py-6 text-center sm:py-8 ${i > 0 ? "border-l border-white/[0.06]" : ""}`}
            >
              <div className="font-display text-3xl font-bold text-white sm:text-5xl">{s.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/45 sm:text-xs">
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* ── Promoción ────────────────────────────────────── */}
        <section className="mt-6">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-[linear-gradient(120deg,rgba(16,185,129,0.12),rgba(255,255,255,0.02)_45%,rgba(217,70,239,0.08))] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
              <div>
                <span className="inline-block rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  Promoción de lanzamiento
                </span>
                <div className="mt-3 font-display text-6xl font-extrabold uppercase leading-none text-emerald-300 sm:text-7xl">
                  Gratis
                </div>
              </div>
              <div>
                <p className="max-w-xl text-sm leading-relaxed text-white/65">
                  Registra tu perfil hoy y accede a todas las funciones sin pagar
                  nada. Sin letra chica, sin pruebas limitadas y sin cobros
                  automáticos.
                </p>
                <ul className="mt-4 grid gap-2 text-sm text-white/75 sm:grid-cols-3">
                  {promoItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Beneficios ───────────────────────────────────── */}
        <section className="mt-24">
          <SectionHeader
            kicker="Beneficios"
            title="Beneficios al publicar en UZEED"
            text="Hecho para que tengas más clientes y menos complicaciones."
          />
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <article
                key={b.title}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-fuchsia-400/25 hover:bg-white/[0.045]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300">
                  <Icon name={b.icon} className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{b.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Cómo empezar ─────────────────────────────────── */}
        <section className="mt-24">
          <SectionHeader
            kicker="Paso a paso"
            title="Cómo empezar"
            text="En tres pasos ya estarás recibiendo contactos."
          />
          <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
            <div
              className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/40 to-fuchsia-500/0 md:block"
              aria-hidden="true"
            />
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="relative rounded-3xl border border-white/[0.07] bg-[#0b0b14]/80 p-6 text-center backdrop-blur"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 font-display text-2xl font-bold text-white shadow-[0_0_30px_rgba(217,70,239,0.35)]">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-center">
            <PrimaryCta />
          </div>
        </section>

        {/* ── Ventajas ─────────────────────────────────────── */}
        <section className="mt-24 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <SectionHeader
            align="left"
            kicker="Por qué UZEED"
            title="Ventajas frente a otras plataformas"
            text="Una herramienta chilena, pensada para ti y sin letra chica."
          />
          <div className="divide-y divide-white/[0.06] rounded-3xl border border-white/[0.07] bg-white/[0.02]">
            {advantages.map((a) => (
              <article key={a.title} className="flex gap-4 p-5 sm:p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-fuchsia-300">
                  <Icon name={a.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{a.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{a.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Comunidad ────────────────────────────────────── */}
        {communityProfiles.length > 0 && (
          <section className="mt-24">
            <SectionHeader
              kicker="Comunidad UZEED"
              title="Creadoras ya en la plataforma"
              text="Un vistazo a perfiles activos hoy. Todas verificadas por el equipo de UZEED."
            />
            <ul className="mt-10 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
              {communityProfiles.map((p, i) => (
                <li key={p.id} className={i >= 6 ? "hidden sm:block" : undefined}>
                  <ProfileTile profile={p} />
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center">
              <Link
                href="/escorts"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-white/70 transition-colors hover:border-fuchsia-400/30 hover:text-white"
              >
                Ver más perfiles en UZEED
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* ── Bloque SEO largo: texto indexable de la variante ── */}
        <section className="mt-24 grid gap-6 border-t border-white/[0.06] pt-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
              Guía
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase leading-[1.02] tracking-tight text-white sm:text-4xl lg:sticky lg:top-24">
              {landing.seoSection.heading}
            </h2>
          </div>
          <div className="space-y-5 text-[15px] leading-[1.75] text-white/65 sm:text-base">
            {landing.seoSection.paragraphs.map((text, i) => (
              <p key={i} className={i === 0 ? "text-white/80" : undefined}>
                {text}
              </p>
            ))}
          </div>
        </section>

        {/* ── FAQ: mismo contenido que el JSON-LD FAQPage ──── */}
        <section className="mt-24 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <SectionHeader
            align="left"
            kicker="FAQ"
            title="Preguntas frecuentes"
            text="Lo que más nos preguntan antes de publicar el primer perfil."
          />
          <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {landing.faq.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-[15px] font-semibold text-white/90 marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60 transition-transform group-open:rotate-45 group-open:border-fuchsia-400/40 group-open:text-fuchsia-300">
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="pb-5 pr-10 text-sm leading-relaxed text-white/60">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Enlaces internos: otras landings del lado oferta ── */}
        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
              También te puede interesar
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="group flex flex-col justify-between rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-fuchsia-400/25 hover:bg-white/[0.045]"
                >
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/80">
                      {r.eyebrow}
                    </span>
                    <p className="mt-2 text-sm font-medium leading-snug text-white/75 group-hover:text-white">
                      {r.h1}
                    </p>
                  </div>
                  <Icon
                    name="arrow"
                    className="mt-4 h-4 w-4 text-white/35 transition-transform group-hover:translate-x-1 group-hover:text-fuchsia-300"
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Enlaces internos por ciudad ───────────────────── */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
            Publica tu perfil en tu ciudad
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            UZEED recibe clientes en más de 300 ciudades y comunas de Chile. Mira
            los perfiles activos en tu zona antes de publicar el tuyo.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {CITY_LANDINGS.slice(0, 18).map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/escorts/${city.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs text-white/60 transition-colors hover:border-fuchsia-400/30 hover:text-white"
                >
                  <Icon name="pin" className="h-3 w-3 text-white/35" />
                  Escorts en {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── CTA final + privacidad ───────────────────────── */}
        <section className="relative mt-24 overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(ellipse_at_top,rgba(217,70,239,0.22),rgba(124,58,237,0.08)_45%,rgba(11,11,20,0.9)_75%)] px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
            Todo listo para tu perfil
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/65 sm:text-base">
            Únete hoy y empieza a recibir contactos en las próximas horas.
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <PrimaryCta />
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.05] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              Ingresar
            </Link>
          </div>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-white/50 transition-colors hover:text-fuchsia-300"
          >
            Ir a la app
            <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>

          <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4 text-left">
            <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-300" />
            <div>
              <h3 className="text-sm font-semibold text-white">Tu privacidad está protegida</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                No publicamos tu número, tu dirección ni datos personales sin tu
                autorización. Puedes pausar, ocultar o eliminar tu perfil en
                cualquier momento desde tu panel.
              </p>
            </div>
          </div>
        </section>

        <p className="mb-10 mt-8 text-center text-[11px] text-white/35">
          Al registrarte aceptas los términos y condiciones de UZEED. Plataforma
          exclusiva para mayores de 18 años.
        </p>
      </div>
    </div>
  );
}

function PrimaryCta() {
  return (
    <Link
      href="/empezar"
      className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_40px_-8px_rgba(217,70,239,0.55)] transition-transform hover:scale-[1.02]"
    >
      Crear mi perfil gratis
      <Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionHeader({
  kicker,
  title,
  text,
  align = "center",
}: {
  kicker: string;
  title: string;
  text: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <header className={centered ? "mx-auto max-w-2xl text-center" : "max-w-md"}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
        {kicker}
      </span>
      <h2 className="mt-3 font-display text-3xl font-bold uppercase leading-[1.02] tracking-tight text-white sm:text-5xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">{text}</p>
    </header>
  );
}

/**
 * Collage de perfiles reales en el hero. Sin fotos disponibles muestra una
 * maqueta de anuncio con los campos que la creadora va a completar.
 */
function HeroVisual({ profiles }: { profiles: PublicProfile[] }) {
  if (profiles.length < 3) {
    return (
      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute -inset-6 rounded-[2.5rem] bg-fuchsia-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative rounded-[2rem] border border-white/10 bg-[#0e0e18]/90 p-5 shadow-card-premium backdrop-blur">
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-fuchsia-600/40 via-violet-600/25 to-transparent" />
          <div className="mt-4 flex items-center justify-between">
            <span className="font-display text-2xl font-bold uppercase text-white">Tu anuncio</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200">
              <Icon name="badge" className="h-3.5 w-3.5" />
              Verificada
            </span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            {["Fotos y descripción", "Servicios y tarifas", "Zona y horarios", "Chat y WhatsApp"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Icon name="check" className="h-4 w-4 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const [a, b, c] = profiles;
  return (
    <div className="relative mx-auto h-[320px] w-full max-w-[420px] sm:h-[380px]">
      <div className="absolute inset-8 rounded-full bg-fuchsia-500/15 blur-3xl" aria-hidden="true" />
      <HeroCard profile={b} className="left-0 top-10 w-[46%] -rotate-6" />
      <HeroCard profile={c} className="right-0 top-14 w-[46%] rotate-6" />
      <HeroCard profile={a} className="left-1/2 top-0 z-10 w-[54%] -translate-x-1/2" priority />
      <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-[#0b0b14]/90 px-4 py-2 text-xs font-medium text-white/80 shadow-studio-card backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Perfiles activos hoy en UZEED
      </div>
    </div>
  );
}

function HeroCard({
  profile,
  className,
  priority = false,
}: {
  profile: PublicProfile;
  className: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/profesional/${profile.id}`}
      className={`absolute block aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-studio-card transition-transform duration-300 hover:scale-[1.03] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.avatarUrl!}
        alt={profile.displayName}
        loading={priority ? "eager" : "lazy"}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10">
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-1 font-display text-lg font-bold uppercase leading-none text-white">
            {profile.displayName}
          </span>
          {profile.isVerified && <VerifiedDot />}
        </div>
        {profile.city && <span className="mt-0.5 block text-[11px] text-white/60">{profile.city}</span>}
      </div>
    </Link>
  );
}

function ProfileTile({ profile }: { profile: PublicProfile }) {
  return (
    <Link
      href={`/profesional/${profile.id}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04]"
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={profile.displayName}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-white/30">
          {profile.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
        <div className="flex items-center gap-1">
          <span className="line-clamp-1 text-xs font-semibold text-white">{profile.displayName}</span>
          {profile.isVerified && <VerifiedDot />}
        </div>
        {profile.city && <span className="line-clamp-1 text-[10px] text-white/55">{profile.city}</span>}
      </div>
    </Link>
  );
}

function VerifiedDot() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fuchsia-500" title="Verificada">
      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 10l3.5 3.5L15 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const ICON_PATHS: Record<IconName, ReactNode> = {
  shield: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />,
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4" />,
  percent: <path d="M19 5L5 19M7 9a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  megaphone: <path d="M4 10v4h3l6 4V6L7 10H4zM17 9a4 4 0 010 6" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  chat: <path d="M4 5h16v11H9l-5 4V5z" />,
  badge: <path d="M12 2l2.4 2.2 3.2-.4.6 3.2 2.8 1.6-1.4 2.9 1.4 2.9-2.8 1.6-.6 3.2-3.2-.4L12 22l-2.4-2.2-3.2.4-.6-3.2-2.8-1.6 1.4-2.9-1.4-2.9 2.8-1.6.6-3.2 3.2.4L12 2zM8.5 12l2.3 2.3 4.7-4.6" />,
  lock: <path d="M6 11h12v9H6zM8 11V8a4 4 0 118 0v3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: <path d="M12 21s-6-5.6-6-11a6 6 0 1112 0c0 5.4-6 11-6 11zM12 12a2 2 0 100-4 2 2 0 000 4z" />,
  phone: <path d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2" />,
  support: <path d="M4 14v-2a8 8 0 0116 0v2M4 14a2 2 0 002 2h1v-5H6a2 2 0 00-2 2zM20 14a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2zM17 16v1a3 3 0 01-3 3h-2" />,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
