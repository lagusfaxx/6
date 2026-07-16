import type { Metadata } from "next";
import { permanentRedirect, notFound } from "next/navigation";
import {
  fetchProfileByUsername,
  buildProfileMetadata,
  canonicalProfilePath,
} from "../lib/profileServer";
import type { ProfileCategoryWord } from "../lib/profileUrl";
import ProfileServerView from "./ProfileServerView";

/**
 * Lógica compartida por las rutas limpias de perfil por username
 * (/escort/[username], /masajista/[username]). Resuelve por username y
 * canonicaliza: si la categoría real del perfil corresponde a otra palabra
 * (ej: visitan /escort/sara pero Sara es masajista), redirige 301 a la URL
 * correcta. Loop-safe porque la canónica es determinista.
 */

export async function profileUsernameMetadata(username: string): Promise<Metadata> {
  const p = await fetchProfileByUsername(username);
  if (!p) return { title: "Perfil no encontrado" };
  return buildProfileMetadata(p, canonicalProfilePath(p));
}

export default async function ProfileUsernamePage({
  word,
  username,
}: {
  word: ProfileCategoryWord;
  username: string;
}) {
  const p = await fetchProfileByUsername(username);
  if (!p) notFound();

  const canonical = canonicalProfilePath(p);
  const currentPath = `/${word}/${username}`;
  if (canonical !== currentPath) {
    permanentRedirect(canonical);
  }

  return <ProfileServerView profile={p} canonicalUrl={`https://uzeed.cl${canonical}`} />;
}
