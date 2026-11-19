"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import AdBreak from "../../components/ads/AdBreak";

/*
 * Paso a En Vivo. "En Vivo" lleva a las cámaras de live.uzeed.cl; antes de
 * salir se muestra un anuncio de 5 segundos y después se sigue en la misma
 * pestaña (sin ventana nueva, así el navegador no lo bloquea).
 * Si no hay anuncio a tiempo, o el usuario no ve anuncios, se sigue directo.
 */
const LIVE_URL = "https://live.uzeed.cl/south-american-cams/female/";

export default function LiveGatePage() {
  const [leaving, setLeaving] = useState(false);
  /* En la primera visita el aviso de mayoría de edad tapa la pantalla: la
     cuenta del anuncio parte recién cuando se acepta. */
  const [ageOk, setAgeOk] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        return Boolean(localStorage.getItem("uzeed:ageVerified"));
      } catch {
        return true;
      }
    };
    if (check()) return setAgeOk(true);
    const id = setInterval(() => {
      if (check()) {
        setAgeOk(true);
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    /* Que las cámaras empiecen a cargar mientras se ve el anuncio. */
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://live.uzeed.cl";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const go = () => {
    setLeaving(true);
    window.location.replace(LIVE_URL);
  };

  return (
    <div className="flex flex-col items-center bg-[#070816] px-1 pt-2 pb-28 text-white">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        <h1 className="flex items-center gap-1.5 text-lg font-bold">
          <Radio className="h-5 w-5 text-red-400" /> En Vivo
        </h1>
      </div>

      {leaving ? (
        <p className="text-sm text-white/60">Entrando a las cámaras…</p>
      ) : !ageOk ? null : (
        <AdBreak slot="liveGate" seconds={5} doneLabel="Ver cámaras en vivo" title="Tu live empieza en unos segundos" onDone={go} />
      )}
    </div>
  );
}
