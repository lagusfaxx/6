import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favoritos | UZEED",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function FavoritosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
