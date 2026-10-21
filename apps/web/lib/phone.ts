/*
 * Teléfono de registro y perfil. Mismo criterio que `normalizePhone` y
 * `PHONE_REGEX` en @uzeed/shared (la API vuelve a normalizar y validar):
 * la gente escribe "9 1234 5678", "912345678", "56912345678" o
 * "(+56) 9 1234-5678" y todos son el mismo número válido.
 */

/** Celular válido con código de país: Chile, Colombia, Venezuela o Perú. */
export const PHONE_REGEX =
  /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/;

export const PHONE_ERROR = "Revisa tu número: debe ser un celular, por ejemplo +56 9 1234 5678.";

/** Lo lleva a +56912345678; si no lo reconoce lo devuelve como está. */
export function normalizePhone(raw: string | null | undefined): string {
  const input = String(raw ?? "").trim();
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^(56|57|58|51)0+(?=\d)/, "$1");
  if (/^9\d{8}$/.test(digits)) digits = `56${digits}`;
  else if (/^09\d{8}$/.test(digits)) digits = `56${digits.slice(1)}`;
  const candidate = `+${digits}`;
  return PHONE_REGEX.test(candidate) ? candidate : input.replace(/\s+/g, " ");
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return PHONE_REGEX.test(normalizePhone(raw));
}

/* Para mostrarlo legible después de normalizar: +56 9 1234 5678. */
export function formatPhone(raw: string | null | undefined): string {
  const n = normalizePhone(raw);
  const cl = n.match(/^\+56(9)(\d{4})(\d{4})$/);
  if (cl) return `+56 ${cl[1]} ${cl[2]} ${cl[3]}`;
  const pe = n.match(/^\+51(9\d{2})(\d{3})(\d{3})$/);
  if (pe) return `+51 ${pe[1]} ${pe[2]} ${pe[3]}`;
  const co = n.match(/^\+(57|58)(\d{3})(\d{3})(\d{4})$/);
  if (co) return `+${co[1]} ${co[2]} ${co[3]} ${co[4]}`;
  return n;
}
