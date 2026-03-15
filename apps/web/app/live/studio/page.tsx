"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import { AlertTriangle, CheckCircle2, Coins, Plus, Radio, Settings, Trash2, Users } from "lucide-react";

type TipOption = {
  id: string;
  label: string;
  price: number;
  emoji: string | null;
  isActive: boolean;
  sortOrder: number;
};

type StudioData = {
  privateShowPrice: number | null;
  tipOptions: TipOption[];
  activeTipOptionsCount: number;
  checks: {
    hasPrivateShowPrice: boolean;
    hasTipOptions: boolean;
    readyToGoLive: boolean;
  };
  activeStream: {
    id: string;
    title: string | null;
    viewerCount: number;
    startedAt: string;
    privateShowPrice: number | null;
  } | null;
};

export default function LiveStudioPage() {
  const router = useRouter();
  const { me } = useMe();
  const [data, setData] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [liveTitle, setLiveTitle] = useState("");
  const [newTipLabel, setNewTipLabel] = useState("");
  const [newTipPrice, setNewTipPrice] = useState("");
  const [newTipEmoji, setNewTipEmoji] = useState("");
  const [savingTip, setSavingTip] = useState(false);

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<StudioData>("/live/studio/settings");
      setData(r);
      setPriceInput(r.privateShowPrice ? String(r.privateShowPrice) : "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me && !isProfessional) {
      router.push("/live");
      return;
    }
    if (isProfessional) load();
  }, [isProfessional, me, load, router]);

  const sortedTips = useMemo(() => (data?.tipOptions || []).sort((a, b) => a.sortOrder - b.sortOrder), [data]);

  const savePrivateShowPrice = async () => {
    const privateShowPrice = parseInt(priceInput, 10);
    if (!privateShowPrice || privateShowPrice < 1) {
      alert("Ingresa un precio válido mayor a 0");
      return;
    }
    setSavingSettings(true);
    try {
      await apiFetch("/live/studio/settings", {
        method: "PUT",
        body: JSON.stringify({ privateShowPrice }),
      });
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo guardar la configuración");
    } finally {
      setSavingSettings(false);
    }
  };

  const addTipOption = async () => {
    const label = newTipLabel.trim();
    const price = parseInt(newTipPrice, 10);
    if (!label || !price || price < 1) {
      alert("Completa nombre y precio válido.");
      return;
    }
    setSavingTip(true);
    try {
      await apiFetch("/live/tip-options/add", {
        method: "POST",
        body: JSON.stringify({ label, price, emoji: newTipEmoji.trim() || null }),
      });
      setNewTipLabel("");
      setNewTipPrice("");
      setNewTipEmoji("");
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo crear la opción");
    } finally {
      setSavingTip(false);
    }
  };

  const removeTipOption = async (optionId: string) => {
    try {
      await apiFetch(`/live/tip-options/${optionId}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.body?.error || "No se pudo eliminar");
    }
  };

  const startLive = async () => {
    if (!data?.checks.readyToGoLive) {
      alert("Configura el precio del show privado antes de iniciar.");
      return;
    }
    setStartingLive(true);
    try {
      const res = await apiFetch<{ stream: { id: string } }>("/live/start", {
        method: "POST",
        body: JSON.stringify({
          title: liveTitle.trim() || null,
          privateShowPrice: parseInt(priceInput, 10),
        }),
      });
      router.push(`/live/${res.stream.id}`);
    } catch (e: any) {
      if (e?.body?.streamId) {
        router.push(`/live/${e.body.streamId}`);
        return;
      }
      alert(e?.body?.error || "No se pudo iniciar el live");
    } finally {
      setStartingLive(false);
    }
  };

  if (!isProfessional) return null;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white pb-20">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Live Studio</h1>
              <p className="text-sm text-white/50">Panel de control para preparar y operar tus lives.</p>
            </div>
            <Link href="/live" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5">Volver a Lives</Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/40">Cargando studio...</div>
        ) : data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/40">Estado live</p>
                {data.activeStream ? (
                  <Link href={`/live/${data.activeStream.id}`} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200">
                    <Radio className="h-3.5 w-3.5" /> En vivo ({data.activeStream.viewerCount} viewers)
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-white/70">Sin live activo</p>
                )}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/40">Precio show privado</p>
                <p className="mt-2 text-xl font-bold text-amber-300">{data.privateShowPrice ? `${data.privateShowPrice} tk` : "No configurado"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/40">Propinas activas</p>
                <p className="mt-2 text-xl font-bold">{data.activeTipOptionsCount}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Settings className="h-4 w-4" /> Checklist de preparación</div>
              <div className="space-y-2 text-sm">
                <p className={`${data.checks.hasPrivateShowPrice ? "text-emerald-300" : "text-red-300"} flex items-center gap-2`}>{data.checks.hasPrivateShowPrice ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} Precio de show privado configurado</p>
                <p className={`${data.checks.hasTipOptions ? "text-emerald-300" : "text-amber-300"} flex items-center gap-2`}>{data.checks.hasTipOptions ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} Tienes opciones de propina creadas</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Coins className="h-4 w-4" /> Precio de show privado</h2>
              <div className="flex gap-2">
                <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} type="number" min="1" placeholder="Ej: 50" className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm" />
                <button onClick={savePrivateShowPrice} disabled={savingSettings} className="rounded-xl bg-amber-600 px-4 text-sm font-semibold disabled:opacity-50">Guardar</button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Propinas personalizadas (perfil)</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={newTipLabel} onChange={(e) => setNewTipLabel(e.target.value)} placeholder="Nombre" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
                <input value={newTipPrice} onChange={(e) => setNewTipPrice(e.target.value)} type="number" min="1" placeholder="Tokens" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
                <input value={newTipEmoji} onChange={(e) => setNewTipEmoji(e.target.value)} placeholder="Emoji" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" />
              </div>
              <button onClick={addTipOption} disabled={savingTip} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Agregar opción</button>
                            <div className="space-y-2">
                {sortedTips.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-sm">{t.emoji ? `${t.emoji} ` : ""}{t.label} — <span className="text-amber-300">{t.price} tk</span> {!t.isActive && <span className="text-xs text-white/40">(inactiva)</span>}</p>
                    {t.isActive && (
                      <button onClick={() => removeTipOption(t.id)} className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
                {sortedTips.length === 0 && <p className="text-xs text-white/40">Aún no tienes opciones creadas.</p>}
              </div>
            </div>

            {!data.activeStream && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Radio className="h-4 w-4" /> Iniciar live</h2>
                <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} maxLength={100} placeholder="Título (opcional)" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm" />
                <button onClick={startLive} disabled={startingLive || !data.checks.readyToGoLive} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-4 py-3 text-sm font-semibold disabled:opacity-40">{startingLive ? "Iniciando..." : "Iniciar live"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
