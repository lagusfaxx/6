"use client";

import { useParams } from "next/navigation";
import ProfileDetailView from "../_components/ProfileDetailView";

export default function ProfessionalDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  return <ProfileDetailView id={id} />;
}
