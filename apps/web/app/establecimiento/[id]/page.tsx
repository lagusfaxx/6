"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

const fallbackGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

type Establishment = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  description: string | null;
  rating: number | null;
  gallery: string[];
  category: string | null;
};

export default function EstablishmentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ establishment: Establishment }>(`/establishments/${id}`)
      .then((res) => setData(res.establishment))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-white/60">Cargando establecimiento...</div>;
  if (!data) return <div className="text-white/60">No encontramos este establecimiento.</div>;

  const gallery = data.gallery.length ? data.gallery : fallbackGallery;

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <div className="mt-1 text-sm text-white/60">
              {data.city} • {data.address}
            </div>
            <div className="mt-2 text-xs text-white/50">Teléfono: {data.phone}</div>
            <div className="mt-2 text-xs text-white/50">⭐ {data.rating ?? "N/A"}</div>
          </div>
          <Link href={`/calificar/establecimiento/${data.id}`} className="btn-primary">
            Calificar
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Galería</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((url, idx) => (
            <div key={`${url}-${idx}`} className="h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-3 text-sm text-white/70">{data.description || "Espacio con servicios para clientes."}</p>
      </div>
    </div>
  );
}
