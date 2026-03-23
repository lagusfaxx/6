import type { Metadata, Viewport } from 'next';
import "./globals.css";
import AppShell from '../components/AppShell';
import SplashScreen from '../components/SplashScreen';

export const metadata: Metadata = {
  title: {
    default: 'UZEED: Escorts, Putas y Profesionales en Chile',
    template: '%s | UZEED',
  },
  description: 'Encuentra las mejores escorts, putas y profesionales en Santiago, Las Condes y Viña del Mar. Perfiles verificados, sexo incógnito y disponibilidad hoy en UZEED.',
  keywords: [
    'escorts chile', 'putas chile', 'escorts santiago', 'putas santiago',
    'escorts las condes', 'escorts providencia', 'escorts viña del mar',
    'acompañantes chile', 'servicios para adultos chile', 'escorts verificadas',
    'masajistas chile', 'moteles chile', 'sexshop chile',
    'escorts colombianas santiago', 'escorts venezolanas santiago',
  ],
  manifest: '/manifest.webmanifest',
  metadataBase: new URL('https://uzeed.cl'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://uzeed.cl',
    siteName: 'UZEED',
    title: 'UZEED: Escorts, Putas y Profesionales en Chile',
    description: 'Encuentra las mejores escorts, putas y profesionales en Santiago, Las Condes y Viña del Mar. Perfiles verificados, sexo incógnito y disponibilidad hoy.',
    images: [
      {
        url: '/brand/isotipo-new.png',
        width: 720,
        height: 720,
        alt: 'UZEED - Escorts y Profesionales en Chile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UZEED: Escorts, Putas y Profesionales en Chile',
    description: 'Encuentra las mejores escorts, putas y profesionales en Santiago, Las Condes y Viña del Mar. Perfiles verificados y disponibilidad hoy.',
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
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
      description: 'Escorts, putas y profesionales en Chile. Perfiles verificados con disponibilidad hoy.',
      inLanguage: 'es-CL',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://uzeed.cl/escorts?q={search_term_string}',
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
      sameAs: [],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen text-white antialiased">
        <SplashScreen />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
