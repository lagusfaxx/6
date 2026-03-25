"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Building2, FileCheck, ChevronRight, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { apiFetch, getApiBase } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  holderName: string | null;
  holderRut: string | null;
  status: string;
  termsAcceptedAt: string | null;
  rulesAcceptedAt: string | null;
  contractAcceptedAt: string | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { me } = useMe();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [holderRut, setHolderRut] = useState("");

  useEffect(() => {
    apiFetch<{ creator: Creator | null }>("/umate/creator/me").then((d) => {
      if (d?.creator) {
        setCreator(d.creator);
        setDisplayName(d.creator.displayName);
        setBio(d.creator.bio || "");
        setBankName(d.creator.bankName || "");
        setAccountType(d.creator.accountType || "corriente");
        setAccountNumber(d.creator.accountNumber || "");
        setHolderName(d.creator.holderName || "");
        setHolderRut(d.creator.holderRut || "");
        // Determine step
        if (!d.creator.avatarUrl || !d.creator.displayName || !d.creator.bio) setStep(1);
        else if (!d.creator.bankName) setStep(2);
        else if (!d.creator.termsAcceptedAt) setStep(3);
        else setStep(4);
      }
      setLoading(false);
    });
  }, []);

  const handleStart = async () => {
    setSaving(true);
    const d = await apiFetch<{ creator: Creator }>("/umate/creator/onboard", { method: "POST" });
    if (d?.creator) {
      setCreator(d.creator);
      setDisplayName(d.creator.displayName);
      setStep(1);
    }
    setSaving(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${getApiBase()}/umate/creator/avatar`, { method: "POST", credentials: "include", body: form });
    const data = await res.json();
    if (data?.url && creator) setCreator({ ...creator, avatarUrl: data.url });
  };

  const saveProfile = async () => {
    setSaving(true);
    await apiFetch("/umate/creator/profile", { method: "PUT", body: JSON.stringify({ displayName, bio }) });
    setStep(2);
    setSaving(false);
  };

  const saveBank = async () => {
    setSaving(true);
    await apiFetch("/umate/creator/bank", {
      method: "PUT",
      body: JSON.stringify({ bankName, accountType, accountNumber, holderName, holderRut }),
    });
    setStep(3);
    setSaving(false);
  };

  const acceptAll = async () => {
    setSaving(true);
    const d = await apiFetch<{ creator: Creator }>("/umate/creator/accept-terms", {
      method: "POST",
      body: JSON.stringify({ terms: true, rules: true, contract: true }),
    });
    if (d?.creator) setCreator(d.creator);
    setStep(4);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /></div>;

  // Step 0: Welcome
  if (!creator) {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/20 to-amber-500/10 border border-rose-500/20">
          <span className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">U</span>
        </div>
        <h1 className="text-2xl font-bold">Bienvenida a U-Mate</h1>
        <p className="text-sm text-white/50">
          Aquí podrás publicar contenido exclusivo, conseguir suscriptores y monetizar tu perfil.
          Tu cuenta UZEED se mantiene intacta — U-Mate es un módulo adicional.
        </p>
        <ul className="mx-auto max-w-xs space-y-2 text-left text-xs text-white/50">
          <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> Publica fotos y videos gratis o premium</li>
          <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> Los suscriptores pagan un plan mensual</li>
          <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> Recibes $5.000 CLP por cada suscripción</li>
          <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> Retira tus ganancias cuando quieras</li>
        </ul>
        <button
          onClick={handleStart}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-8 py-3 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(244,63,94,0.3)] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Crear cuenta en U-Mate <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    );
  }

  // Step 4: Complete
  if (step >= 4) {
    const isPending = creator.status === "PENDING_REVIEW";
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-6">
        <div className="flex justify-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border ${
            isPending ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"
          }`}>
            {isPending ? <Loader2 className="h-8 w-8 animate-spin text-amber-400" /> : <CheckCircle className="h-8 w-8 text-emerald-400" />}
          </div>
        </div>
        <h1 className="text-xl font-bold">{isPending ? "En revisión" : "¡Cuenta activa!"}</h1>
        <p className="text-sm text-white/50">
          {isPending
            ? "Tu cuenta está siendo revisada por el equipo. Te notificaremos cuando esté aprobada."
            : "Tu cuenta de creadora está activa. ¡Empieza a publicar contenido!"}
        </p>
        {!isPending && (
          <button onClick={() => router.push("/umate/account/content")} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white">
            Publicar contenido <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  const steps = [
    { label: "Perfil", icon: Camera },
    { label: "Banco", icon: Building2 },
    { label: "Términos", icon: FileCheck },
  ];

  const inputClass = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-rose-500/30 focus:outline-none";

  return (
    <div className="mx-auto max-w-md py-8 space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
              i + 1 <= step ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-white/5 text-white/30 border border-white/10"
            }`}>
              {i + 1 <= step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i + 1 < step ? "bg-rose-500/30" : "bg-white/[0.06]"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Perfil de creadora</h2>
          <div className="flex justify-center">
            <button onClick={() => avatarRef.current?.click()} className="relative h-24 w-24 overflow-hidden rounded-full bg-white/10 border-2 border-dashed border-white/20 hover:border-rose-500/40 transition">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="mx-auto mt-7 h-6 w-6 text-white/30" />
              )}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1">Nombre visible *</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre artístico" className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1">Bio *</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuéntale a tus suscriptores sobre ti..." rows={3} className={`${inputClass} resize-none`} />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving || !displayName.trim() || !bio.trim() || !creator.avatarUrl}
            className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Siguiente"}
          </button>
        </div>
      )}

      {/* Step 2: Bank */}
      {step === 2 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Datos bancarios</h2>
          <p className="text-xs text-white/40">Para recibir tus pagos. Puedes modificarlos después.</p>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banco" className={inputClass} />
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
            <option value="corriente">Cuenta Corriente</option>
            <option value="vista">Cuenta Vista / RUT</option>
            <option value="ahorro">Cuenta de Ahorro</option>
          </select>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Número de cuenta" className={inputClass} />
          <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Nombre del titular" className={inputClass} />
          <input value={holderRut} onChange={(e) => setHolderRut(e.target.value)} placeholder="RUT del titular" className={inputClass} />
          <button
            onClick={saveBank}
            disabled={saving || !bankName || !accountNumber || !holderName || !holderRut}
            className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Siguiente"}
          </button>
        </div>
      )}

      {/* Step 3: Terms */}
      {step === 3 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Términos y condiciones</h2>
          <div className="max-h-48 overflow-y-auto rounded-xl bg-white/[0.03] p-4 text-xs text-white/40 space-y-2">
            <p><strong className="text-white/60">Contrato de creadora U-Mate</strong></p>
            <p>Al aceptar, confirmas que eres mayor de 18 años y tienes derecho legal a publicar el contenido que subas.</p>
            <p>Todo contenido publicado debe cumplir con las reglas de la plataforma y las leyes chilenas vigentes.</p>
            <p>U-Mate se reserva el derecho de suspender cuentas que infrinjan las normas.</p>
            <p>Los pagos a creadoras se procesan según el calendario de liquidaciones establecido.</p>
            <p>La plataforma puede aplicar una comisión futura sobre los ingresos generados, la cual será comunicada con antelación.</p>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" id="terms" className="rounded" defaultChecked /> Acepto los términos y condiciones
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" id="rules" className="rounded" defaultChecked /> Acepto las reglas de la plataforma
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" id="contract" className="rounded" defaultChecked /> Acepto el contrato de creadora
            </label>
          </div>
          <button
            onClick={acceptAll}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Aceptar y enviar a revisión"}
          </button>
        </div>
      )}
    </div>
  );
}
