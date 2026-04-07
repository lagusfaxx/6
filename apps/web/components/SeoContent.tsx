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
    heading: "Escorts y Acompañantes en Chile — Perfiles Verificados",
    intro:
      "UZEED es el directorio de escorts y acompañantes verificadas en Chile. Cada perfil cuenta con fotos reales, verificación de identidad y contacto directo por WhatsApp. Explora perfiles disponibles hoy en Santiago, Viña del Mar, Concepción y más de 20 ciudades del país.",
    sections: [
      {
        title: "Escorts en Santiago y Regiones",
        text: "Encuentra escorts y acompañantes disponibles hoy en Santiago Centro, Las Condes, Providencia y la Región Metropolitana. También hay perfiles activos en Viña del Mar, Valparaíso, Concepción, Antofagasta y Temuco. Usa los filtros de ubicación, servicios y disponibilidad para encontrar lo que buscas.",
      },
      {
        title: "Perfiles verificados con fotos reales",
        text: "Todas las escorts y acompañantes en UZEED pasan por un proceso de verificación de identidad. Solo publicamos perfiles auténticos con fotos reales. Puedes buscar por nacionalidad (colombianas, venezolanas, chilenas), características físicas o tipo de servicio.",
      },
      {
        title: "Servicios disponibles",
        text: "Cada perfil detalla los servicios que ofrece, tarifas y horarios de atención. Encuentra escorts que ofrecen masajes eróticos, videollamadas, atención a domicilio y más. Contacta directamente por WhatsApp o por el chat interno de UZEED.",
      },
    ],
    faq: [
      {
        question: "¿Cómo encuentro escorts cerca de mí?",
        answer: "Activa tu ubicación en UZEED para ver perfiles cercanos ordenados por distancia. También puedes filtrar por ciudad o comuna específica.",
      },
      {
        question: "¿Las escorts de UZEED son verificadas?",
        answer: "Sí, UZEED verifica la identidad de cada profesional. Los perfiles verificados muestran una insignia que garantiza fotos reales y perfil auténtico.",
      },
      {
        question: "¿Cómo contacto a una escort?",
        answer: "Cada perfil tiene un botón de contacto directo por WhatsApp. También puedes usar el chat interno de UZEED para comunicarte de forma privada.",
      },
      {
        question: "¿Hay escorts disponibles ahora?",
        answer: "Sí, muchas escorts ofrecen disponibilidad 24/7. Filtra por \"disponible ahora\" para ver solo las que atienden en este momento.",
      },
    ],
  },
  masajistas: {
    heading: "Masajistas Eróticas en Chile — Masajes Sensuales",
    intro:
      "Directorio de masajistas eróticas y sensuales en Chile. Encuentra profesionales verificadas con experiencia en masajes tántricos, nuru, relajantes y cuerpo a cuerpo en Santiago y todo el país.",
    sections: [
      {
        title: "Masajes eróticos en Santiago",
        text: "Masajistas verificadas en Las Condes, Providencia, Ñuñoa y más comunas de Santiago. Filtra por ubicación, tipo de masaje y disponibilidad inmediata.",
      },
    ],
    faq: [
      {
        question: "¿Dónde encuentro masajistas eróticas en Santiago?",
        answer: "En UZEED puedes filtrar masajistas verificadas por comuna y tipo de masaje. Hay profesionales disponibles en Las Condes, Providencia y toda la Región Metropolitana.",
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
    sections: [
      {
        title: "Hospedajes discretos en Santiago",
        text: "Encuentra cabañas, apart-hotel y alojamientos por hora en Las Condes, Providencia, Santiago Centro y la Región Metropolitana. Cada hospedaje cuenta con fotos reales, precios actualizados y disponibilidad verificada.",
      },
      {
        title: "Alojamientos en regiones",
        text: "También hay opciones en Viña del Mar, Valparaíso, Concepción y otras ciudades. Filtra por ubicación, precio, estacionamiento y servicios incluidos para encontrar el lugar ideal.",
      },
    ],
    faq: [
      {
        question: "¿Cómo encuentro hospedajes discretos cerca de mí?",
        answer: "Activa tu ubicación en UZEED para ver hospedajes cercanos. También puedes buscar por ciudad o comuna y filtrar por precio y servicios disponibles.",
      },
      {
        question: "¿Los hospedajes tienen disponibilidad inmediata?",
        answer: "Muchos hospedajes en UZEED ofrecen disponibilidad por hora o inmediata. Revisa los horarios y tarifas en cada perfil antes de contactar.",
      },
    ],
  },
  establecimientos: {
    heading: "Establecimientos para Adultos en Chile",
    intro:
      "Encuentra establecimientos para adultos verificados en Chile. Night clubs, saunas, spas eróticos y más con fotos reales, horarios y ubicación exacta.",
    sections: [
      {
        title: "Night clubs y locales nocturnos en Santiago",
        text: "Directorio de night clubs, cabarets y locales nocturnos en Santiago Centro, Las Condes, Providencia y más comunas. Información de horarios, precios de entrada, fotos del lugar y reseñas de usuarios.",
      },
      {
        title: "Saunas y spas eróticos",
        text: "Encuentra saunas, spas eróticos y centros de masajes en Santiago y regiones. Cada establecimiento incluye servicios disponibles, tarifas y ubicación exacta con mapa.",
      },
    ],
    faq: [
      {
        question: "¿Cómo encuentro establecimientos para adultos cerca de mí?",
        answer: "Usa el filtro de ubicación en UZEED para ver establecimientos cercanos. Puedes buscar por tipo (night club, sauna, spa) y por ciudad o comuna.",
      },
      {
        question: "¿Los establecimientos en UZEED son verificados?",
        answer: "Sí, verificamos la existencia y datos de cada establecimiento. Los perfiles incluyen fotos reales, horarios actualizados y dirección exacta.",
      },
    ],
  },
  profesionales: {
    heading: "Profesionales y Acompañantes en Chile",
    intro:
      "Directorio completo de profesionales y acompañantes en Chile. Perfiles verificados con fotos reales, servicios detallados y contacto directo.",
    sections: [
      {
        title: "Acompañantes verificadas en Santiago",
        text: "Encuentra acompañantes y profesionales disponibles hoy en Santiago Centro, Las Condes, Providencia, Ñuñoa y toda la Región Metropolitana. Cada perfil está verificado con fotos reales y contacto directo por WhatsApp.",
      },
      {
        title: "Profesionales en todo Chile",
        text: "Además de Santiago, hay profesionales activas en Viña del Mar, Valparaíso, Concepción, Antofagasta, Temuco y más de 20 ciudades. Filtra por ubicación, tipo de servicio y disponibilidad inmediata.",
      },
    ],
    faq: [
      {
        question: "¿Cómo sé si un perfil es real?",
        answer: "Los perfiles verificados muestran una insignia de verificación. UZEED valida la identidad de cada profesional para garantizar fotos reales y perfil auténtico.",
      },
      {
        question: "¿Puedo contactar directamente a las profesionales?",
        answer: "Sí, cada perfil tiene un botón de WhatsApp para contacto directo. También puedes usar el chat interno de UZEED para comunicarte de forma privada.",
      },
    ],
  },
  sexshop: {
    heading: "Sex Shop Online en Chile — Productos para Adultos",
    intro:
      "Tienda de productos para adultos en Chile. Encuentra juguetes, lencería, accesorios y más con envío discreto a todo el país.",
    sections: [
      {
        title: "Juguetes sexuales y accesorios",
        text: "Explora un amplio catálogo de juguetes sexuales, vibradores, dildos, anillos y accesorios para parejas. Productos de marcas reconocidas con envío discreto a todo Chile.",
      },
      {
        title: "Lencería y disfraces",
        text: "Encuentra lencería sexy, disfraces eróticos, medias, bodys y más. Todas las tallas disponibles con fotos reales del producto y precios actualizados.",
      },
    ],
    faq: [
      {
        question: "¿El envío es discreto?",
        answer: "Sí, todos los envíos son en empaque discreto sin logos ni referencias al contenido. Se envía a todo Chile con seguimiento.",
      },
      {
        question: "¿Qué productos puedo encontrar en el sex shop?",
        answer: "Juguetes sexuales, vibradores, lencería, lubricantes, preservativos, accesorios BDSM, disfraces y productos para el cuidado íntimo.",
      },
    ],
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
