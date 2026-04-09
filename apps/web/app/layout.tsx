import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import "./globals.css";
import AppShell from '../components/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'UZEED: Escorts y Putas Verificadas en Chile',
    template: '%s | UZEED',
  },
  description: 'Encuentra escorts, acompañantes y profesionales verificados en Santiago, Las Condes, Providencia y Viña del Mar. Fotos reales, contacto directo por WhatsApp y disponibilidad hoy en UZEED Chile.',
  keywords: [
    'escorts chile', 'acompañantes chile', 'escorts santiago', 'acompañantes santiago',
    'escorts las condes', 'escorts providencia', 'escorts viña del mar',
    'putas santiago', 'putas chile', 'servicios para adultos chile', 'escorts verificadas',
    'masajistas chile', 'moteles chile', 'sexshop chile',
    'escorts colombianas santiago', 'escorts venezolanas santiago',
    'escorts cerca de mi', 'acompañantes cerca de mi',
    'escorts disponibles hoy', 'putas verificadas',
  ],
  manifest: '/manifest.webmanifest',
  metadataBase: new URL('https://uzeed.cl'),
  alternates: {
    canonical: '/',
    languages: {
      'es-CL': 'https://uzeed.cl',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://uzeed.cl',
    siteName: 'UZEED',
    title: 'UZEED: Escorts, Acompañantes y Profesionales en Chile',
    description: 'Encuentra escorts, acompañantes y profesionales verificados en Santiago, Las Condes y Viña del Mar. Fotos reales, contacto directo y disponibilidad hoy.',
    images: [
      {
        url: '/brand/isotipo-new.png',
        width: 720,
        height: 720,
        alt: 'UZEED - Escorts y Profesionales Verificados en Chile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UZEED: Escorts y Acompañantes Verificadas en Chile',
    description: 'Encuentra escorts, acompañantes y profesionales verificados en Santiago y todo Chile. Fotos reales y disponibilidad hoy.',
    images: ['/brand/isotipo-new.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UZEED'
  },
  icons: {
    icon: [
      { url: '/brand/isotipo-new.png', sizes: '720x720', type: 'image/png' }
    ],
    apple: [{ url: '/brand/isotipo-new.png', sizes: '720x720', type: 'image/png' }]
  },
  other: {
    'google-site-verification': 'google73ed8440237def39',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#111827'
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://uzeed.cl/#website',
      url: 'https://uzeed.cl',
      name: 'UZEED',
      description: 'Directorio N°1 de escorts, acompañantes y profesionales verificados en Chile. Perfiles con fotos reales, contacto directo y disponibilidad hoy.',
      inLanguage: 'es-CL',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://uzeed.cl/escorts?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://uzeed.cl/#organization',
      name: 'UZEED',
      url: 'https://uzeed.cl',
      logo: {
        '@type': 'ImageObject',
        url: 'https://uzeed.cl/brand/isotipo-new.png',
        width: 720,
        height: 720,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: 'https://uzeed.cl/contacto',
        availableLanguage: 'Spanish',
      },
      sameAs: [],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Preconnect to third-party origins to reduce DNS+TLS latency */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://api.uzeed.cl" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.uzeed.cl" />
        <link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
        {/* Preload critical background image so browser fetches it early (LCP improvement) */}
        <link rel="preload" as="image" href="/brand/bg.webp" type="image/webp" fetchPriority="high" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen text-white antialiased">
        <AppShell>{children}</AppShell>
        {/* Google tag (gtag.js) — deferred with afterInteractive to avoid blocking FCP/LCP */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18052031619"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18052031619');`}
        </Script>
      </body>
    </html>
  );
}
