"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DISCREET_BRAND,
  DISCREET_HTML_CLASS,
  DISCREET_STORAGE_KEY,
  DISCREET_URL_PATH,
  QUICK_EXIT_URL,
} from "../lib/discreet";

type DiscreetValue = {
  discreet: boolean;
  toggle: () => void;
  setDiscreet: (v: boolean) => void;
  /** Salida inmediata: reemplaza la página por un sitio neutro. */
  quickExit: () => void;
};

const DiscreetContext = createContext<DiscreetValue>({
  discreet: false,
  toggle: () => {},
  setDiscreet: () => {},
  quickExit: () => {},
});

export function useDiscreet() {
  return useContext(DiscreetContext);
}

/** Guarda lo real para poder restaurarlo al salir del modo discreto. */
type Original = { title: string; favicon: string | null; themeColor: string | null; url: string };

export default function DiscreetProvider({ children }: { children: React.ReactNode }) {
  const [discreet, setDiscreetState] = useState(false);
  const originalRef = useRef<Original | null>(null);

  const captureOriginal = useCallback((): Original => {
    if (originalRef.current) return originalRef.current;
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    originalRef.current = {
      title: document.title,
      favicon: link?.getAttribute("href") ?? null,
      themeColor: meta?.getAttribute("content") ?? null,
      url: window.location.pathname + window.location.search,
    };
    return originalRef.current;
  }, []);

  /* Aplica o revierte todo lo que vive fuera de React: clase en <html>,
     título, favicon, color de barra y la URL visible. */
  const applyChrome = useCallback(
    (on: boolean) => {
      if (typeof document === "undefined") return;
      const original = captureOriginal();
      const root = document.documentElement;
      root.classList.toggle(DISCREET_HTML_CLASS, on);

      document.title = on ? DISCREET_BRAND.documentTitle : original.title;

      let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      const nextIcon = on ? DISCREET_BRAND.favicon : original.favicon;
      if (nextIcon) link.setAttribute("href", nextIcon);

      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) {
        const nextColor = on ? DISCREET_BRAND.themeColor : original.themeColor;
        if (nextColor) meta.setAttribute("content", nextColor);
      }

      /* replaceState y no pushState: reemplaza la entrada actual, así el
         botón atrás tampoco revela la ruta real. Es lo que el estudio de
         CHI 2023 identifica como la única forma que cumple sus criterios. */
      try {
        window.history.replaceState(
          window.history.state,
          "",
          on ? DISCREET_URL_PATH : original.url,
        );
      } catch {
        /* Algunos navegadores restringen replaceState; el resto del disfraz
           igual se aplica, así que no se interrumpe. */
      }
    },
    [captureOriginal],
  );

  /* Hidratación: se lee la preferencia guardada después del montaje para no
     romper el HTML del servidor. */
  useEffect(() => {
    const saved = window.localStorage.getItem(DISCREET_STORAGE_KEY) === "1";
    if (saved) {
      setDiscreetState(true);
      applyChrome(true);
    }
  }, [applyChrome]);

  /* Si se activa en otra pestaña, esta también se disfraza: dejar una pestaña
     sin disfrazar anularía el propósito. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DISCREET_STORAGE_KEY) return;
      const on = e.newValue === "1";
      setDiscreetState(on);
      applyChrome(on);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyChrome]);

  const setDiscreet = useCallback(
    (on: boolean) => {
      setDiscreetState(on);
      window.localStorage.setItem(DISCREET_STORAGE_KEY, on ? "1" : "0");
      applyChrome(on);
    },
    [applyChrome],
  );

  const toggle = useCallback(() => setDiscreet(!discreet), [discreet, setDiscreet]);

  /* Salida rápida: location.replace no deja la página en el historial, a
     diferencia de un enlace normal o de abrir una pestaña nueva. */
  const quickExit = useCallback(() => {
    try {
      window.localStorage.setItem(DISCREET_STORAGE_KEY, "1");
    } catch {
      /* si el almacenamiento falla igual hay que salir */
    }
    window.location.replace(QUICK_EXIT_URL);
  }, []);

  /* Atajo de teclado: Escape dos veces seguidas dispara la salida rápida.
     Una sola vez no, porque Escape se usa para cerrar modales. */
  useEffect(() => {
    let lastEsc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - lastEsc < 600) {
        lastEsc = 0;
        quickExit();
      } else {
        lastEsc = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickExit]);

  const value = useMemo(
    () => ({ discreet, toggle, setDiscreet, quickExit }),
    [discreet, toggle, setDiscreet, quickExit],
  );

  return <DiscreetContext.Provider value={value}>{children}</DiscreetContext.Provider>;
}
