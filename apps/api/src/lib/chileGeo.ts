/**
 * Geografía de Chile para estadísticas: región → comunas, más una
 * normalización de lo que la gente escribe en `city` ("Stgo centro",
 * "viña", "Las Condes, Santiago") a comuna, ciudad y región.
 *
 * "Ciudad" agrupa: las comunas del Gran Santiago son ciudad "Santiago";
 * en el resto del país ciudad = comuna. Lo que no calza queda como
 * "(sin normalizar)" con el texto original, para que no desaparezca.
 */

export const REGIONS: { region: string; comunas: string[] }[] = [
  { region: "Arica y Parinacota", comunas: ["Arica", "Camarones", "Putre", "General Lagos"] },
  { region: "Tarapacá", comunas: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"] },
  { region: "Antofagasta", comunas: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"] },
  { region: "Atacama", comunas: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"] },
  { region: "Coquimbo", comunas: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"] },
  { region: "Valparaíso", comunas: ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar", "Quillota", "La Calera", "Hijuelas", "La Cruz", "Nogales", "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Limache", "Olmué", "Villa Alemana"] },
  { region: "Metropolitana", comunas: ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"] },
  { region: "O'Higgins", comunas: ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones", "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"] },
  { region: "Maule", comunas: ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"] },
  { region: "Ñuble", comunas: ["Chillán", "Bulnes", "Chillán Viejo", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio", "Yungay", "Quirihue", "Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Ránquil", "Treguaco", "San Carlos", "Coihueco", "Ñiquén", "San Fabián", "San Nicolás"] },
  { region: "Biobío", comunas: ["Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Hualpén", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío"] },
  { region: "Araucanía", comunas: ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"] },
  { region: "Los Ríos", comunas: ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "La Unión", "Futrono", "Lago Ranco", "Río Bueno"] },
  { region: "Los Lagos", comunas: ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"] },
  { region: "Aysén", comunas: ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"] },
  { region: "Magallanes", comunas: ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica", "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine"] },
];

/** Comunas que forman el Gran Santiago: su "ciudad" es Santiago. */
const GRAN_SANTIAGO = new Set([
  "Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia",
  "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo",
  "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura",
  "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto",
  "San Bernardo", "Padre Hurtado",
]);

/** Cómo escribe la gente algunas comunas. Se comparan ya normalizados. */
const ALIASES: Record<string, string> = {
  stgo: "Santiago",
  "stgo centro": "Santiago",
  "santiago centro": "Santiago",
  "santiago de chile": "Santiago",
  "region metropolitana": "Santiago",
  "metropolitana": "Santiago",
  "rm": "Santiago",
  vina: "Viña del Mar",
  "vina del mar": "Viña del Mar",
  valpo: "Valparaíso",
  conce: "Concepción",
  "san pedro de la paz": "San Pedro de la Paz",
  "puerto mont": "Puerto Montt",
  "pto montt": "Puerto Montt",
  "pto varas": "Puerto Varas",
  "pta arenas": "Punta Arenas",
  "la serena": "La Serena",
  antofa: "Antofagasta",
  "los angeles": "Los Ángeles",
  nunoa: "Ñuñoa",
  penalolen: "Peñalolén",
  maipu: "Maipú",
  "estacion central": "Estación Central",
  "san jose de maipo": "San José de Maipo",
  chillan: "Chillán",
  concepcion: "Concepción",
  valparaiso: "Valparaíso",
  copiapo: "Copiapó",
  curico: "Curicó",
  "la calera": "La Calera",
  "calera": "La Calera",
  "coquimbo": "Coquimbo",
  "las condes santiago": "Las Condes",
};

export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMUNA_BY_KEY = new Map<string, { comuna: string; region: string }>();
for (const r of REGIONS) for (const c of r.comunas) COMUNA_BY_KEY.set(foldText(c), { comuna: c, region: r.region });

export type GeoNormalized = {
  comuna: string;
  ciudad: string;
  region: string;
  /** true si no se reconoció; comuna/ciudad llevan el texto original. */
  sinNormalizar?: boolean;
};

const cache = new Map<string, GeoNormalized>();

export function normalizeCity(raw: string | null | undefined): GeoNormalized {
  const original = (raw || "").trim();
  if (!original) return { comuna: "(sin ciudad)", ciudad: "(sin ciudad)", region: "(sin ciudad)", sinNormalizar: true };
  const cached = cache.get(original);
  if (cached) return cached;

  const folded = foldText(original);
  const candidates: string[] = [folded, ...folded.split(/[,/-]| y /).map((s) => s.trim()).filter(Boolean)];
  let hit: { comuna: string; region: string } | undefined;
  for (const cand of candidates) {
    const alias = ALIASES[cand];
    if (alias) {
      hit = COMUNA_BY_KEY.get(foldText(alias));
      if (hit) break;
    }
    hit = COMUNA_BY_KEY.get(cand);
    if (hit) break;
  }
  // Último intento: alguna comuna contenida en el texto ("sector oriente de Las Condes").
  if (!hit) {
    for (const [key, value] of COMUNA_BY_KEY) {
      if (key.length >= 5 && new RegExp(`(^| )${key}( |$)`).test(folded)) {
        hit = value;
        break;
      }
    }
  }
  const result: GeoNormalized = hit
    ? { comuna: hit.comuna, ciudad: GRAN_SANTIAGO.has(hit.comuna) ? "Santiago" : hit.comuna, region: hit.region }
    : { comuna: original, ciudad: original, region: "(sin normalizar)", sinNormalizar: true };
  if (cache.size > 5000) cache.clear();
  cache.set(original, result);
  return result;
}

/** Nombre de región tal como está en REGIONS, a partir de texto libre. */
export function matchRegion(raw: string): string | null {
  const f = foldText(raw).replace(/^region (de |del )?/, "");
  for (const r of REGIONS) {
    const rf = foldText(r.region);
    if (rf === f || rf.startsWith(f) || (f === "rm" && r.region === "Metropolitana")) return r.region;
  }
  return null;
}
