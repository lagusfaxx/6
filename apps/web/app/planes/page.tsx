import type { Metadata } from "next";
import PlanesClient from "./PlanesClient";

export const metadata: Metadata = {
  title: "Planes y boosts",
  description: "Planes Silver, Gold y Diamond y boosts para destacar tu perfil profesional en UZEED.",
};

export default function PlanesPage() {
  return <PlanesClient />;
}
