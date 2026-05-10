import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pago | UZEED",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
