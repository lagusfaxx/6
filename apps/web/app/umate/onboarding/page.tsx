"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Building2, FileCheck, Loader2, CheckCircle, ArrowRight, Shield, Upload, X } from "lucide-react";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../lib/api";
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
  const [error, setError] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [isSubscriber, setIsSubscriber] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [holderRut, setHolderRut] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [rulesChecked, setRulesChecked] = useState(false);
  const [contractChecked, setContractChecked] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: Creator | null }>("/umate/creator/me"),
      apiFetch<{ active: boolean }>("/umate/subscription/status").catch(() => null),
    ]).then(([d, sub]) => {
      setIsSubscriber(Boolean(sub?.active));
      if (d?.creator) {
        setCreator(d.creator);
        setDisplayName(d.creator.displayName);
        setBio(d.creator.bio || "");
        setBankName(d.creator.bankName || "");
        setAccountType(d.creator.accountType || "corriente");
        setAccountNumber(d.creator.accountNumber || "");
        setHolderName(d.creator.holderName || "");
        setHolderRut(d.creator.holderRut || "");
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
    setError("");
    try {
      const d = await apiFetch<{ creator: Creator }>("/umate/creator/onboard", { method: "POST" });
      if (d?.creator) {
        setCreator(d.creator);
        setDisplayName(d.creator.displayName);
        setStep(1);
      }
    } catch (err: any) {
      if (err?.body?.error === "SUBSCRIBER_CANNOT_CREATE") {
        setError("Los suscriptores no pueden crear cuenta de creadora. Usa una cuenta diferente.");
      } else {
        setError("Error al crear la cuenta. Intenta de nuevo.");
      }
    }
    setSaving(false);
  };

  const uploadFile = async (endpoint: string, file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${getApiBase()}${endpoint}`, { method: "POST", credentials: "include", body: form });
    const data = await res.json();
    return data?.url || null;
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile("/umate/creator/avatar", file);
    if (url && creator) setCreator({ ...creator, avatarUrl: url });
  };

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile("/umate/creator/cover", file);
    if (url && creator) setCreator({ ...creator, coverUrl: url });
  };

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/umate/creator/profile", { method: "PUT", body: JSON.stringify({ displayName, bio }) });
      setStep(2);
    } catch {
      setError("Error al guardar el perfil. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const saveBank = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/umate/creator/bank", {
        method: "PUT",
        body: JSON.stringify({ bankName, accountType, accountNumber, holderName, holderRut }),
      });
      setStep(3);
    } catch {
      setError("Error al guardar datos bancarios. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const acceptAll = async () => {
    setSaving(true);
    setError("");
    try {
      const d = await apiFetch<{ creator: Creator }>("/umate/creator/accept-terms", {
        method: "POST",
        body: JSON.stringify({ terms: true, rules: true, contract: true }),
      });
      if (d?.creator) setCreator(d.creator);
      setStep(4);
    } catch {
      setError("Error al aceptar los terminos. Intenta de nuevo.");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>;

  if (isSubscriber && !creator) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
          <Shield className="h-8 w-8 text-amber-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white">No disponible</h1>
        <p className="text-sm text-white/45">
          Los suscriptores activos no pueden crear una cuenta de creadora.
        </p>
        <Link href="/umate/account" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-6 py-2.5 text-sm text-white/40 transition hover:text-white/60">
          Volver a mi cuenta
        </Link>
      </div>
    );
  }

  // Welcome screen
  if (!creator) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#00aff0]/10 border border-[#00aff0]/20">
          <img src="/brand/umate-logo-white.svg" alt="U-Mate" className="h-10 w-auto" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Bienvenida a U-Mate</h1>
        <p className="text-sm text-white/45 leading-relaxed">
          Publica contenido exclusivo, consigue suscriptores y monetiza tu perfil.
        </p>
        <div className="mx-auto max-w-xs space-y-3 text-left">
          {[
            "Publica fotos y videos gratis o premium",
            "Los suscriptores pagan un plan mensual",
            "Recibes $5.000 CLP por cada suscripción",
            "Retira tus ganancias cuando quieras",
          ].map((text) => (
            <div key={text} className="flex items-start gap-3 text-xs text-white/40">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00aff0]/70" />
              <span>{text}</span>
            </div>
          ))}
        </div>
        {error && (
          <div className="mx-auto max-w-xs rounded-xl bg-red-500/[0.06] border border-red-500/20 p-3 text-xs text-red-400">
            {error}
          </div>
        )}
        <button
          onClick={handleStart}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-[#00aff0] px-8 py-3 text-sm font-bold text-white shadow-[0_2px_20px_rgba(0,175,240,0.3)] transition-all duration-300 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_30px_rgba(0,175,240,0.4)] hover:-translate-y-px disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Crear cuenta <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    );
  }

  // Complete
  if (step >= 4) {
    const isPending = creator.status === "PENDING_REVIEW";
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-6">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${
          isPending ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"
        }`}>
          {isPending ? <Loader2 className="h-8 w-8 animate-spin text-amber-400" /> : <CheckCircle className="h-8 w-8 text-emerald-400" />}
        </div>
        <h1 className="text-2xl font-extrabold text-white">{isPending ? "En revisión" : "Cuenta activa"}</h1>
        <p className="text-sm text-white/45">
          {isPending
            ? "Tu cuenta está siendo revisada. Te notificaremos cuando esté aprobada."
            : "Tu cuenta de creadora está activa. Empieza a publicar contenido."}
        </p>
        {!isPending && (
          <button
            onClick={() => router.push("/umate/account/content")}
            className="inline-flex items-center gap-2 rounded-full bg-[#00aff0] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#00aff0]/20 transition hover:bg-[#00aff0]/90"
          >
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

  const inputClass = "w-full rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5 text-sm text-white placeholder:text-white/45 focus:border-[#00aff0]/30 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,175,240,0.05)] transition-all duration-200";

  return (
    <div className="mx-auto max-w-md px-4 py-8 space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
              i + 1 <= step
                ? "bg-[#00aff0]/15 text-[#00aff0] border border-[#00aff0]/30"
                : i + 1 === step + 1
                ? "bg-white/[0.06] text-white border border-white/[0.15]"
                : "bg-white/[0.02] text-white/40 border border-white/[0.06]"
            }`}>
              {i + 1 <= step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i + 1 < step ? "bg-[#00aff0]/30" : "bg-white/[0.06]"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/[0.06] border border-red-500/20 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Perfil de creadora</h2>
            <p className="mt-1 text-xs text-white/40">Así te verán tus suscriptores</p>
          </div>

          <div>
            <button
              onClick={() => coverRef.current?.click()}
              className="relative w-full h-28 overflow-hidden rounded-lg bg-white/[0.03] border-2 border-dashed border-white/[0.08] transition hover:border-[#00aff0]/30"
            >
              {creator.coverUrl ? (
                <img src={resolveMediaUrl(creator.coverUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/40">
                  <Upload className="h-5 w-5 mb-1" />
                  <span className="text-[10px]">Foto de portada</span>
                </div>
              )}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
          </div>

          <div className="flex justify-center -mt-10 relative z-10">
            <button onClick={() => avatarRef.current?.click()} className="relative h-24 w-24 overflow-hidden rounded-full bg-white/[0.08] border-4 border-[#0a0a0f] shadow-lg hover:ring-2 hover:ring-[#00aff0]/30 transition">
              {creator.avatarUrl ? (
                <img src={resolveMediaUrl(creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/45">
                  <Camera className="h-6 w-6" />
                </div>
              )}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-white/40 mb-1.5">Nombre artístico *</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre visible" className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/40 mb-1.5">Bio *</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuéntale a tus suscriptores sobre ti..." rows={3} className={`${inputClass} resize-none`} />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving || !displayName.trim() || !bio.trim() || !creator.avatarUrl}
            className="w-full rounded-full bg-[#00aff0] py-3 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.2)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_24px_rgba(0,175,240,0.3)] disabled:opacity-40"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Siguiente"}
          </button>
        </div>
      )}

      {/* Step 2: Bank */}
      {step === 2 && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Datos bancarios</h2>
            <p className="mt-1 text-xs text-white/40">Para recibir tus pagos</p>
          </div>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Nombre del banco" className={inputClass} />
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
            <option value="corriente">Cuenta Corriente</option>
            <option value="vista">Cuenta Vista / RUT</option>
            <option value="ahorro">Cuenta de Ahorro</option>
          </select>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Número de cuenta" className={inputClass} />
          <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Nombre del titular" className={inputClass} />
          <input value={holderRut} onChange={(e) => setHolderRut(e.target.value)} placeholder="RUT del titular (ej: 12.345.678-9)" className={inputClass} />
          <button
            onClick={saveBank}
            disabled={saving || !bankName || !accountNumber || !holderName || !holderRut}
            className="w-full rounded-full bg-[#00aff0] py-3 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.2)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_24px_rgba(0,175,240,0.3)] disabled:opacity-40"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Siguiente"}
          </button>
        </div>
      )}

      {/* Step 3: Terms */}
      {step === 3 && (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Terminos y condiciones</h2>
            <p className="mt-1 text-xs text-white/40">Lee y acepta para continuar</p>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg bg-white/[0.02] p-4 text-xs text-white/40 space-y-2.5 leading-relaxed border border-white/[0.04]">
            <p><strong className="text-white/50">Contrato de creadora U-Mate</strong></p>
            <p>Al aceptar, confirmas que eres mayor de 18 años y tienes derecho legal a publicar el contenido que subas.</p>
            <p>Todo contenido publicado debe cumplir con las reglas de la plataforma y las leyes chilenas vigentes.</p>
            <p>U-Mate se reserva el derecho de suspender cuentas que infrinjan las normas.</p>
            <p>Los pagos a creadoras se procesan según el calendario de liquidaciones establecido.</p>
            <p>La plataforma puede aplicar una comisión futura sobre los ingresos generados, la cual será comunicada con antelación.</p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-xs text-white/40 cursor-pointer">
              <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} className="rounded border-white/20" />
              Acepto los <Link href="/umate/terms" className="text-[#00aff0] underline">términos y condiciones</Link>
            </label>
            <label className="flex items-center gap-3 text-xs text-white/40 cursor-pointer">
              <input type="checkbox" checked={rulesChecked} onChange={(e) => setRulesChecked(e.target.checked)} className="rounded border-white/20" />
              Acepto las <Link href="/umate/rules" className="text-[#00aff0] underline">reglas de la plataforma</Link>
            </label>
            <label className="flex items-center gap-3 text-xs text-white/40 cursor-pointer">
              <input type="checkbox" checked={contractChecked} onChange={(e) => setContractChecked(e.target.checked)} className="rounded border-white/20" />
              Acepto el contrato de creadora
            </label>
          </div>
          <button
            onClick={acceptAll}
            disabled={saving || !termsChecked || !rulesChecked || !contractChecked}
            className="w-full rounded-full bg-[#00aff0] py-3 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.2)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_24px_rgba(0,175,240,0.3)] disabled:opacity-40"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Aceptar y enviar a revisión"}
          </button>
        </div>
      )}
    </div>
  );
}
