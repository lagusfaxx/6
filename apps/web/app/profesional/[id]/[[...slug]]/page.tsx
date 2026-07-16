import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import {
  fetchProfileById,
  buildProfileMetadata,
  canonicalProfilePath,
} from "../../../../lib/profileServer";
import ProfileServerView from "../../../../components/ProfileServerView";
import ProfileDetailView from "../../_components/ProfileDetailView";

type Props = { params: Promise<{ id: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProfileById(id);
  if (!p) return { title: "Perfil no encontrado" };
  return buildProfileMetadata(p, canonicalProfilePath(p));
}

export default async function ProfessionalDetailPage({ params }: Props) {
  const { id, slug } = await params;
  const p = await fetchProfileById(id);

  if (p) {
    const canonical = canonicalProfilePath(p);
    // Si existe una URL limpia por username (/escort/{username}), redirige 301.
    // Si el username no es URL-safe, canonical cae a /profesional/{id}/{slug};
    // en ese caso solo redirige la UUID desnuda a la versión con slug (loop-safe:
    // no redirige si ya hay slug en la ruta).
    const isLegacyCanonical = canonical.startsWith("/profesional/");
    if (!isLegacyCanonical) {
      permanentRedirect(canonical);
    }
    if (isLegacyCanonical && canonical !== `/profesional/${id}` && (!slug || slug.length === 0)) {
      permanentRedirect(canonical);
    }
  }

  const canonicalUrl = p
    ? `https://uzeed.cl${canonicalProfilePath(p)}`
    : `https://uzeed.cl/profesional/${id}`;

  // Si la API no resuelve el perfil, renderiza igualmente el componente
  // interactivo por id (hace su propia carga y muestra su estado).
  if (!p) {
    return <ProfileDetailView id={id} />;
  }

  return <ProfileServerView profile={p} canonicalUrl={canonicalUrl} />;
}
