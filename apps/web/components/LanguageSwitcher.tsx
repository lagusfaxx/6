"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Globe, Check } from "lucide-react";

/* Traducción automática de toda la app con Google Translate.
   El sitio está escrito en español; al elegir inglés o portugués se guarda la
   cookie `googtrans` (que es la que lee el widget de Google) y se recarga la
   página. El script de Google sólo se carga cuando hay un idioma distinto al
   español, así que quien navega en español no paga ningún costo extra. */

export type Lang = "es" | "en" | "pt";

export const LANGUAGES: { code: Lang; short: string; label: string }[] = [
  { code: "es", short: "ES", label: "Español" },
  { code: "en", short: "EN", label: "English" },
  { code: "pt", short: "PT", label: "Português" },
];

const COOKIE = "googtrans";

function readLang(): Lang {
  if (typeof document === "undefined") return "es";
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  const target = match ? decodeURIComponent(match[1]).split("/").pop() : "";
  return target === "en" || target === "pt" ? target : "es";
}

/* Google puede dejar la cookie en el host o en el dominio padre (.uzeed.cl):
   se escribe/borra en ambos para que no quede una versión vieja pegada. */
function cookieDomains(): (string | null)[] {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains: (string | null)[] = [null];
  if (parts.length >= 2 && !/^\d+(\.\d+){3}$/.test(host)) {
    domains.push(host, `.${parts.slice(-2).join(".")}`);
  }
  return domains;
}

function writeLang(lang: Lang) {
  const maxAge = lang === "es" ? "max-age=0" : "max-age=31536000";
  const value = lang === "es" ? "" : `/es/${lang}`;
  for (const domain of cookieDomains()) {
    document.cookie = `${COOKIE}=${value}; path=/; ${maxAge}${domain ? `; domain=${domain}` : ""}`;
  }
}

/* Google Translate reemplaza nodos de texto dentro del DOM que maneja React y
   eso provoca errores "removeChild/insertBefore: not a child of this node".
   Este parche (el recomendado en el issue de React) ignora esas operaciones
   sobre nodos que ya no están donde React cree. */
function patchDomForTranslation() {
  const w = window as unknown as { __uzeedDomPatched?: boolean };
  if (w.__uzeedDomPatched || typeof Node !== "function") return;
  w.__uzeedDomPatched = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    setLangState(readLang());
  }, []);

  const setLang = (next: Lang) => {
    if (next === readLang()) return;
    writeLang(next);
    window.location.reload();
  };

  return { lang, setLang };
}

/* Monta el widget oculto de Google. Va una sola vez, en el layout raíz. */
export function TranslateLoader() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const lang = readLang();
    if (lang === "es") return;
    patchDomForTranslation();
    (window as unknown as { googleTranslateElementInit: () => void }).googleTranslateElementInit = () => {
      type TranslateCtor = new (opts: Record<string, unknown>, elementId: string) => unknown;
      const g = (window as unknown as { google?: { translate?: { TranslateElement?: TranslateCtor } } }).google;
      const TranslateElement = g?.translate?.TranslateElement;
      if (!TranslateElement) return;
      new TranslateElement(
        { pageLanguage: "es", includedLanguages: "en,pt", autoDisplay: false },
        "google_translate_element",
      );
    };
    setActive(true);
  }, []);

  if (!active) return null;
  return (
    <>
      <div id="google_translate_element" className="hidden" aria-hidden="true" />
      <Script
        id="google-translate"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}

/* Botón compacto con menú desplegable, pensado para la cabecera. */
export function LanguageMenu({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className={`relative notranslate ${className}`} ref={ref} translate="no">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Idioma: ${current.label}`}
        aria-expanded={open}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/10 md:h-10 md:px-3 md:text-xs"
      >
        <Globe className="h-4 w-4" />
        <span>{current.short}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-xl border border-white/15 bg-[#0d0e1a] py-1 shadow-[0_18px_48px_rgba(0,0,0,0.6)] md:top-12">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setOpen(false);
                setLang(l.code);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/10 ${l.code === lang ? "text-fuchsia-300" : "text-white/80"}`}
            >
              <span className="w-6 text-[11px] font-semibold text-white/40">{l.short}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === lang && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Fila de botones de idioma. `short` muestra sólo ES / EN / PT, para
   espacios angostos como la barra lateral de escritorio. */
export function LanguagePills({ short = false }: { short?: boolean }) {
  const { lang, setLang } = useLanguage();
  return (
    <div className="notranslate grid grid-cols-3 gap-1.5" translate="no">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={l.code === lang}
          aria-label={l.label}
          title={l.label}
          className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
            l.code === lang
              ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300"
              : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
          }`}
        >
          {short ? l.short : l.label}
        </button>
      ))}
    </div>
  );
}
