"use client";

import { useState } from "react";

const highlights = [
  {
    text: "Contacto directo vía WhatsApp",
    description: "Escríbele al instante desde su perfil.",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2a8 8 0 0 0-6.93 12l-.87 3.2a.5.5 0 0 0 .6.6l3.2-.87A8 8 0 1 0 10 2Z" fill="currentColor" />
      </svg>
    ),
    gradient: "from-emerald-500/20 to-emerald-600/20",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    text: "Perfiles verificados",
    description: "Revisados y aprobados por el equipo.",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1l2.39 4.84L18 6.71l-4 3.9.94 5.5L10 13.47 5.06 16.1 6 10.6l-4-3.9 5.61-.86L10 1Z" fill="currentColor" />
      </svg>
    ),
    gradient: "from-fuchsia-500/20 to-violet-600/20",
    border: "border-fuchsia-500/20",
    iconColor: "text-fuchsia-400",
  },
  {
    text: "Ubicación aproximada",
    description: "Zona visible, dirección privada.",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2a5.5 5.5 0 0 0-5.5 5.5C4.5 12.25 10 18 10 18s5.5-5.75 5.5-10.5A5.5 5.5 0 0 0 10 2Zm0 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" fill="currentColor" />
      </svg>
    ),
    gradient: "from-sky-500/20 to-blue-600/20",
    border: "border-sky-500/20",
    iconColor: "text-sky-400",
  },
] as const;

const steps = [
  { number: "1", title: "Explora", text: "Descubre perfiles y servicios cerca de ti." },
  { number: "2", title: "Contacta", text: "Escribe por WhatsApp o envía una solicitud desde el perfil." },
  { number: "3", title: "Coordina", text: "Acuerda los detalles directamente con la profesional." },
] as const;

const accordionItems = [
  {
    title: "Contacto directo",
    lines: [
      "El WhatsApp de cada profesional está visible en su perfil.",
      "Puedes escribir directamente desde la tarjeta del perfil.",
      "También puedes enviar solicitudes desde el chat interno.",
      "UZEED facilita el contacto; no intermedia pagos.",
    ],
  },
  {
    title: "Verificaciones",
    lines: [
      "Verificada: perfil revisado y aprobado por administración.",
      "Premium: perfiles destacados seleccionados para la sección Premium.",
      "Exámenes: etiqueta asignada por administración según documentación.",
      "Solo administración puede asignar estas etiquetas.",
    ],
  },
  {
    title: "Privacidad y seguridad",
    lines: [
      "Se muestra la zona, no la dirección exacta.",
      "Datos personales protegidos y control total de visibilidad.",
      "Opciones de bloquear y reportar usuarios.",
      "Coordinación final directa entre las partes.",
    ],
  },
] as const;

function AccordionItem({ title, lines }: { title: string; lines: readonly string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-sm font-semibold text-white/90 sm:text-[15px]">{title}</span>
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
          open
            ? "border-fuchsia-500/40 bg-fuchsia-500/15 rotate-180"
            : "border-white/10 bg-white/[0.04]"
        }`}>
          <svg
            className={`h-3 w-3 transition-colors duration-200 ${open ? "text-fuchsia-400" : "text-white/40"}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="pb-4 pl-1 space-y-2">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/60">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-500/50" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HomeCreAccordion() {
  return (
    <section className="mx-auto mt-10 w-full max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 rounded-full bg-fuchsia-500/[0.06] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/30 to-transparent" />

        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/20">
              <svg className="h-5 w-5 text-fuchsia-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.049 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.949-.69l1.3-3.957z" fill="currentColor" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Guía rápida
            </h2>
            <p className="mt-2 text-sm text-white/50 sm:text-base">
              Conecta con profesionales en 3 simples pasos
            </p>
          </div>

          {/* Steps — 1-2-3 */}
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.number}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all duration-300 hover:border-fuchsia-500/20 hover:bg-white/[0.05]"
              >
                <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-fuchsia-500/[0.04] blur-2xl transition-all group-hover:bg-fuchsia-500/[0.08]" />
                <div className="relative">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/30 to-violet-600/30 text-sm font-bold text-fuchsia-300 border border-fuchsia-500/20">
                    {s.number}
                  </div>
                  <h3 className="text-sm font-bold text-white">{s.title}</h3>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">{s.text}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden text-white/10 sm:block">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Highlights — feature cards */}
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {highlights.map((h) => (
              <div
                key={h.text}
                className={`relative overflow-hidden rounded-2xl border ${h.border} bg-gradient-to-br ${h.gradient} p-4 transition-all duration-300 hover:scale-[1.02]`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/20 ${h.iconColor}`}>
                    {h.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{h.text}</div>
                    <div className="mt-0.5 text-xs text-white/50">{h.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ accordion */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5">
            {accordionItems.map((item) => (
              <AccordionItem key={item.title} title={item.title} lines={item.lines} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
