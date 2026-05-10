import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cuenta | UZEED",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
