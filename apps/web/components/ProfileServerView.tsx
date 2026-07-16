import ProfileDetailView from "../app/profesional/_components/ProfileDetailView";
import type { ProfileRecord } from "../lib/profileServer";

/**
 * Vista server-side de un perfil, compartida por las rutas limpias
 * (/escort/{username}, /masajista/{username}). Renderiza el componente
 * interactivo (por id, sin cambios) + JSON-LD + contenido SEO para el crawler.
 */
export default function ProfileServerView({
  profile,
  canonicalUrl,
}: {
  profile: ProfileRecord;
  canonicalUrl: string;
}) {
  const name = profile.name || "Profesional";
  const city = profile.city || "Chile";
  const category = (profile.serviceCategory || "Escort").trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: name || undefined,
    jobTitle: category,
    address: { "@type": "PostalAddress", addressLocality: city, addressCountry: "CL" },
    ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    ...(profile.bio ? { description: profile.bio.slice(0, 300) } : {}),
    url: canonicalUrl,
  };

  return (
    <>
      {/* Componente interactivo (se resuelve por id internamente) */}
      <ProfileDetailView id={profile.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Contenido SEO server-side (visible para Google, oculto visualmente) */}
      <section className="sr-only">
        <h1>
          {name} — {category} en {city}
        </h1>
        {profile.bio && <p>{profile.bio}</p>}
        {profile.serviceDescription && <p>{profile.serviceDescription}</p>}
        {profile.heightCm && <p>Altura: {profile.heightCm} cm</p>}
        {profile.hairColor && <p>Cabello: {profile.hairColor}</p>}
        {profile.serviceTags.length > 0 && (
          <p>Servicios: {profile.serviceTags.join(", ")}</p>
        )}
      </section>
    </>
  );
}
