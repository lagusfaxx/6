"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, LucideIcon } from "lucide-react";

export function TopicHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-6 border-b border-white/[0.06] pb-5">
      <Link
        href="/ayuda"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/50 transition hover:text-fuchsia-300"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al Centro de Ayuda
      </Link>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15 border border-fuchsia-500/25">
          <Icon className="h-5 w-5 text-fuchsia-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white leading-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-white/55 leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
      <div className="space-y-3 text-sm text-white/65 leading-relaxed">{children}</div>
    </section>
  );
}

export function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function StepList({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => (
        <li
          key={idx}
          className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-[11px] font-bold text-fuchsia-300">
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/90">{step.title}</p>
            <div className="mt-0.5 text-xs text-white/55 leading-relaxed">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-fuchsia-500/25 bg-fuchsia-500/[0.06] text-fuchsia-200",
    warn: "border-amber-500/30 bg-amber-500/[0.06] text-amber-200",
    success: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function RelatedLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">También te puede interesar</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 hover:text-fuchsia-200"
          >
            {link.label}
            <ChevronRight className="h-3 w-3 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-300" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-7">{children}</div>;
}
