/**
 * Quién puede entrar al panel y hasta dónde.
 *
 * Hay dos niveles: el administrador, que hace todo, y las cuentas de equipo
 * (MODERATOR), que entran a mirar — inicio, chats, estadísticas, perfiles y
 * verificaciones — sin poder tocar nada.
 *
 * Esto es sólo para la interfaz: sirve para no mostrar botones que no van a
 * funcionar. El permiso de verdad lo aplica la API en `requireAdmin`
 * (apps/api/src/auth/middleware.ts), que es la que decide qué pasa y qué no.
 */

export type AdminRole = "ADMIN" | "MODERATOR" | "OTHER";

type MaybeUser = { role?: string | null } | null | undefined;

export function adminRole(user: MaybeUser): AdminRole {
  const role = (user?.role ?? "").toUpperCase();
  if (role === "ADMIN") return "ADMIN";
  if (role === "MODERATOR") return "MODERATOR";
  return "OTHER";
}

/** Administrador con permisos completos. */
export function isFullAdmin(user: MaybeUser): boolean {
  return adminRole(user) === "ADMIN";
}

/** Cuenta de equipo: entra al panel, pero sólo mira. */
export function isReadOnlyStaff(user: MaybeUser): boolean {
  return adminRole(user) === "MODERATOR";
}

/** Puede abrir el panel, con permisos completos o de sólo lectura. */
export function canOpenAdmin(user: MaybeUser): boolean {
  return adminRole(user) !== "OTHER";
}

/**
 * Puede ejecutar acciones que cambian datos (aprobar, editar, borrar, exportar).
 * Las pantallas la usan para esconder o deshabilitar sus botones.
 */
export function canWrite(user: MaybeUser): boolean {
  return adminRole(user) === "ADMIN";
}
