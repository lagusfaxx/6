"use client";

import { useParams } from "next/navigation";
import ProfileDetailView from "../../profesional/_components/ProfileDetailView";

export default function PerfilByUsernamePage() {
  const params = useParams();
  const username = String(params.username || "");
  return <ProfileDetailView username={username} />;
}
