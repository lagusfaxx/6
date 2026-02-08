import type { Metadata } from 'next';
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import AppShell from '../components/AppShell';

export const metadata: Metadata = { title: 'UZEED', description: 'UZEED' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen text-white antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
