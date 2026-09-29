import type { Metadata } from "next";
import ForumFeed from "./_components/ForumFeed";

export const metadata: Metadata = {
  title: "Foro de la comunidad",
  description:
    "Pregunta, recomienda y opina con la comunidad UZEED: moteles, consejos, experiencias y opiniones de perfiles.",
  alternates: { canonical: "/foro" },
};

export default function ForumPage() {
  return <ForumFeed />;
}
