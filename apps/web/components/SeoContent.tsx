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
    heading: "Escorts y Putas en Chile — Perfiles Verificados",
    intro:
      "UZEED es el directorio N°1 de escorts y putas en Chile. Encuentra acompañantes verificadas en Santiago, Las Condes, Providencia, Viña del Mar, Concepción y todo el país. Todos los perfiles cuentan con fotos reales, verificación de identidad y contacto directo por WhatsApp.",
    sections: [
      {
        title: "Escorts en Santiago y Regiones",
        text: "Busca escorts disponibles hoy en Santiago Centro, Las Condes, Providencia, Ñuñoa, Maipú y más comunas. También encontrarás escorts en Viña del Mar, Valparaíso, Concepción, Antofagasta, Temuco y las principales ciudades de Chile. Filtra por ubicación, edad, servicios y disponibilidad inmediata.",
      },
      {
        title: "Putas Verificadas con Fotos Reales",
        text: "Todas las putas y escorts en UZEED pasan por un proceso de verificación. Publicamos solo fotos reales y perfiles auténticos para que encuentres exactamente lo que buscas: escorts colombianas, venezolanas, chilenas, rubias, morenas, tetonas, culonas y más.",
      },
      {
        title: "Servicios de Escorts y Acompañantes",
        text: "Encuentra escorts que ofrecen masajes eróticos, tríos, anal, videollamadas, BDSM, fetiches, sexo oral, nuru, tantra y más servicios para adultos. Cada perfil detalla los servicios disponibles, tarifas y horarios de atención.",
      },
    ],
    faq: [
      {
        question: "¿Cómo encontrar escorts cerca de mí en Chile?",
        answer: "En UZEED puedes activar tu ubicación para ver escorts cercanas ordenadas por distancia. También puedes filtrar por comuna o ciudad específica como Santiago, Las Condes, Providencia o Viña del Mar.",
      },
      {
        question: "¿Las escorts de UZEED son verificadas?",
        answer: "Sí, UZEED cuenta con un sistema de verificación de identidad. Los perfiles verificados muestran una insignia de verificación que garantiza que las fotos son reales y el perfil es auténtico.",
      },
      {
        question: "¿Cómo contactar a una escort en UZEED?",
        answer: "Cada perfil tiene un botón de contacto directo por WhatsApp. También puedes usar el chat interno de UZEED para comunicarte de forma privada con la escort antes de agendar.",
      },
      {
        question: "¿UZEED tiene escorts disponibles las 24 horas?",
        answer: "Sí, muchas escorts en UZEED ofrecen disponibilidad 24 horas. Puedes filtrar por 'disponible ahora' para ver solo las acompañantes que están atendiendo en este momento.",
      },
    ],
  },
  masajistas: {
    heading: "Masajistas Eróticas en Chile — Masajes Sensuales",
    intro:
      "Directorio de masajistas eróticas y sensuales en Chile. Encuentra masajistas profesionales con experiencia en masajes tántricos, nuru, relajantes y sensuales en Santiago, Las Condes, Providencia y todo Chile.",
    sections: [
      {
        title: "Masajes Eróticos en Santiago",
        text: "Las mejores masajistas eróticas de Santiago te esperan en UZEED. Masajes tántricos, nuru, cuerpo a cuerpo, relajantes y sensuales con profesionales verificadas en Las Condes, Providencia, Ñuñoa y más comunas.",
      },
    ],
    faq: [
      {
        question: "¿Dónde encontrar masajistas eróticas en Santiago?",
        answer: "En UZEED puedes encontrar masajistas eróticas verificadas en Santiago, Las Condes, Providencia y todas las comunas. Filtra por ubicación y tipo de masaje para encontrar la masajista ideal.",
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
        <h2 className="text-xl font-bold text-white/80 mb-3">{data.heading}</h2>
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
