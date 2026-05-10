import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel | UZEED",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
