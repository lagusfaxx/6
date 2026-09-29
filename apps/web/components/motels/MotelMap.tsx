"use client";

import dynamic from "next/dynamic";

const MapboxMap = dynamic(() => import("../MapboxMap"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-2xl bg-white/[0.04]" />,
});

export default function MotelMap({ id, name, lat, lng, address }: { id: string; name: string; lat: number; lng: number; address?: string | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
      <MapboxMap height={300} focusMarkerId={id} markers={[{ id, name, lat, lng, subtitle: address || "" }]} />
    </div>
  );
}
