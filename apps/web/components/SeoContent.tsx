/**
 * Server-rendered SEO content blocks for directory pages.
 * These provide crawlable text for Google while the client-side
 * DirectoryPage handles the interactive listings.
 */

type SeoContentProps = {
  variant: "escorts" | "masajistas" | "moteles" | "hospedaje" | "establecimientos" | "profesionales" | "sexshop";
};

const SEO_DATA: Record<SeoContentProps["variant"], {
  heading: string;
  intro: string;
  sections: { title: string; text: string }[];
  faq: { question: string; answer: string }[];
}> = {
  escorts: {
    heading: "Escorts y Acompañantes en Chile",
    intro:
      "Directorio de escorts y acompañantes verificadas en Chile. Todos los perfiles cuentan con fotos reales, verificación de identidad y contacto directo. Disponible en Santiago, Viña del Mar, Concepción y más de 20 ciudades.",
    sections: [
      {
        title: "Cobertura en Santiago y Regiones",
        text: "Encuentra perfiles disponibles hoy en Santiago Centro, Las Condes, Providencia y más comunas de la Región Metropolitana. También tenemos cobertura en Viña del Mar, Valparaíso, Concepción, Antofagasta y Temuco. Filtra por ubicación, servicios y disponibilidad.",
      },
      {
        title: "Perfiles verificados",
        text: "Cada profesional en UZEED pasa por un proceso de verificación. Solo publicamos fotos reales y perfiles auténticos. Busca por características, nacionalidad o tipo de servicio.",
      },
    ],
    faq: [
      {
        question: "¿Cómo encuentro acompañantes cerca de mí?",
        answer: "Activa tu ubicación para ver perfiles cercanos ordenados por distancia, o filtra por ciudad o comuna.",
      },
      {
        question: "¿Los perfiles son verificados?",
        answer: "Sí, UZEED verifica la identidad de cada profesional. Los perfiles verificados muestran una insignia que garantiza fotos reales.",
      },
      {
        question: "¿Cómo contacto a una profesional?",
        answer: "Cada perfil tiene contacto directo por WhatsApp y chat interno para comunicarte de forma privada antes de agendar.",
      },
    ],
  },
  masajistas: {
    heading: "Masajistas en Chile",
    intro:
      "Directorio de masajistas profesionales en Chile. Encuentra especialistas en masajes tántricos, nuru, relajantes y sensuales con perfiles verificados en Santiago y todo el país.",
    sections: [
      {
        title: "Masajes en Santiago",
        text: "Masajistas verificadas en Las Condes, Providencia, Ñuñoa y más comunas. Filtra por ubicación y tipo de masaje.",
      },
    ],
    faq: [
      {
        question: "¿Dónde encuentro masajistas en Santiago?",
        answer: "En UZEED puedes filtrar masajistas verificadas por comuna y tipo de masaje para encontrar la profesional ideal.",
      },
    ],
  },
  moteles: {
    heading: "Moteles en Chile — Reserva y Precios",
    intro:
      "Encuentra los mejores moteles en Santiago, Viña del Mar y todo Chile. Compara precios, servicios, fotos reales y disponibilidad. Moteles discretos y con estacionamiento para tu comodidad.",
    sections: [],
    faq: [
      {
        question: "¿Cuáles son los mejores moteles en Santiago?",
        answer: "En UZEED encontrarás un directorio completo de moteles en Santiago con fotos reales, precios actualizados y reseñas de usuarios. Filtra por ubicación, precio y servicios.",
      },
    ],
  },
  hospedaje: {
    heading: "Hospedajes y Alojamiento para Adultos en Chile",
    intro:
      "Directorio de hospedajes y alojamientos discretos en Chile. Encuentra lugares con privacidad, estacionamiento y servicios especiales en Santiago y regiones.",
    sections: [],
    faq: [],
  },
  establecimientos: {
    heading: "Establecimientos para Adultos en Chile",
    intro:
      "Encuentra establecimientos para adultos verificados en Chile. Night clubs, saunas, spas eróticos y más con fotos reales, horarios y ubicación exacta.",
    sections: [],
    faq: [],
  },
  profesionales: {
    heading: "Profesionales y Acompañantes en Chile",
    intro:
      "Directorio completo de profesionales y acompañantes en Chile. Perfiles verificados con fotos reales, servicios detallados y contacto directo.",
    sections: [],
    faq: [],
  },
  sexshop: {
    heading: "Sex Shop Online en Chile — Productos para Adultos",
    intro:
      "Tienda de productos para adultos en Chile. Encuentra juguetes, lencería, accesorios y más con envío discreto a todo el país.",
    sections: [],
    faq: [],
  },
};

export default function SeoContent({ variant }: SeoContentProps) {
  const data = SEO_DATA[variant];
  if (!data) return null;

  const faqJsonLd = data.faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
      { "@type": "ListItem", position: 2, name: data.heading.split("—")[0].trim() },
    ],
  };

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Visually hidden but crawlable SEO text at bottom of page */}
      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        <h1 className="text-xl font-bold text-white/80 mb-3">{data.heading}</h1>
        <p className="mb-4">{data.intro}</p>
        {data.sections.map((s, i) => (
          <div key={i} className="mb-4">
            <h3 className="text-base font-semibold text-white/70 mb-1">{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
        {data.faq.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas Frecuentes</h3>
            {data.faq.map((f, i) => (
              <details key={i} className="mb-3 group">
                <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300 transition-colors">
                  {f.question}
                </summary>
                <p className="mt-1 pl-4 text-white/50">{f.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
