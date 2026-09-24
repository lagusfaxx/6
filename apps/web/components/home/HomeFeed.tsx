"use client";

/**
 * Cuerpo del home.
 *
 * Antes eran seis bloques apilados (carrusel de novedades + cuatro secciones
 * plegables + grilla de destacadas) antes de llegar al feed real. Cada uno era
 * un riel horizontal distinto sobre el mismo conjunto de perfiles.
 *
 * La evidencia de usabilidad va en contra de eso: en móvil la gente hace
 * scroll, no swipe, y de un carrusel prácticamente solo se ve la primera
 * lámina. Un grid vertical denso de fotos es lo que se escanea bien.
 *
 * Así que el cuerpo queda en dos piezas: la sección Gold (Diamond va más
 * arriba, sobre el mapa) y el grid infinito.
 */

import DestacadasGrid, { type DestacadaProfile } from "./DestacadasGrid";
import InfiniteFeed from "./InfiniteFeed";

type Props = {
  /** Perfiles del plan Gold. Diamond va arriba del mapa, no aquí. */
  goldProfiles: DestacadaProfile[];
};

export default function HomeFeed({ goldProfiles }: Props) {
  const gold = goldProfiles.slice(0, 10);

  return (
    <>
      {/* Cada rango aparece una sola vez: Diamond sobre el mapa y Gold aquí.
          Repetirlos en las dos zonas mostraba a la misma persona dos veces. */}
      {gold.length > 0 && <DestacadasGrid profiles={gold} tier="GOLD" />}

      <InfiniteFeed categorySlug="escort,masajes" />
    </>
  );
}
