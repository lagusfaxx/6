"use client";

import { useDashboardForm } from "../../../../hooks/useDashboardForm";
import LivePreviewProfessional from "./LivePreviewProfessional";
import LivePreviewShop from "./LivePreviewShop";
import LivePreviewEstablishment from "./LivePreviewEstablishment";

type Props = {
  user: any;
  profileType: string;
};

export default function LivePreview({ user, profileType }: Props) {
  const { state } = useDashboardForm();

  if (profileType === "SHOP") {
    return <LivePreviewShop state={state} user={user} />;
  }
  if (profileType === "ESTABLISHMENT") {
    return <LivePreviewEstablishment state={state} user={user} />;
  }
  return <LivePreviewProfessional state={state} user={user} />;
}
