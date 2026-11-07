/**
 * Contenido SEO propio para cada landing geográfica: /escorts/{comuna} (las
 * 346 comunas de Chile) y /escorts/region-{region} (las 16 regiones).
 *
 * Una plantilla con sólo el nombre cambiado es contenido duplicado para
 * Google. Acá cada página arma su texto con datos reales de su comuna:
 * provincia, región, distancia a la capital regional y a Santiago, comunas
 * vecinas (con su distancia), la ciudad grande más cercana y si la comuna es
 * parte del Gran Santiago, una capital regional o un pueblo. Las frases
 * cambian según la comuna (variante fija por slug) para que dos comunas
 * parecidas no queden con el mismo texto.
 */

import { CITY_LANDINGS, MAIN_CITY_LANDINGS, type CityGeo } from "./cities";
import {
  CHILE_REGIONS,
  GRAN_SANTIAGO,
  comunasOfRegion,
  geoDistanceKm,
  getChileComuna,
  nearestChileComunas,
  provincesOfRegion,
  regionByKey,
  type ChileComuna,
  type ChileRegion,
} from "./chileGeo";

export type GeoLink = { href: string; label: string; km?: number };
export type GeoFaq = { question: string; answer: string };

export type GeoSeo = {
  heading: string;
  paragraphs: string[];
  facts: { label: string; value: string }[];
  faq: GeoFaq[];
  /** Comunas vecinas con landing propia, de la más cercana a la más lejana. */
  nearby: GeoLink[];
  /** Otras comunas de la misma provincia. */
  province?: { name: string; links: GeoLink[] };
  region?: ChileRegion;
  /** Enlaces extra (región, moteles, landings de servicio). */
  related: GeoLink[];
};

const ADULTS =
  "Todas las personas publicadas son mayores de 18 años y verificaron su identidad.";

const SANTIAGO = getChileComuna("santiago-centro")!;
const CITY_SLUGS = new Set(CITY_LANDINGS.map((c) => c.slug));
const MAIN_BY_SLUG = new Map(MAIN_CITY_LANDINGS.map((c) => [c.slug, c]));
/** Nombre de la landing ("Santiago Centro" para la comuna de Santiago). */
const LANDING_NAME = new Map(CITY_LANDINGS.map((c) => [c.slug, c.name]));
const nameOf = (c: ChileComuna) => LANDING_NAME.get(c.slug) ?? c.name;

/** Variante estable por slug, para alternar redacciones entre comunas. */
function variant(slug: string, n: number) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % n;
}

function km(n: number) {
  if (n < 10) return `${n.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(n).toLocaleString("es-CL")} km`;
}

function listEs(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** "la provincia de Santiago", "la provincia del Biobío". */
export function provinceLabel(p: string) {
  return /^(Biobío|Loa|Tamarugal|Elqui|Limarí|Choapa|Maipo|Ranco)$/.test(p) ? `la provincia del ${p}` : `la provincia de ${p}`;
}

/** Comuna de chileGeo para una landing (Santiago y Chiloé no son comunas). */
function comunaForCity(city: CityGeo): ChileComuna {
  return getChileComuna(city.slug) ?? nearestChileComunas(city.lat, city.lng, 1)[0].comuna;
}

/** Ciudad principal más cercana (con más perfiles), distinta de la propia. */
function nearestMainCity(city: CityGeo) {
  let best: CityGeo | undefined;
  let bestKm = Infinity;
  for (const c of MAIN_CITY_LANDINGS) {
    if (c.slug === city.slug || c.slug === "santiago") continue;
    const d = geoDistanceKm(city.lat, city.lng, c.lat, c.lng);
    if (d < bestKm) {
      best = c;
      bestKm = d;
    }
  }
  return best ? { city: best, km: bestKm } : undefined;
}

export function regionHref(r: ChileRegion) {
  return `/escorts/${r.slug}`;
}

/**
 * Texto, datos y enlaces de una landing de ciudad o comuna.
 * `hasProfiles` = hay escorts publicadas dentro del radio de la landing.
 */
export function buildCityGeoSeo(city: CityGeo, hasProfiles: boolean): GeoSeo {
  const comuna = comunaForCity(city);
  const region = regionByKey(comuna.region)!;
  const capitalComuna = getChileComuna(region.capital)!;
  const capital = { ...capitalComuna, name: nameOf(capitalComuna) };
  const isMetroHub = city.slug === "santiago";
  const isComuna = Boolean(getChileComuna(city.slug));
  const isCapital = isComuna && region.capital === city.slug;
  const inGranSantiago = GRAN_SANTIAGO.has(city.slug);
  const dCapital = geoDistanceKm(city.lat, city.lng, capital.lat, capital.lng);
  const dSantiago = geoDistanceKm(city.lat, city.lng, SANTIAGO.lat, SANTIAGO.lng);
  const v = variant(city.slug, 3);

  const near = nearestChileComunas(city.lat, city.lng, 12, city.slug)
    .filter((n) => CITY_SLUGS.has(n.comuna.slug))
    .slice(0, 10);
  const nearNames = near.slice(0, 3).map((n) => nameOf(n.comuna));
  const main = nearestMainCity(city);
  const isMain = Boolean(MAIN_BY_SLUG.get(city.slug));
  /* Pueblo lejos de las ciudades con oferta: lo dice y apunta a la más cercana. */
  const remote = !isMain && !inGranSantiago && main !== undefined && main.km > 15;

  const paragraphs: string[] = [];

  // ── Ubicación ──
  if (isMetroHub) {
    paragraphs.push(
      `Santiago es la capital de Chile y la ciudad con más escorts del país. El Gran Santiago agrupa ${GRAN_SANTIAGO.size} comunas de la ${region.fullName}; cada una tiene su propia página en UZEED con las escorts que atienden ahí.`,
    );
  } else if (city.slug === "santiago-centro") {
    paragraphs.push(
      "Santiago Centro es la comuna de la Plaza de Armas, el casco histórico y el principal nudo de metro de la capital (líneas 1, 2, 3 y 5). Junto a Providencia y Las Condes, es una de las zonas de la capital con más perfiles publicados.",
    );
  } else if (!isComuna) {
    paragraphs.push(
      `${city.name} está en ${provinceLabel(comuna.province)}, ${region.fullName}, a ${km(dCapital)} de ${capital.name}. La provincia tiene ${comunasOfRegion(region.key).filter((c) => c.province === comuna.province).length} comunas: ${listEs(comunasOfRegion(region.key).filter((c) => c.province === comuna.province).map(nameOf))}.`,
    );
  } else if (isCapital) {
    paragraphs.push(
      [
        `${city.name} es la capital de la ${region.fullName} (${region.numeral}) y la ciudad donde se publica la mayor parte de los perfiles de la región${dSantiago > 50 ? `, a ${km(dSantiago)} de Santiago` : ""}.`,
        `Como capital regional, ${city.name} concentra el comercio, los hoteles y la mayoría de las escorts de la ${region.fullName}${dSantiago > 50 ? `; está a ${km(dSantiago)} de Santiago` : ""}.`,
        `${city.name}, capital de la ${region.label}, es donde más escorts atienden en la zona${dSantiago > 50 ? `, a ${km(dSantiago)} al ${city.lat > SANTIAGO.lat ? "norte" : "sur"} de Santiago` : ""}.`,
      ][v],
    );
  } else if (inGranSantiago) {
    paragraphs.push(
      [
        `${city.name} es una de las comunas del Gran Santiago, en ${provinceLabel(comuna.province)}, a ${km(dCapital)} de la Plaza de Armas. Limita o está muy cerca de ${listEs(nearNames)}.`,
        `${city.name} forma parte del Gran Santiago (${provinceLabel(comuna.province)}) y queda a ${km(dCapital)} del centro de la capital. Sus comunas vecinas más cercanas son ${listEs(nearNames)}.`,
        `Ubicada a ${km(dCapital)} de Santiago Centro, ${city.name} es parte de la ciudad continua del Gran Santiago, junto a ${listEs(nearNames)}.`,
      ][v],
    );
  } else {
    const toSantiago = region.key !== "metropolitana" && dSantiago < 900 ? ` y a ${km(dSantiago)} de Santiago` : "";
    paragraphs.push(
      [
        `${city.name} es una comuna de ${provinceLabel(comuna.province)}, en la ${region.fullName}, a ${km(dCapital)} de ${capital.name}${toSantiago}. Las comunas más cercanas son ${listEs(nearNames)}.`,
        `La comuna de ${city.name} está en ${provinceLabel(comuna.province)} (${region.fullName}). Queda a ${km(dCapital)} de la capital regional, ${capital.name}${toSantiago}, y cerca de ${listEs(nearNames)}.`,
        `${city.name} pertenece a ${provinceLabel(comuna.province)}, ${region.label}. Está a ${km(dCapital)} de ${capital.name}${toSantiago}; sus vecinas más próximas son ${listEs(nearNames)}.`,
      ][v],
    );
  }

  // ── Qué muestra la página ──
  paragraphs.push(
    hasProfiles
      ? [
          `Acá ves las escorts que atienden en ${city.name} y alrededores, ordenadas por cercanía: primero las de la comuna y después las de ${listEs(nearNames)}. Cada ficha muestra fotos verificadas, tarifa, horario y si recibe en departamento propio, va a domicilio o a hotel.`,
          `El listado parte por las escorts publicadas en ${city.name} y sigue con las de las comunas vecinas. En cada perfil están las fotos reales, los servicios, la tarifa y el WhatsApp para escribirle directo.`,
          `Las escorts de ${city.name} aparecen primero; después, las de ${listEs(nearNames)}. Filtra por disponibilidad inmediata, atención a domicilio o servicios, y escríbele directo por WhatsApp o por el chat de UZEED.`,
        ][v]
      : `Por ahora no hay escorts publicadas dentro de ${city.name}. Abajo están las más cercanas, con su ciudad y la distancia real${main ? `; la mayor oferta de la zona está en ${main.city.name}, a ${km(main.km)}` : ""}.`,
  );

  // ── Consejo según el tipo de lugar ──
  if (remote && main) {
    paragraphs.push(
      [
        `${city.name} es una comuna pequeña: la mayoría de las escorts que atienden en la zona viven en ${main.city.name} (a ${km(main.km)}). Varias viajan a domicilio u hotel; revisa en su ficha si cobra traslado y confírmalo por WhatsApp antes de reservar.`,
        `En comunas como ${city.name} lo más común es coordinar con una escort de ${main.city.name}, a ${km(main.km)}, que atienda a domicilio. El valor del traslado se conversa aparte: pregúntalo antes.`,
        `Si no encuentras disponibilidad en ${city.name}, prueba en ${main.city.name} (${km(main.km)}): es la ciudad con más perfiles cerca, y varias de sus escorts atienden a domicilio en las comunas de alrededor.`,
      ][v],
    );
  } else if (inGranSantiago && !isMetroHub) {
    paragraphs.push(
      [
        `En el Gran Santiago muchas escorts atienden en más de una comuna: si en ${city.name} no hay disponibilidad a la hora que buscas, revisa ${listEs(nearNames.slice(0, 2))}, a pocos minutos.`,
        `Moverse dentro del Gran Santiago es rápido, así que también te sirven las escorts de ${listEs(nearNames.slice(0, 2))}. Cada ficha dice en qué sector atiende y si va a domicilio.`,
        `Para una cita discreta en ${city.name}, filtra por "a domicilio" o busca las que reciben en departamento propio cerca de tu sector. Las de ${listEs(nearNames.slice(0, 2))} también quedan a pocos minutos.`,
      ][v],
    );
  } else if (!isMetroHub) {
    paragraphs.push(
      `Además de ${city.name}, en la ${region.label} hay perfiles publicados en ${listEs(
        MAIN_CITY_LANDINGS.filter((c) => c.region === region.name && c.slug !== city.slug && c.slug !== "santiago")
          .slice(0, 4)
          .map((c) => c.name),
      ) || capital.name}. Cada una tiene su página con las escorts que atienden ahí.`,
    );
  }

  paragraphs.push(`${ADULTS} UZEED no cobra comisión: el trato es directo entre tú y la escort.`);

  // ── Datos ──
  const facts: GeoSeo["facts"] = [];
  if (isComuna) facts.push({ label: "Provincia", value: comuna.province });
  facts.push({ label: "Región", value: `${region.fullName} (${region.numeral})` });
  if (!isCapital && !isMetroHub) facts.push({ label: `Distancia a ${capital.name}`, value: km(dCapital) });
  if (region.key !== "metropolitana" && !isMetroHub) facts.push({ label: "Distancia a Santiago", value: km(dSantiago) });
  if (main && remote) facts.push({ label: "Ciudad con más perfiles cerca", value: `${main.city.name} (${km(main.km)})` });

  // ── FAQ ──
  const faq: GeoFaq[] = [
    {
      question: `¿Hay escorts en ${city.name}?`,
      answer: hasProfiles
        ? `Sí. En UZEED hay escorts verificadas que atienden en ${city.name} y sus alrededores, con fotos reales y contacto directo por WhatsApp. Las disponibles hoy aparecen primero.`
        : `Por ahora no hay perfiles publicados dentro de ${city.name}${main ? `. Las más cercanas están en ${main.city.name}, a ${km(main.km)}, y varias atienden a domicilio` : ""}.`,
    },
    {
      question: `¿Qué comunas están cerca de ${city.name}?`,
      answer: `${listEs(near.slice(0, 4).map((n) => `${nameOf(n.comuna)} (${km(n.km)})`))}. Cada una tiene su página de escorts en UZEED.`,
    },
    {
      question: `¿Hay escorts a domicilio en ${city.name}?`,
      answer:
        hasProfiles && !remote
          ? `Sí, varias escorts atienden a domicilio u hotel en ${city.name}. En cada perfil se indica si va a domicilio y si cobra traslado; usa el filtro "a domicilio" para ver sólo esas.`
          : `Algunas escorts${main ? ` de ${main.city.name}` : " de la región"} atienden a domicilio y pueden viajar a ${city.name}. El traslado se coordina y se cobra aparte: confírmalo por WhatsApp antes de reservar.`,
    },
  ];
  if (isComuna && !isCapital) {
    faq.push({
      question: `¿En qué región y provincia está ${city.name}?`,
      answer: `${city.name} está en ${provinceLabel(comuna.province)}, ${region.fullName}, a ${km(dCapital)} de ${capital.name}.`,
    });
  }

  // ── Enlaces ──
  const nearby: GeoLink[] = near.map((n) => ({ href: `/escorts/${n.comuna.slug}`, label: nameOf(n.comuna), km: n.km }));
  const nearSet = new Set(near.map((n) => n.comuna.slug));
  const provinceLinks = isComuna
    ? comunasOfRegion(region.key)
        .filter((c) => c.province === comuna.province && c.slug !== city.slug && !nearSet.has(c.slug))
        .map((c) => ({ href: `/escorts/${c.slug}`, label: nameOf(c) }))
    : [];

  const related: GeoLink[] = [
    { href: regionHref(region), label: `Escorts en la ${region.label}` },
  ];
  const capitalHref = `/escorts/${capital.slug === "santiago-centro" ? "santiago" : capital.slug}`;
  if (!isCapital && capitalHref !== `/escorts/${city.slug}`) {
    related.push({ href: capitalHref, label: `Escorts en ${capital.slug === "santiago-centro" ? "Santiago" : capital.name}` });
  }
  related.push(
    { href: "/escorts/a-domicilio", label: "Escorts a domicilio" },
    { href: `/moteles/${isMetroHub ? "santiago" : comuna.slug}`, label: `Moteles ${isMetroHub || isComuna ? "en" : "cerca de"} ${isMetroHub ? "Santiago" : comuna.name}` },
    { href: "/masajistas", label: "Masajistas eróticas" },
  );

  return {
    heading: isMetroHub ? "Escorts en Santiago por comuna" : `Escorts en ${city.name}, ${region.name}`,
    paragraphs,
    facts,
    faq,
    nearby,
    province: provinceLinks.length ? { name: comuna.province, links: provinceLinks } : undefined,
    region,
    related,
  };
}

/** Texto, provincias y comunas de una landing de región. */
export function buildRegionGeoSeo(region: ChileRegion) {
  const provinces = provincesOfRegion(region.key);
  const comunas = comunasOfRegion(region.key);
  const capital = getChileComuna(region.capital)!;
  const capitalHref = `/escorts/${capital.slug === "santiago-centro" ? "santiago" : capital.slug}`;
  const capitalName = capital.slug === "santiago-centro" ? "Santiago" : capital.name;
  const mains = MAIN_CITY_LANDINGS.filter((c) => c.region === region.name && c.slug !== "santiago");
  const idx = CHILE_REGIONS.findIndex((r) => r.key === region.key);
  const neighbours = [CHILE_REGIONS[idx - 1], CHILE_REGIONS[idx + 1]].filter(Boolean) as ChileRegion[];
  const dSantiago = geoDistanceKm(capital.lat, capital.lng, SANTIAGO.lat, SANTIAGO.lng);

  const paragraphs = [
    region.intro,
    `La ${region.fullName} tiene ${comunas.length} comunas agrupadas en ${provinces.length} ${provinces.length === 1 ? "provincia" : "provincias"} (${listEs(provinces.map((p) => p.name))}). Cada comuna tiene su página en UZEED con las escorts que atienden ahí y, si no hay perfiles publicados, las más cercanas con su distancia real.`,
    region.key === "metropolitana"
      ? `La capital es ${capitalName}. Desde esta página puedes ir a cualquiera de las ${comunas.length} comunas de la región, de Santiago Centro a Melipilla o San José de Maipo.`
      : `La capital regional es ${capitalName}, a ${km(dSantiago)} de Santiago${mains.length > 1 ? `, y las ciudades con más perfiles son ${listEs(mains.slice(0, 5).map((c) => c.name))}` : ""}.`,
    `${ADULTS} Los perfiles muestran fotos reales, tarifas, horario y contacto directo por WhatsApp, sin intermediarios.`,
  ];

  const faq: GeoFaq[] = [
    {
      question: `¿Dónde hay más escorts en la ${region.label}?`,
      answer: `La mayor oferta está en ${listEs((mains.length ? mains : [{ name: capitalName }]).slice(0, 3).map((c) => c.name))}. Activa tu ubicación en UZEED para ver los perfiles ordenados por distancia.`,
    },
    {
      question: `¿Cuántas comunas tiene la ${region.fullName}?`,
      answer: `${comunas.length} comunas en ${provinces.length} ${provinces.length === 1 ? "provincia" : "provincias"}: ${listEs(provinces.map((p) => `${p.name} (${p.comunas.length})`))}.`,
    },
    {
      question: `¿Hay escorts a domicilio en la ${region.label}?`,
      answer: `Sí. Varias escorts de ${capitalName} y de las ciudades grandes de la región atienden a domicilio u hotel; cada ficha dice si se traslada y si cobra aparte.`,
    },
  ];

  return {
    heading: `Escorts en la ${region.label}`,
    paragraphs,
    faq,
    capital: { href: capitalHref, name: capitalName, lat: capital.lat, lng: capital.lng },
    provinces: provinces.map((p) => ({
      name: p.name,
      links: p.comunas.map((c) => ({ href: `/escorts/${c.slug}`, label: nameOf(c) })),
    })),
    neighbours: neighbours.map((r) => ({ href: regionHref(r), label: `Escorts en ${r.name}` })),
    allRegions: CHILE_REGIONS.filter((r) => r.key !== region.key).map((r) => ({ href: regionHref(r), label: r.name })),
  };
}

export function regionForCity(city: CityGeo): ChileRegion {
  return regionByKey(comunaForCity(city).region)!;
}
