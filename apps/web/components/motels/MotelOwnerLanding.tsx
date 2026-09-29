import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  BedDouble,
  CalendarCheck,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  ToggleRight,
} from "lucide-react";
import MotelCard from "./MotelCard";
import { Faq, JsonLd, breadcrumbLd } from "./MotelSeo";
import { COMUNAS } from "../../lib/comunas";
import { countByComuna, fetchMotelDirectory } from "../../lib/motels";
import { MOTEL_OWNER_LANDINGS, type MotelOwnerLanding } from "../../lib/motelOwnerLandings";

const SITE = "https://uzeed.cl";
const OG = `${SITE}/brand/isotipo-new.png`;
const SIGNUP = "/register?type=ESTABLISHMENT";

export function buildMotelOwnerMetadata(l: MotelOwnerLanding): Metadata {
  return {
    title: l.title,
    description: l.metaDescription,
    keywords: l.keywords,
    alternates: { canonical: `/${l.slug}` },
    openGraph: {
      title: `${l.title} | UZEED`,
      description: l.metaDescription,
      url: `${SITE}/${l.slug}`,
      type: "website",
      locale: "es_CL",
      images: [{ url: OG, width: 720, height: 720, alt: "UZEED para moteles" }],
    },
    twitter: { card: "summary_large_image", title: `${l.title} | UZEED`, description: l.metaDescription, images: [OG] },
    robots: { index: true, follow: true },
  };
}

const FEATURES = [
  { Icon: Search, title: "Tu página en tu comuna", text: "Apareces en Moteles en tu comuna y en las cercanas, las páginas que la gente encuentra en Google." },
  { Icon: BedDouble, title: "Habitaciones con fotos y tarifas", text: "Cada habitación con sus fotos, comodidades y precio por 3 horas, 6 horas y noche." },
  { Icon: CalendarCheck, title: "Reservas por chat", text: "La solicitud te llega al panel y al chat; aceptas con un toque y el cliente recibe su código." },
  { Icon: BadgePercent, title: "Promociones", text: "Descuentos para las horas bajas que se ven como etiqueta en el directorio y se aplican solos." },
  { Icon: ToggleRight, title: "Abierto o cerrado", text: "Un interruptor para dejar de recibir reservas cuando estás lleno, sin despublicar la ficha." },
  { Icon: Star, title: "Reseñas reales", text: "Sólo pueden opinar quienes reservaron por UZEED: nada de reseñas falsas de la competencia." },
];

const STEPS = [
  { n: 1, title: "Crea tu cuenta", text: "Elige Motel / Hotel, con tu correo. Sin tarjeta." },
  { n: 2, title: "Arma tu ficha", text: "Fotos, comuna, dirección, comodidades y tus habitaciones con sus tarifas." },
  { n: 3, title: "Recibe reservas", text: "Cuando el equipo aprueba tu motel, apareces en el directorio y en tu comuna." },
];

/**
 * Landing para dueños de moteles. Todo se renderiza en el servidor e incluye
 * ejemplos reales del directorio (así Google y el dueño ven el producto).
 */
export default async function MotelOwnerLandingPage({ landing }: { landing: MotelOwnerLanding }) {
  const all = await fetchMotelDirectory();
  const counts = countByComuna(all);
  const comunasWithMotels = COMUNAS.filter((c) => !c.isMetro && (counts.get(c.slug) || 0) > 0).length;
  const examples = all.filter((m) => m.kind === "profile" && m.photos.length > 0).slice(0, 3);
  const related = MOTEL_OWNER_LANDINGS.filter((l) => l.slug !== landing.slug);
  const crumbs = [{ name: "Inicio", path: "/" }, { name: "Moteles", path: "/moteles" }, { name: landing.eyebrow }];

  return (
    <div className="-mx-4 -mt-4 px-4 pb-16 text-white">
      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl overflow-hidden pb-10 pt-8 sm:pt-14">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[12px] font-medium text-fuchsia-200">
            <BedDouble className="h-3.5 w-3.5" /> {landing.eyebrow}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{landing.h1}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65 sm:text-lg">{landing.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={SIGNUP} className="btn-primary px-6 py-3.5 text-[15px]">
              Publicar mi motel gratis <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/moteles" className="btn-secondary px-6 py-3.5 text-[15px]">Ver el directorio</Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/55">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Sin tarjeta</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Sin comisión por reserva</li>
            <li className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-emerald-400" /> Se maneja desde el celular</li>
          </ul>
        </div>
      </section>

      {/* ── Cifras reales del directorio ── */}
      {all.length > 0 && (
        <section className="mx-auto grid max-w-6xl grid-cols-3 gap-3">
          {[
            { value: all.length, label: all.length === 1 ? "motel en el directorio" : "moteles en el directorio" },
            { value: comunasWithMotels, label: comunasWithMotels === 1 ? "comuna con moteles" : "comunas con moteles" },
            { value: "$0", label: "de comisión por reserva" },
          ].map((s) => (
            <div key={s.label} className="editor-card p-4 text-center">
              <p className="text-2xl font-bold sm:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-[12px] text-white/45">{s.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── Qué incluye ── */}
      <section className="mx-auto mt-14 max-w-6xl">
        <h2 className="text-2xl font-bold">Todo lo que tu motel necesita para vender online</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="editor-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/30 to-violet-600/30">
                <f.Icon className="h-5 w-5 text-fuchsia-200" />
              </div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ejemplos reales ── */}
      {examples.length > 0 && (
        <section className="mx-auto mt-14 max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Así se ve tu motel en UZEED</h2>
              <p className="mt-1 text-sm text-white/50">Moteles que ya están en el directorio.</p>
            </div>
            <Link href="/moteles" className="text-sm text-fuchsia-300 hover:text-fuchsia-200">Ver todos los moteles →</Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {examples.map((m) => <MotelCard key={m.id} motel={m} />)}
          </div>
        </section>
      )}

      {/* ── Cómo empezar ── */}
      <section className="mx-auto mt-14 max-w-6xl">
        <h2 className="text-2xl font-bold">Empieza en 3 pasos</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="editor-card p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-sm font-bold">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-[13px] text-white/55">{s.text}</p>
            </li>
          ))}
        </ol>
        <Link href={SIGNUP} className="btn-primary mt-6 px-6 py-3.5 text-[15px]">
          Crear la ficha de mi motel <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </section>

      {/* ── Texto largo para la búsqueda ── */}
      <section className="mx-auto mt-14 max-w-3xl text-[15px] leading-relaxed text-white/60">
        <h2 className="text-2xl font-bold text-white">{landing.seoSection.heading}</h2>
        {landing.seoSection.paragraphs.map((p) => (
          <p key={p.slice(0, 40)} className="mt-4">{p}</p>
        ))}
      </section>

      <Faq items={landing.faq.map((f) => ({ q: f.question, a: f.answer }))} />

      {/* ── Comunas: enlaces a las páginas donde aparecería ── */}
      <section className="mx-auto mt-12 max-w-6xl">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-fuchsia-300" /> Tu motel aparece en la página de su comuna</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {COMUNAS.filter((c) => !c.isMetro).slice(0, 24).map((c) => (
            <Link key={c.slug} href={`/moteles/${c.slug}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/60 transition hover:text-white">
              Moteles en {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Cierre ── */}
      <section className="mx-auto mt-14 max-w-6xl">
        <div className="flex flex-col items-start gap-5 rounded-3xl border border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/10 to-transparent p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Publica tu motel hoy</h2>
            <p className="mt-1 max-w-xl text-sm text-white/60">Crear la ficha no tiene costo y no pedimos tarjeta. ¿Dudas? Escríbenos y te ayudamos a cargarla.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={SIGNUP} className="btn-primary px-6 py-3 text-sm">Publicar mi motel</Link>
            <Link href="/contacto" className="btn-secondary px-5 py-3 text-sm"><MessageCircle className="mr-2 h-4 w-4" /> Hablar con el equipo</Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <nav className="mx-auto mt-10 max-w-6xl text-sm text-white/50" aria-label="Más para dueños de moteles">
          <span className="mr-2">También te puede servir:</span>
          {related.map((r, i) => (
            <span key={r.slug}>
              {i > 0 && " · "}
              <Link href={`/${r.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">{r.eyebrow}</Link>
            </span>
          ))}
        </nav>
      )}

      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: landing.title,
          serviceType: "Directorio y reservas para moteles",
          description: landing.metaDescription,
          url: `${SITE}/${landing.slug}`,
          areaServed: { "@type": "Country", name: "Chile" },
          provider: { "@type": "Organization", name: "UZEED", url: SITE, logo: OG },
        }}
      />
    </div>
  );
}
