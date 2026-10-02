import type { Metadata } from "next";
import PlanesClient from "./PlanesClient";

export const metadata: Metadata = {
  title: "Membresía y boosts",
  description: "Membresía y boosts para destacar tu perfil profesional en UZEED. Los rangos Silver, Gold y Diamond salen de tu tarifa.",
};

export default function PlanesPage() {
  return <PlanesClient />;
}
