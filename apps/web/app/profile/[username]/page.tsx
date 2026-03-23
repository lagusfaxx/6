import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  return {
    title: `${displayName} - Escort en Chile`,
    description: `Perfil verificado de ${displayName}. Fotos reales, servicios y contacto directo en UZEED.`,
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      title: `${displayName} - Escort en Chile | UZEED`,
      description: `Perfil verificado de ${displayName}. Fotos reales, servicios y contacto directo.`,
      url: `https://uzeed.cl/profile/${username}`,
      type: "profile",
    },
    robots: { index: true, follow: true },
  };
}

export default function ProfileByUsernamePage() {
  return <ProfileClient />;
}
