"use client";

import { useEffect, useRef, useState } from "react";

const WHITELABEL_URL = "https://live.uzeed.cl";

export function LiveIframe() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setLoading((isLoading) => {
        if (isLoading) setError(true);
        return false;
      });
    }, 15000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        gtag?: (...args: unknown[]) => void;
      };
      w.gtag?.("event", "live_iframe_loaded", {
        event_category: "engagement",
        event_label: "whitelabel_iframe",
      });
    }
  };

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading((isLoading) => {
        if (isLoading) setError(true);
        return false;
      });
    }, 15000);
    if (iframeRef.current) {
      iframeRef.current.src = WHITELABEL_URL;
    }
  };

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
        <div className="text-center max-w-md">
          <p className="text-white text-lg mb-3">
            No pudimos cargar las transmisiones en vivo
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Esto puede deberse a una conexion lenta o un problema temporal.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            >
              Reintentar
            </button>
            <a
              href={WHITELABEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Abrir en pantalla completa ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-purple-300 text-sm">
              Cargando transmisiones en vivo...
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={WHITELABEL_URL}
        title="Cams en vivo - Uzeed Live"
        className="absolute inset-0 w-full h-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
        loading="eager"
        onLoad={handleLoad}
      />

      {!loading && (
        <a
          href={WHITELABEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white text-xs rounded-full transition-colors flex items-center gap-1.5"
          title="Abrir en pantalla completa"
        >
          <span>Pantalla completa</span>
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </a>
      )}
    </>
  );
}
