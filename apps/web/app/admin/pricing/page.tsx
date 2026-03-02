"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

type PricingRule = {
  id: string;
  kind: "PROFESSIONAL" | "SHOP";
  tier: "PREMIUM" | "GOLD" | "SILVER" | null;
  priceClp: number;
  days: number;
  isActive: boolean;
};

export default function AdminPricingPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch<{ rules: PricingRule[] }>("/admin/pricing-rules")
      .then((r) => setRules(r.rules ?? []))
      .catch(() => setError("No se pudieron cargar los precios."));
  }, [isAdmin]);

  const upsert = (idx: number, patch: Partial<PricingRule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRule = (kind: "PROFESSIONAL" | "SHOP") => {
    setRules((prev) => [
      ...prev,
      { id: "", kind, tier: null, priceClp: kind === "SHOP" ? 10000 : 4990, days: 30, isActive: true }
    ]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        rules: rules.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          kind: r.kind,
          tier: r.tier,
          priceClp: Number(r.priceClp),
          days: Number(r.days),
          isActive: Boolean(r.isActive)
        }))
      };
      const resp = await apiFetch<{ rules: PricingRule[] }>("/admin/pricing-rules", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setRules(resp.rules ?? []);
    } catch {
      setError("No se pudo guardar. Verifica que estés logeado como admin.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-white/80">Cargando...</div>;

  if (!user) {
    return (
      <div className="p-6 text-white">
        <p className="mb-3">Debes iniciar sesión.</p>
        <Link className="underline" href="/login">Ir a iniciar sesión</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-white">
        <p className="mb-3">No tienes permisos para ver este panel.</p>
        <Link className="underline" href="/dashboard">Volver</Link>
      </div>
    );
  }

  return (
    <div className="p-6 text-white max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin · Precios de publicidad mensual</h1>
        <Link className="underline" href="/dashboard">Volver</Link>
      </div>

      <p className="text-white/80 mb-4">
        Define los precios mensuales para que perfiles <b>Experiencias</b> y <b>Lugares</b> aparezcan como activos en el directorio.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 mb-4 text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        <button className="px-3 py-2 rounded-xl bg-white text-black" onClick={() => addRule("PROFESSIONAL")}>
          + Experiencia
        </button>
        <button className="px-3 py-2 rounded-xl bg-white text-black" onClick={() => addRule("SHOP")}>
          + Lugar
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-white/60 border-b border-white/10">
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Tier</div>
          <div className="col-span-3">Precio CLP</div>
          <div className="col-span-2">Días</div>
          <div className="col-span-2">Activo</div>
          <div className="col-span-1"></div>
        </div>

        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-white/10 items-center">
            <div className="col-span-2 text-sm">{r.kind}</div>

            <div className="col-span-2">
              <select
                className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-sm"
                value={r.tier ?? ""}
                onChange={(e) => upsert(i, { tier: e.target.value ? (e.target.value as any) : null })}
              >
                <option value="">(general)</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="GOLD">GOLD</option>
                <option value="SILVER">SILVER</option>
              </select>
            </div>

            <div className="col-span-3">
              <input
                className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-sm"
                type="number"
                value={r.priceClp}
                onChange={(e) => upsert(i, { priceClp: Number(e.target.value) })}
              />
            </div>

            <div className="col-span-2">
              <input
                className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-sm"
                type="number"
                value={r.days}
                onChange={(e) => upsert(i, { days: Number(e.target.value) })}
              />
            </div>

            <div className="col-span-2">
              <input type="checkbox" checked={r.isActive} onChange={(e) => upsert(i, { isActive: e.target.checked })} />
            </div>

            <div className="col-span-1">
              <button
                className="text-xs underline text-white/70"
                onClick={() => setRules((prev) => prev.filter((_, idx) => idx !== i))}
              >
                quitar
              </button>
            </div>
          </div>
        ))}

        {rules.length === 0 ? (
          <div className="p-4 text-white/70">No hay reglas aún. Agrega una para Experiencia y otra para Lugar.</div>
        ) : null}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="px-4 py-2 rounded-xl bg-white text-black font-medium disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar precios"}
        </button>
      </div>
    </div>
  );
}
