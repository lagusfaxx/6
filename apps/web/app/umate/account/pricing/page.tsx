"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Save } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type CreatorFull = {
  id: string;
  monthlyPriceCLP?: number;
};

export default function UmatePricingPage() {
  const [price, setPrice] = useState<string>("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ creator: CreatorFull }>("/umate/creator/me")
      .then((d) => {
        const cur = d?.creator?.monthlyPriceCLP ?? 9990;
        setCurrentPrice(cur);
        setPrice(String(cur));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const priceInt = parseInt(price, 10);
    if (!Number.isFinite(priceInt) || priceInt < 1000 || priceInt > 200000) {
      setMsg("El precio debe estar entre $1.000 y $200.000 CLP.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await apiFetch<{ creator: { monthlyPriceCLP: number } }>(
      "/umate/creator/price",
      {
        method: "PUT",
        body: JSON.stringify({ monthlyPriceCLP: priceInt }),
      },
    ).catch((err: any) => {
      setMsg(err?.body?.message || "No se pudo actualizar el precio.");
      return null;
    });
    if (res?.creator) {
      setCurrentPrice(res.creator.monthlyPriceCLP);
      setMsg("Precio actualizado correctamente.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Tarifa mensual
        </h1>
        <p className="mt-1 text-sm text-white/30">
          Precio que cobras a tus fans para desbloquear tu contenido premium.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30">
          <CreditCard className="h-4 w-4" /> Suscripción mensual (PAC)
        </h2>
        <p className="mt-1 text-xs text-white/30">
          Se cobra automáticamente cada 30 días a los fans que se suscriben a ti.
        </p>

        <div className="mt-5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Precio (CLP)
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 transition focus-within:border-[#00aff0]/30">
            <span className="text-white/40">$</span>
            <input
              type="number"
              min={1000}
              max={200000}
              step={500}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setMsg(null);
              }}
              placeholder="9990"
              className="flex-1 bg-transparent text-base text-white placeholder-white/20 outline-none"
            />
            <span className="text-xs text-white/25">/ mes</span>
          </div>
          <p className="mt-1 text-[10px] text-white/25">
            Mínimo $1.000 · Máximo $200.000 CLP.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || String(currentPrice ?? "") === String(parseInt(price, 10))}
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.25)] transition disabled:opacity-40 sm:w-auto"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar precio
        </button>

        {msg && (
          <p className="mt-3 rounded-xl border border-[#00aff0]/15 bg-[#00aff0]/[0.04] px-3 py-2 text-[11px] text-[#00aff0]/80">
            {msg}
          </p>
        )}
      </section>
    </div>
  );
}
