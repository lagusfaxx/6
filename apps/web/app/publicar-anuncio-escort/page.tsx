import type { Metadata } from "next";
import EscortLandingPage, {
  buildEscortLandingMetadata,
} from "../../components/EscortLandingPage";
import { getEscortLanding } from "../../lib/escortLandings";

const landing = getEscortLanding("publicar-anuncio-escort")!;

export const metadata: Metadata = buildEscortLandingMetadata(landing);

export default function Page() {
  return <EscortLandingPage landing={landing} />;
}
