"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  User,
  ArrowRight,
  ShieldCheck,
  Lock,
  Heart,
  Sparkles,
  Star,
  Check,
  Gift,
} from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

type ProfileType = "CLIENT" | "PROFESSIONAL";

type PendingProfile = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type OptionConfig = {
  key: ProfileType;
  title: string;
  description: string;
  icon: any;
  accent: string;
  iconGradient: string;
  ringColor: string;
  badge?: { text: string; tone: "promo" | "popular" };
};

function trialLabel(days: number): string {
  if (days >= 365)
    return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30)
    return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}

const FREE_TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_FREE_TRIAL_DAYS || 90);
const TRIAL_TEXT = `${trialLabel(FREE_TRIAL_DAYS)} gratis`;

const clientOption: OptionConfig = {
  key: "CLIENT",
  title: "Cliente",
  description: "Busca perfiles, guarda favoritos y coordina por chat.",
  icon: User,
  accent: "from-sky-500/15 via-blue-500/10 to-cyan-500/10",
  iconGradient: "from-sky-400 to-blue-500",
  ringColor: "ring-sky-400/50 border-sky-400/40",
  badge: { text: "Más popular", tone: "popular" },
};

const professionalOption: OptionConfig = {
  key: "PROFESSIONAL",
  title: "Acompañante",
  description: "Publica tu perfil con fotos, tarifas y recibe clientes por chat.",
  icon: Briefcase,
  accent: "from-fuchsia-500/15 via-pink-500/10 to-rose-500/10",
  iconGradient: "from-fuchsia-400 to-pink-500",
  ringColor: "ring-fuchsia-400/50 border-fuchsia-400/40",
  badge: { text: TRIAL_TEXT, tone: "promo" },
};

export default function GoogleTypeChooserClient() {
  const [pending, setPending] = useState<PendingProfile | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch<PendingProfile>("/auth/google/pending");
        if (!active) return;
        setPending(data);
      } catch (err: any) {
        if (!active) return;
        // No pending Google signup — send them back to login.
        window.location.replace("/login");
      } finally {
        if (active) setLoadingPending(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo<OptionConfig | null>(() => {
    if (profileType === "CLIENT") return clientOption;
    if (profileType === "PROFESSIONAL") return professionalOption;
    return null;
  }, [profileType]);

  async function onContinue() {
    if (!profileType || submitting) return;

    // Acompañante (profesional) necesita completar formulario + fotos — la
    // creación se hace al final de /register?google=1. Aquí solo navegamos.
    if (profileType === "PROFESSIONAL") {
      window.location.href = "/register?google=1&type=PROFESSIONAL";
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ redirect: string }>("/auth/google/complete", {
        method: "POST",
        body: JSON.stringify({ profileType }),
      });
      window.location.replace(data.redirect || "/");
    } catch (err: any) {
      setError(
        err?.body?.message ||
          friendlyErrorMessage(err) ||
          "No pudimos crear tu cuenta. Intenta de nuevo.",
      );
      setSubmitting(false);
    }
  }

  if (loadingPending) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-white/60">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Verificando tu cuenta de Google...
        </div>
      </div>
    );
  }

  if (!pending) return null;

  const isProfessional = profileType === "PROFESSIONAL";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Hero header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 blur-3xl scale-150 animate-pulse" />
            <div className="relative rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 p-[2px] shadow-2xl">
              <img
                src="/brand/isotipo-new.png"
                alt="UZEED"
                className="w-20 h-20 rounded-[22px]"
              />
            </div>
          </div>
          <h1 className="mt-6 text-[2rem] md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Elige tu tipo de cuenta
          </h1>
          <p className="mt-2 text-sm text-white/55 text-center max-w-sm leading-relaxed">
            Vas a crear tu cuenta con{" "}
            <span className="text-white/80 font-semibold">{pending.email}</span>.
            Elige cómo vas a usar UZEED.
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <div className="grid gap-3">
              <OptionCard
                option={clientOption}
                selected={profileType === "CLIENT"}
                onSelect={() => setProfileType("CLIENT")}
              />
              <OptionCard
                option={professionalOption}
                selected={profileType === "PROFESSIONAL"}
                onSelect={() => setProfileType("PROFESSIONAL")}
              />
            </div>

            {isProfessional && (
              <div className="mt-5 relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-600/20 via-violet-600/20 to-pink-600/20 p-4">
                <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-fuchsia-500/20 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 border border-fuchsia-400/30 shadow-lg shadow-fuchsia-500/20">
                    <Gift className="h-5 w-5 text-fuchsia-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span className="text-sm font-bold text-white">{TRIAL_TEXT}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/65 leading-relaxed">
                      Sin tarjeta de crédito. Completa tu perfil (teléfono,
                      dirección y fotos) y un admin te llamará para verificarte.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Continue button */}
            <button
              type="button"
              disabled={profileType === null || submitting}
              onClick={onContinue}
              className="mt-6 group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-fuchsia-600 bg-[length:200%_100%] bg-left hover:bg-right font-semibold text-white py-3.5 text-base flex items-center justify-center gap-2 shadow-[0_15px_40px_rgba(168,85,247,0.35)] transition-[background-position,transform] duration-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:from-white/10 disabled:to-white/10"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  {profileType === null
                    ? "Elige una opción"
                    : profileType === "PROFESSIONAL"
                      ? "Completar registro"
                      : "Continuar"}
                  {profileType !== null && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </span>
              )}
            </button>

            {/* Trust indicators */}
            <div className="mt-6 flex items-center justify-center gap-5 text-[11px] text-white/40">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
                <span>Verificado</span>
              </div>
              <span className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-sky-400/70" />
                <span>Privado</span>
              </div>
              <span className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-fuchsia-400/70" />
                <span>Gratis</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-white/45">
          ¿Prefieres usar otro correo?{" "}
          <Link
            href="/login"
            className="font-semibold text-fuchsia-300 hover:text-fuchsia-200 underline-offset-4 hover:underline transition"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: OptionConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative w-full text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden ${
        selected
          ? `bg-gradient-to-br ${option.accent} ${option.ringColor} ring-2 shadow-[0_10px_40px_rgba(168,85,247,0.15)]`
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-0.5"
      }`}
    >
      {option.badge && (
        <span
          className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            option.badge.tone === "promo"
              ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
              : "border-sky-400/40 bg-sky-500/15 text-sky-200"
          }`}
        >
          {option.badge.tone === "promo" ? (
            <Sparkles className="h-2.5 w-2.5" />
          ) : (
            <Star className="h-2.5 w-2.5 fill-current" />
          )}
          {option.badge.text}
        </span>
      )}

      <div className="relative flex items-center gap-4">
        <div
          className={`relative h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 ${
            selected
              ? `bg-gradient-to-br ${option.iconGradient} shadow-lg scale-105`
              : "bg-white/5 border border-white/10 group-hover:scale-105"
          }`}
        >
          <Icon
            className={`h-5 w-5 transition-colors ${selected ? "text-white" : "text-white/75"}`}
          />
          {selected && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 border-2 border-[#0d0e1a] flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 pr-16">
          <div
            className={`font-semibold transition-colors ${
              selected ? "text-white" : "text-white/95"
            }`}
          >
            {option.title}
          </div>
          <div className="text-xs sm:text-sm text-white/55 mt-0.5 leading-relaxed">
            {option.description}
          </div>
        </div>
      </div>
    </button>
  );
}
