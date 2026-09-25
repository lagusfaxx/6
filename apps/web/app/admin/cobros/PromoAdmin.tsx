"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Plus, Rocket, Sparkles } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

type Product = {
  id: string;
  kind: "PLAN" | "BOOST";
  code: "SILVER" | "GOLD" | "DIAMOND" | "BUMP" | "SPOTLIGHT";
  name: string;
  description: string | null;
  duration: number;
  priceClp: number;
  isActive: boolean;
  sortOrder: number;
};

type Overview = {
  activeBoosts: {
    id: string;
    code: string;
    name: string;
    endsAt: string;
    paidWith: string;
    username: string;
    displayName: string | null;
  }[];
  paidPlans: Record<string, number>;
  sales30d: { method: string; count: number; amountClp: number }[];
};

const CODE_LABEL: Record<Product["code"], string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  DIAMOND: "Diamond",
  BUMP: "Subir al top",
  SPOTLIGHT: "Destacada",
};

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

/** Catálogo de planes y boosts, regalos y ventas (dentro de /admin/cobros). */
export default function PromoAdmin({ billingEnabled, onSaved }: { billingEnabled: boolean; onSaved?: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [grant, setGrant] = useState({ username: "", productId: "" });
  const [granting, setGranting] = useState(false);

  const load = () => {
    apiFetch<{ products: Product[] }>("/admin/promo/products")
      .then((r) => setProducts(r.products))
      .catch((e) => setNotice({ ok: false, text: friendlyErrorMessage(e) }));
    apiFetch<Overview>("/admin/promo/overview")
      .then(setOverview)
      .catch(() => {});
  };
  useEffect(load, []);

  const edit = (idx: number, patch: Partial<Product>) =>
    setProducts((prev) => (prev ? prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)) : prev));

  const addBoost = () =>
    setProducts((prev) => [
      ...(prev ?? []),
      {
        id: "",
        kind: "BOOST",
        code: "BUMP",
        name: "Subir al top 3 días",
        description: "Primer lugar en la búsqueda y los listados de tu comuna.",
        duration: 72,
        priceClp: 6990,
        isActive: true,
        sortOrder: 100,
      },
    ]);

  const save = async () => {
    if (!products) return;
    setSaving(true);
    setNotice(null);
    try {
      const r = await apiFetch<{ products: Product[] }>("/admin/promo/products", {
        method: "PUT",
        body: JSON.stringify({ products }),
      });
      setProducts(r.products);
      setNotice({ ok: true, text: "Catálogo guardado." });
      onSaved?.();
    } catch (e) {
      setNotice({ ok: false, text: friendlyErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const doGrant = async () => {
    setGranting(true);
    setNotice(null);
    try {
      const r = await apiFetch<{ summary: string }>("/admin/promo/grant", {
        method: "POST",
        body: JSON.stringify(grant),
      });
      setNotice({ ok: true, text: `Regalo aplicado — ${r.summary}` });
      setGrant({ username: "", productId: "" });
      load();
    } catch (e) {
      setNotice({ ok: false, text: friendlyErrorMessage(e) });
    } finally {
      setGranting(false);
    }
  };

  const plans = (products ?? []).map((p, i) => ({ p, i })).filter(({ p }) => p.kind === "PLAN");
  const boosts = (products ?? []).map((p, i) => ({ p, i })).filter(({ p }) => p.kind === "BOOST");
  const sales = overview?.sales30d ?? [];
  const salesTotal = sales.reduce((s, x) => s + x.amountClp, 0);

  return (
    <>
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-fuchsia-300" /> Planes y boosts
        </h2>
        <p className="mt-1 text-xs text-white/45">
          {billingEnabled
            ? "A la venta en /planes. El precio de Silver es la tarifa de membresía."
            : "Con el cobro apagado no se venden: las profesionales ven los planes como informativos."}
        </p>

        {!products ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/[0.04]" />
        ) : (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/40">Planes (duración en días)</p>
            <div className="mt-2 space-y-2">
              {plans.map(({ p, i }) => (
                <ProductRow key={p.id || i} p={p} onChange={(patch) => edit(i, patch)} unit="días" />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Boosts (duración en horas)</p>
              <button
                type="button"
                onClick={addBoost}
                className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar boost
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {boosts.map(({ p, i }) => (
                <ProductRow key={p.id || `new-${i}`} p={p} onChange={(patch) => edit(i, patch)} unit="horas" boost />
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar catálogo
              </button>
            </div>
          </>
        )}
      </section>

      {/* Regalar */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Gift className="h-4 w-4 text-emerald-300" /> Regalar un plan o boost
        </h2>
        <p className="mt-1 text-xs text-white/45">Para compensaciones o promociones. No cobra nada y funciona con el cobro apagado.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={grant.username}
            onChange={(e) => setGrant((g) => ({ ...g, username: e.target.value }))}
            placeholder="@usuario"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
          />
          <select
            value={grant.productId}
            onChange={(e) => setGrant((g) => ({ ...g, productId: e.target.value }))}
            className="flex-1 rounded-xl border border-white/10 bg-[#0d0e1a] px-3 py-2 text-sm outline-none"
          >
            <option value="">Elige qué regalar…</option>
            {(products ?? [])
              .filter((p) => p.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.duration} {p.kind === "PLAN" ? "días" : "horas"}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={doGrant}
            disabled={granting || !grant.username.trim() || !grant.productId}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
          >
            {granting && <Loader2 className="h-4 w-4 animate-spin" />}
            Regalar
          </button>
        </div>
      </section>

      {notice && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            notice.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Resumen */}
      {overview && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Rocket className="h-4 w-4 text-amber-300" /> Actividad
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Ventas 30 días" value={clp(salesTotal)} />
            <Mini label="Diamond pagados" value={String(overview.paidPlans.DIAMOND ?? 0)} />
            <Mini label="Gold pagados" value={String(overview.paidPlans.GOLD ?? 0)} />
            <Mini label="Boosts activos" value={String(overview.activeBoosts.length)} />
          </div>
          {sales.length > 0 && (
            <p className="mt-2 text-[11px] text-white/40">
              {sales.map((s) => `${s.method === "TOKENS" ? "Tokens" : s.method === "FLOW" ? "Flow" : s.method}: ${s.count} (${clp(s.amountClp)})`).join(" · ")}
            </p>
          )}
          {overview.activeBoosts.length > 0 && (
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {overview.activeBoosts.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{b.displayName || b.username}</span>{" "}
                    <span className="text-white/40">@{b.username}</span>
                  </span>
                  <span className="shrink-0 text-xs text-white/55">
                    {b.name} · hasta{" "}
                    {new Date(b.endsAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {b.paidWith === "ADMIN" && <span className="ml-1 text-emerald-300">(regalo)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function ProductRow({
  p,
  onChange,
  unit,
  boost,
}: {
  p: Product;
  onChange: (patch: Partial<Product>) => void;
  unit: string;
  boost?: boolean;
}) {
  const num = (v: string) => Number(v.replace(/[^\d]/g, "") || 0);
  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${p.isActive ? "" : "opacity-50"}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-center">
        <div className="col-span-2 sm:col-span-4">
          <input
            value={p.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-1.5 text-sm font-medium outline-none"
            aria-label="Nombre"
          />
        </div>
        {boost ? (
          <select
            value={p.code}
            onChange={(e) => onChange({ code: e.target.value as Product["code"] })}
            className="rounded-lg border border-white/10 bg-[#0d0e1a] px-2 py-1.5 text-xs sm:col-span-2"
            aria-label="Tipo de boost"
          >
            <option value="BUMP">Subir al top</option>
            <option value="SPOTLIGHT">Destacada</option>
          </select>
        ) : (
          <span className="px-2 text-xs text-white/50 sm:col-span-2">{CODE_LABEL[p.code]}</span>
        )}
        <label className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs sm:col-span-2">
          <input
            inputMode="numeric"
            value={String(p.duration)}
            onChange={(e) => onChange({ duration: num(e.target.value) })}
            className="w-full bg-transparent text-sm outline-none"
            aria-label={`Duración en ${unit}`}
          />
          <span className="text-white/40">{unit}</span>
        </label>
        <label className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs sm:col-span-3">
          <span className="text-white/40">$</span>
          <input
            inputMode="numeric"
            value={String(p.priceClp)}
            onChange={(e) => onChange({ priceClp: num(e.target.value) })}
            className="w-full bg-transparent text-sm outline-none"
            aria-label="Precio CLP"
          />
        </label>
        <label className="flex items-center justify-end gap-1.5 text-xs text-white/60 sm:col-span-1">
          <input type="checkbox" checked={p.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} />
          <span className="sm:sr-only">Activo</span>
        </label>
      </div>
      <input
        value={p.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Descripción que ve la profesional"
        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1.5 text-xs text-white/70 outline-none"
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}
