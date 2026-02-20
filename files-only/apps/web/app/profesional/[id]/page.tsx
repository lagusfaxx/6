"use client";

import { useParams } from "next/navigation";
import ProfileDetailView from "../_components/ProfileDetailView";
import BackButton from "../../../components/BackButton";

export default function ProfessionalDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  return (
    <>
      <BackButton />
      <ProfileDetailView id={id} />
    </>
  );
}
