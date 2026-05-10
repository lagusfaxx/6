import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Videollamada | UZEED",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function VideocallLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
