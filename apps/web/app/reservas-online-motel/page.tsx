import type { Metadata } from "next";
import MotelOwnerLandingPage, { buildMotelOwnerMetadata } from "../../components/motels/MotelOwnerLanding";
import { getMotelOwnerLanding } from "../../lib/motelOwnerLandings";

export const revalidate = 600;

const landing = getMotelOwnerLanding("reservas-online-motel")!;

export const metadata: Metadata = buildMotelOwnerMetadata(landing);

export default function Page() {
  return <MotelOwnerLandingPage landing={landing} />;
}
