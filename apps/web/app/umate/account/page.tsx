"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Compass,
  ExternalLink,
  FileStack,
  Heart,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCircle2,
  Users2,
  Wallet,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type CreatorInfo = { id: string; status: string } | null;
type CreatorStats = {
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};
type DirectSubscription = {
  id: string;
  priceCLP: number;
  currentPeriodEnd: string;
  creator: { displayName: string; avatarUrl: string | null };
};

type CreatorFull = {
  id: string;
  status: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  monthlyPriceCLP?: number;
};

type SettingsItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  desc: string;
  badge?: string;
};

export default function UmateAccountPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorFull, setCreatorFull] = useState<CreatorFull | null>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [directSubs, setDirectSubs] = useState<DirectSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const isCreator = Boolean(creatorFull && creatorFull.status !== "SUSPENDED");

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: CreatorFull }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
      apiFetch<{ subscriptions: DirectSubscription[] }>("/umate/my-subscriptions").catch(() => null),
    ]).then(([c, st, sub]) => {
      const cr = c?.creator || null;
      setCreator(cr ? { id: cr.id, status: cr.status } : null);
      setCreatorFull(cr);
      setCreatorStats(st);
      setDirectSubs(sub?.subscriptions || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
        <p className="text-xs text-white/30">Cargando cuenta...</p>
      </div>
    );
  }

  const pendingChecks = creatorStats
    ? [creatorStats.termsAccepted, creatorStats.rulesAccepted, creatorStats.contractAccepted, creatorStats.bankConfigured].filter((x) => !x).length
    : 0;

  const header = (
    <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
          {creatorFull?.avatarUrl || me?.user?.avatarUrl ? (
            <img
              src={resolveMediaUrl(creatorFull?.avatarUrl || me?.user?.avatarUrl || "") || ""}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-lg font-bold text-white/40">
              {(creatorFull?.displayName || me?.user?.displayName || me?.user?.username || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="truncate text-base font-bold text-white">
            {creatorFull?.displayName || me?.user?.displayName || me?.user?.username || "Usuario"}
          </h2>
          <p className="truncate text-xs text-white/30">@{me?.user?.username || "—"}</p>
          {isCreator && creator?.status && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/50">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  creator.status === "ACTIVE"
                    ? "bg-emerald-400"
                    : creator.status === "PENDING_REVIEW"
                      ? "bg-amber-400"
                      : "bg-white/40"
                }`}
              />
              {creator.status === "ACTIVE"
                ? "Activa"
                : creator.status === "PENDING_REVIEW"
                  ? "En revisión"
                  : "Pendiente"}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  // ─── CLIENT VIEW ───
  if (!isCreator) {
    const clientSections: { title: string; items: SettingsItem[] }[] = [
      {
        title: "Tu cuenta",
        items: [
          {
            href: "/umate/account/subscriptions",
            icon: Heart,
            iconColor: "text-rose-400",
            label: "Mis suscripciones",
            desc: directSubs.length > 0 ? `${directSubs.length} activa${directSubs.length === 1 ? "" : "s"}` : "Sin suscripciones",
          },
        ],
      },
      {
        title: "Descubre",
        items: [
          {
            href: "/umate/explore",
            icon: Compass,
            iconColor: "text-[#00aff0]",
            label: "Explorar creadoras",
            desc: "Encuentra contenido nuevo",
          },
          {
            href: "/umate/onboarding",
            icon: Sparkles,
            iconColor: "text-purple-400",
            label: "Ser creadora",
            desc: "Crea tu perfil y empieza a ganar",
          },
        ],
      },
      {
        title: "Otros",
        items: [
          {
            href: "/",
            icon: ExternalLink,
            iconColor: "text-white/40",
            label: "Volver a UZEED",
            desc: "Ir a la plataforma principal",
          },
        ],
      },
    ];

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Mi cuenta</h1>
          <p className="mt-1 text-sm text-white/30">Gestiona tu perfil y suscripciones.</p>
        </div>

        {header}

        {clientSections.map((section) => (
          <SettingsSection key={section.title} title={section.title} items={section.items} />
        ))}
      </div>
    );
  }

  // ─── CREATOR VIEW ───
  const creatorSections: { title: string; items: SettingsItem[] }[] = [
    {
      title: "Perfil y precio",
      items: [
        {
          href: "/umate/account/profile",
          icon: UserCircle2,
          iconColor: "text-[#00aff0]",
          label: "Perfil público",
          desc: "Nombre, bio, foto de perfil y portada",
        },
        {
          href: "/umate/account/pricing",
          icon: Tag,
          iconColor: "text-amber-400",
          label: "Tarifa mensual",
          desc: creatorFull?.monthlyPriceCLP
            ? `$${creatorFull.monthlyPriceCLP.toLocaleString("es-CL")} / mes`
            : "Define tu precio de suscripción",
        },
      ],
    },
    {
      title: "Contenido y fans",
      items: [
        {
          href: "/umate/account/creator",
          icon: LayoutDashboard,
          iconColor: "text-violet-400",
          label: "Dashboard",
          desc: "Resumen general de tu cuenta",
        },
        {
          href: "/umate/account/content",
          icon: FileStack,
          iconColor: "text-pink-400",
          label: "Publicaciones",
          desc: "Crea y gestiona tu contenido",
        },
        {
          href: "/umate/account/subscribers",
          icon: Users2,
          iconColor: "text-emerald-400",
          label: "Suscriptores",
          desc: "Lista de fans activos",
        },
      ],
    },
    {
      title: "Ganancias",
      items: [
        {
          href: "/umate/account/wallet",
          icon: Wallet,
          iconColor: "text-emerald-400",
          label: "Ingresos",
          desc: "Saldo, pagos y retiros",
        },
        {
          href: "/umate/account/stats",
          icon: BarChart3,
          iconColor: "text-[#00aff0]",
          label: "Estadísticas",
          desc: "Vistas, conversión y tendencias",
        },
      ],
    },
    {
      title: "Cuenta",
      items: [
        {
          href: "/umate/account/legal",
          icon: ShieldCheck,
          iconColor: pendingChecks > 0 ? "text-amber-400" : "text-emerald-400",
          label: "Legal y cumplimiento",
          desc: pendingChecks > 0 ? `${pendingChecks} pendiente${pendingChecks > 1 ? "s" : ""}` : "Todo al día",
          badge: pendingChecks > 0 ? String(pendingChecks) : undefined,
        },
        {
          href: "/",
          icon: ExternalLink,
          iconColor: "text-white/40",
          label: "Volver a UZEED",
          desc: "Ir a la plataforma principal",
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Cuenta y ajustes</h1>
        <p className="mt-1 text-sm text-white/30">
          Gestiona tu perfil, contenido, fans y pagos.
        </p>
      </div>

      {pendingChecks > 0 && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4" /> {pendingChecks} pendiente
            {pendingChecks > 1 ? "s" : ""} para activar tu cuenta
          </div>
          <p className="mt-2 text-xs text-white/30">
            Completa el onboarding para poder publicar y recibir suscriptores.
          </p>
          <Link
            href="/umate/onboarding"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/15"
          >
            Continuar registro <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {header}

      {creatorSections.map((section) => (
        <SettingsSection key={section.title} title={section.title} items={section.items} />
      ))}
    </div>
  );
}

function SettingsSection({ title, items }: { title: string; items: SettingsItem[] }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-white/30">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.015]">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] ${
                idx > 0 ? "border-t border-white/[0.03]" : ""
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ${item.iconColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white/80">{item.label}</p>
                <p className="truncate text-[11px] text-white/35">{item.desc}</p>
              </div>
              {item.badge && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
