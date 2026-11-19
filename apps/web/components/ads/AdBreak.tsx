"use client";

import { useEffect, useRef, useState } from "react";
import AdSlot, { type AdSlotName } from "./AdSlot";

/**
 * Pantalla de anuncio con cuenta regresiva (historias, paso a En Vivo).
 *
 * - La cuenta parte cuando el anuncio ya está a la vista: nadie espera
 *   mirando un recuadro vacío.
 * - Si ExoClick no entrega anuncio en `waitForAd` segundos, o el usuario no
 *   ve anuncios (profesionales con sesión, anuncios apagados), se sigue de
 *   inmediato.
 * - Al terminar llama a `onDone` una sola vez; el botón también lo llama
 *   cuando la cuenta llega a cero.
 */
type Props = {
  slot: AdSlotName;
  seconds?: number;
  waitForAd?: number;
  title?: string;
  doneLabel?: string;
  autoContinue?: boolean;
  onDone: () => void;
};

export default function AdBreak({
  slot,
  seconds = 5,
  waitForAd = 3,
  title,
  doneLabel = "Continuar",
  autoContinue = true,
  onDone,
}: Props) {
  const [left, setLeft] = useState<number | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  /* Sin anuncio a tiempo: seguir. */
  useEffect(() => {
    const t = setTimeout(() => {
      setLeft((l) => {
        if (l === null) finish();
        return l;
      });
    }, waitForAd * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitForAd]);

  useEffect(() => {
    if (left === null || left <= 0) {
      if (left === 0 && autoContinue) finish();
      return;
    }
    const t = setTimeout(() => setLeft((l) => (l === null ? l : l - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, autoContinue]);

  return (
    <div className="flex w-full flex-col items-center gap-3 px-3">
      {title && <p className="text-center text-sm font-semibold text-white/80">{title}</p>}
      <AdSlot
        slot={slot}
        width={300}
        height={250}
        fluid
        giveUpAfter={waitForAd}
        onStatus={(s) => {
          if (s === "unavailable") finish();
          else setLeft((l) => (l === null ? seconds : l));
        }}
      />
      <div className="w-full max-w-[492px]">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-[width] duration-1000 ease-linear"
            style={{ width: left === null ? "0%" : `${((seconds - left) / seconds) * 100}%` }}
          />
        </div>
        <button
          type="button"
          disabled={left === null || left > 0}
          onClick={finish}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-white/50"
        >
          {left === null ? "Cargando…" : left > 0 ? `${doneLabel} en ${left}…` : doneLabel}
        </button>
      </div>
    </div>
  );
}
