/**
 * Estaciones del Metro de Santiago con sus coordenadas.
 *
 * Sirve para poner en la ficha la referencia que de verdad usa la gente para
 * ubicarse en Santiago: "cerca del metro Tobalaba" dice más que una comuna y
 * mucho más que un punto en el mapa. Se calcula solo desde la dirección que la
 * profesional ya cargó, así que no hay un campo más que llenar.
 *
 * Los datos salen de OpenStreetMap (nodos station=subway del operador Metro
 * S.A., extraídos con Overpass) y las líneas de cada estación de la lista
 * pública de Marfullsen/lista-de-estaciones-metro-santiago. Van fijos en el
 * repositorio a propósito: son 126 puntos que cambian una vez cada varios años
 * y no vale la pena una llamada a un servicio externo en cada visita a un
 * perfil. Cuando abra una línea nueva se agregan acá.
 *
 * Formato: [nombre, latitud, longitud, líneas separadas por coma].
 */
export type MetroStation = readonly [string, number, number, string];

export const METRO_STATIONS: readonly MetroStation[] = [
  ["Alcántara", -33.41545, -70.58999, "1"],
  ["Baquedano", -33.43722, -70.63341, "1,5"],
  ["Barrancas", -33.45298, -70.73904, "5"],
  ["Bellas Artes", -33.43663, -70.64413, "5"],
  ["Bellavista de La Florida", -33.51952, -70.60003, "5"],
  ["Blanqueado", -33.44133, -70.70665, "5"],
  ["Bío Bío", -33.47661, -70.64218, "6"],
  ["Camino Agrícola", -33.49179, -70.61752, "5"],
  ["Cardenal Caro", -33.37326, -70.68634, "3"],
  ["Carlos Valdovinos", -33.4864, -70.61918, "5"],
  ["Cementerios", -33.41398, -70.6436, "2"],
  ["Cerrillos", -33.48343, -70.69556, "6"],
  ["Cerro Blanco", -33.42275, -70.64506, "2"],
  ["Chile España", -33.45491, -70.59814, "3"],
  ["Ciudad del Niño", -33.50954, -70.65665, "2"],
  ["Conchalí", -33.39789, -70.6696, "3"],
  ["Copa Lo Martínez", -33.57067, -70.67338, "2"],
  ["Cristóbal Colón", -33.42632, -70.59098, "4"],
  ["Cumming", -33.43914, -70.66853, "5"],
  ["Del Sol", -33.49024, -70.75312, "5"],
  ["Departamental", -33.50244, -70.65463, "2"],
  ["Dorsal", -33.39696, -70.64274, "2"],
  ["Ecuador", -33.45592, -70.69973, "1"],
  ["Einstein", -33.40595, -70.64317, "2"],
  ["El Bosque", -33.54657, -70.66675, "2"],
  ["El Golf", -33.41662, -70.59571, "1"],
  ["El Llano", -33.4826, -70.64938, "2"],
  ["El Parrón", -33.52643, -70.6614, "2"],
  ["Elisa Correa", -33.56929, -70.58381, "4"],
  ["Escuela Militar", -33.41348, -70.58268, "1"],
  ["Estación Central", -33.45082, -70.67896, "1"],
  ["Estadio Nacional", -33.46238, -70.60622, "6"],
  ["Fernando Castillo Velasco", -33.4521, -70.55811, "3"],
  ["Ferrocarril", -33.36547, -70.70554, "3"],
  ["Francisco Bilbao", -33.43179, -70.5847, "4"],
  ["Franklin", -33.47666, -70.64948, "2,6"],
  ["Grecia", -33.46953, -70.5765, "4"],
  ["Gruta de Lourdes", -33.43801, -70.69103, "5"],
  ["Hernando de Magallanes", -33.40794, -70.55585, "1"],
  ["Hospital El Pino", -33.58288, -70.67681, "2"],
  ["Hospital Sótero del Río", -33.5769, -70.58232, "4"],
  ["Hospitales", -33.41767, -70.65646, "3"],
  ["Inés de Suárez", -33.43872, -70.60734, "6"],
  ["Irarrázaval", -33.45505, -70.62832, "3,5"],
  ["La Cisterna", -33.53735, -70.66433, "2,4A"],
  ["La Granja", -33.54113, -70.61605, "4A"],
  ["La Moneda", -33.44487, -70.65487, "1"],
  ["Laguna Sur", -33.46216, -70.73791, "5"],
  ["Las Mercedes", -33.60138, -70.57748, "4"],
  ["Las Parcelas", -33.47527, -70.73998, "5"],
  ["Las Rejas", -33.45754, -70.70676, "1"],
  ["Las Torres", -33.49911, -70.58655, "4"],
  ["Lo Cruzat", -33.36683, -70.71977, "3"],
  ["Lo Ovalle", -33.51727, -70.65882, "2"],
  ["Lo Prado", -33.44341, -70.71675, "5"],
  ["Lo Valledor", -33.4784, -70.6809, "6"],
  ["Lo Vial", -33.49683, -70.65301, "2"],
  ["Los Dominicos", -33.40789, -70.54499, "1"],
  ["Los Héroes", -33.44619, -70.66045, "1,2"],
  ["Los Leones", -33.42202, -70.60856, "1,6"],
  ["Los Libertadores", -33.36543, -70.69199, "3"],
  ["Los Orientales", -33.46262, -70.57392, "4"],
  ["Los Presidentes", -33.47984, -70.57867, "4"],
  ["Los Quillayes", -33.56123, -70.58527, "4"],
  ["Macul", -33.50924, -70.59005, "4"],
  ["Manquehue", -33.40946, -70.56973, "1"],
  ["Manuel Montt", -33.42855, -70.61965, "1"],
  ["Matta", -33.45827, -70.64308, "3"],
  ["Mirador", -33.5133, -70.60591, "5"],
  ["Monseñor Eyzaguirre", -33.45319, -70.61352, "3"],
  ["Monte Tabor", -33.48229, -70.74544, "5"],
  ["Neptuno", -33.45158, -70.72268, "1"],
  ["Observatorio", -33.5604, -70.67055, "2"],
  ["Pajaritos", -33.45747, -70.71545, "1"],
  ["Parque Almagro", -33.45139, -70.65056, "3"],
  ["Parque Bustamante", -33.4428, -70.63196, "5"],
  ["Parque O'Higgins", -33.46085, -70.65685, "2"],
  ["Patronato", -33.42973, -70.64712, "2"],
  ["Pedrero", -33.50795, -70.61245, "5"],
  ["Pedro de Valdivia", -33.42548, -70.6138, "1"],
  ["Plaza Chacabuco", -33.40677, -70.66097, "3"],
  ["Plaza Egaña", -33.45349, -70.57082, "3,4"],
  ["Plaza Quilicura", -33.36572, -70.72889, "3"],
  ["Plaza de Armas", -33.43742, -70.65128, "3,5"],
  ["Plaza de Maipú", -33.50993, -70.75731, "5"],
  ["Plaza de Puente Alto", -33.60952, -70.57584, "4"],
  ["Presidente Pedro Aguirre Cerda", -33.47869, -70.66479, "6"],
  ["Protectora de la Infancia", -33.58957, -70.57983, "4"],
  ["Príncipe de Gales", -33.4392, -70.57315, "4"],
  ["Pudahuel", -33.44486, -70.74114, "5"],
  ["Puente Cal y Canto", -33.43284, -70.65308, "2,3"],
  ["Quilín", -33.48826, -70.58042, "4"],
  ["Quinta Normal", -33.44037, -70.68029, "5"],
  ["República", -33.4477, -70.66714, "1"],
  ["Rodrigo de Araya", -33.47782, -70.62226, "5"],
  ["Rojas Magallanes", -33.53611, -70.5927, "4"],
  ["Rondizzoni", -33.46966, -70.65637, "2"],
  ["Salvador", -33.43272, -70.62609, "1"],
  ["San Alberto Hurtado", -33.4542, -70.69227, "1"],
  ["San Joaquín", -33.49934, -70.61583, "5"],
  ["San José de la Estrella", -33.55382, -70.58656, "4"],
  ["San Miguel", -33.48872, -70.65107, "2"],
  ["San Pablo", -33.44422, -70.72325, "1,5"],
  ["San Ramón", -33.54123, -70.64313, "4A"],
  ["Santa Ana", -33.43825, -70.6599, "2,5"],
  ["Santa Isabel", -33.44712, -70.63043, "5"],
  ["Santa Julia", -33.5311, -70.60554, "4A"],
  ["Santa Lucía", -33.44246, -70.64474, "1"],
  ["Santa Rosa", -33.54239, -70.63413, "4A"],
  ["Santiago Bueras", -33.49624, -70.75743, "5"],
  ["Simón Bolívar", -33.44618, -70.57193, "4"],
  ["Tobalaba", -33.41822, -70.60149, "1,4"],
  ["Toesca", -33.45297, -70.65859, "2"],
  ["Trinidad", -33.54629, -70.5881, "4"],
  ["Universidad Católica", -33.43976, -70.63989, "1"],
  ["Universidad de Chile", -33.44387, -70.65067, "1,3"],
  ["Universidad de Santiago", -33.45286, -70.68656, "1"],
  ["Unión Latinoamericana", -33.44936, -70.67335, "1"],
  ["Vespucio Norte", -33.38075, -70.64634, "2"],
  ["Vicente Valdés", -33.52642, -70.59679, "4,5"],
  ["Vicuña Mackenna", -33.51976, -70.59621, "4,4A"],
  ["Villa Frei", -33.45467, -70.58148, "3"],
  ["Vivaceta", -33.38538, -70.67964, "3"],
  ["Zapadores", -33.39094, -70.64244, "2"],
  ["Ñuble", -33.46736, -70.62476, "5,6"],
  ["Ñuñoa", -33.45419, -70.60497, "3,6"],];

/**
 * Hasta dónde se considera que un punto está "cerca" de una estación.
 *
 * 1,2 km es algo así como quince minutos a pie: más lejos que eso la
 * referencia deja de ser útil y pasa a ser un adorno que infla el aviso.
 */
export const METRO_MAX_DISTANCE_M = 1200;

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type NearestMetro = {
  /** Nombre de la estación, tal como se anuncia. */
  name: string;
  /** Líneas que pasan por ella, ej. ["1", "4"]. */
  lines: string[];
  /**
   * Distancia real en metros. Queda para uso interno (elegir la estación,
   * ordenar, futuros filtros por cercanía) y NO se publica: ver `publicMetro`.
   */
  distanceM: number;
};

/**
 * Estación más cercana a un punto, o null si no hay ninguna a menos de
 * METRO_MAX_DISTANCE_M.
 */
export function nearestMetroStation(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearestMetro | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let best: NearestMetro | null = null;
  let bestDistance = Infinity;

  for (const [name, stationLat, stationLng, lines] of METRO_STATIONS) {
    const distance = haversineMeters(lat, lng, stationLat, stationLng);
    if (distance >= bestDistance || distance > METRO_MAX_DISTANCE_M) continue;
    bestDistance = distance;
    best = {
      name,
      lines: lines ? lines.split(",") : [],
      distanceM: Math.round(distance),
    };
  }

  return best;
}

/**
 * Lo que se publica de la estación: sólo el nombre y las líneas.
 *
 * La distancia se queda adentro. Es un dato de ubicación: aunque se redondee,
 * cruzarla con el punto desplazado del mapa acota bastante dónde vive la
 * profesional, y en la ficha no aporta nada — "Metro Tobalaba" ya es toda la
 * referencia que el cliente necesita.
 */
export function publicMetro(
  station: NearestMetro | null,
): { name: string; lines: string[] } | null {
  if (!station) return null;
  return { name: station.name, lines: station.lines };
}
