/**
 * Datos internos que no deben salir en las respuestas públicas de perfiles.
 *
 * - `profileViews`: cuántas visitas tiene cada perfil. Con eso cualquiera
 *   (la competencia, un script) arma el ranking de las profesionales que más
 *   trabajan. Se sigue usando para ordenar en el servidor; sólo no se publica.
 * - `adminQualityScore`: la nota interna del equipo. La web sólo la usa para
 *   mostrar o no la insignia de calidad, así que sale como 1 (tiene insignia)
 *   o null, sin el número.
 */
export function hidePrivateStats<T extends object>(profile: T): T {
  const out: Record<string, unknown> = { ...(profile as Record<string, unknown>) };
  delete out.profileViews;
  if ("adminQualityScore" in out) {
    const score = out.adminQualityScore;
    out.adminQualityScore = typeof score === "number" && score > 0 ? 1 : null;
  }
  return out as T;
}
