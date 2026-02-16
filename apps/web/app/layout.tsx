import type { Metadata, Viewport } from 'next';
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import AppShell from '../components/AppShell';
import SplashScreen from '../components/SplashScreen';

export const metadata: Metadata = {
  title: 'UZEED',
  description: 'UZEED',
  manifest: '/manifest.webmanifest',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen text-white antialiased">
        <SplashScreen />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
