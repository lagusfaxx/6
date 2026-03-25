"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, ShieldCheck, UserCircle2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type CreatorInfo = { id: string; status: string } | null;
type CreatorStats = {
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};

export default function UmateAccountPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: CreatorInfo }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
    ]).then(([c, st]) => {
      setCreator(c?.creator || null);
      setCreatorStats(st);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;

  const checks = [
    { label: "Términos aceptados", ok: creatorStats?.termsAccepted },
    { label: "Reglas aceptadas", ok: creatorStats?.rulesAccepted },
    { label: "Contrato firmado", ok: creatorStats?.contractAccepted },
    { label: "Datos bancarios", ok: creatorStats?.bankConfigured },
  ];

  return (
    <div className="space-y-5 py-2 pb-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Cuenta y ajustes</h1>
        <p className="text-sm text-slate-500">Perfil público, cumplimiento legal y configuración operativa del studio.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><UserCircle2 className="h-3.5 w-3.5" /> Perfil</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Username</span><strong className="text-slate-900">@{me?.user?.username}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Nombre público</span><strong className="text-slate-900">{me?.user?.displayName || "Sin definir"}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Estado creadora</span><strong className="text-slate-900">{creator?.status || "No activa"}</strong></div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Legal y estado</p>
          <div className="mt-3 space-y-2">
            {checks.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">{item.label}</span>
                <span className={item.ok ? "inline-flex items-center gap-1 font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{item.ok ? <><CheckCircle2 className="h-3.5 w-3.5" /> Listo</> : "Pendiente"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Building2 className="h-3.5 w-3.5" /> Ajustes recomendados</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["Actualizar bio y portada del perfil", "Completar cuenta bancaria", "Definir frecuencia de publicaciones", "Revisar términos y políticas"].map((task) => (
            <div key={task} className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-700">{task}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
