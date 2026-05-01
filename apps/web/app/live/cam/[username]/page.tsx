import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { fetchExternalCams } from "../../../../lib/chaturbate/api";
import { humanizeUsername } from "../../../../lib/chaturbate/transform";
import type { ExternalLiveCam } from "../../../../lib/chaturbate/types";
import { getGeoFromHeaders } from "../../../../lib/geo";
import LiveCamClient from "./LiveCamClient";

type RouteParams = { username: string };
type Props = { params: Promise<RouteParams> };

const VALID_USERNAME = /^[A-Za-z0-9_.-]{1,40}$/;

async function loadFeed(): Promise<{ cams: ExternalLiveCam[]; country: string | null }> {
  const h = await headers();
  const { ip, country } = getGeoFromHeaders(h);
  const { cams } = await fetchExternalCams({
    clientIp: ip ?? "request_ip",
    countryCode: country ?? "ZZ",
    gender: "f",
    region: "southamerica",
    hd: true,
    limit: 60,
  });
  return { cams, country };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const display = humanizeUsername(username);
  return {
    title: `${display} en vivo | UZEED`,
    description: `Mira a ${display} en vivo ahora mismo en UZEED. Videollamadas y cams en vivo, 24/7.`,
    alternates: { canonical: `/live/cam/${username}` },
    robots: { index: false, follow: false },
  };
}

export default async function LiveCamPage({ params }: Props) {
  const { username } = await params;
  if (!VALID_USERNAME.test(username)) {
    notFound();
  }

  const { cams } = await loadFeed();
  const target = cams.find((c) => c.username.toLowerCase() === username.toLowerCase()) ?? null;

  // Si la cam ya no está online, igual rendereamos un esqueleto humanizado
  // y le mostramos al usuario otras opciones — evita el "estado vacío".
  return <LiveCamClient initialCam={target} initialFeed={cams} username={username} />;
}
