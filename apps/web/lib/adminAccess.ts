/**
 * Quién puede entrar al panel y hasta dónde.
 *
 * Hay dos niveles: el administrador, que hace todo, y las cuentas de equipo
 * (MODERATOR), que trabajan el panel completo — aprueban verificaciones y
 * solicitudes, mueven depósitos y retiros, moderan, editan tarifas — salvo un
 * puñado de cosas sin vuelta atrás: borrar perfiles, cambiarle el nombre o el
 * teléfono a alguien, dar de alta profesionales rápidos, crear cuentas de
 * equipo y bajar la base en CSV.
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

/** Cuenta de equipo: trabaja el panel, con los límites de más abajo. */
export function isTeamStaff(user: MaybeUser): boolean {
  return adminRole(user) === "MODERATOR";
}

/** Puede abrir el panel, sea administrador o equipo. */
export function canOpenAdmin(user: MaybeUser): boolean {
  return adminRole(user) !== "OTHER";
}

/**
 * Puede ejecutar acciones que cambian datos: aprobar, rechazar, editar.
 * Lo que el equipo NO puede hacer tiene su propia función, más abajo.
 */
export function canWrite(user: MaybeUser): boolean {
  return adminRole(user) !== "OTHER";
}

/** Borrar perfiles: sólo el administrador. */
export function canDeleteProfiles(user: MaybeUser): boolean {
  return isFullAdmin(user);
}

/**
 * Editar lo que identifica y contacta al perfil (nombre, teléfono) y su rol.
 * Las tarifas no entran acá: esas las edita el equipo también.
 */
export function canEditProfileIdentity(user: MaybeUser): boolean {
  return isFullAdmin(user);
}

/** Altas y bajas de cuentas con acceso al panel. */
export function canManageTeam(user: MaybeUser): boolean {
  return isFullAdmin(user);
}

/** Descargar la base en CSV (va con teléfonos). */
export function canExportData(user: MaybeUser): boolean {
  return isFullAdmin(user);
}

/**
 * Secciones del panel cerradas para el equipo. Coincide con la lista negra de
 * la API: si se agrega una acá, hay que agregarla allá.
 */
const ADMIN_ONLY_SECTIONS = [
  "/admin/quick-professionals",
  "/admin/equipo",
  /* El doble factor es obligatorio sólo para el administrador; la pantalla de
     enrolamiento rechaza a las cuentas de equipo, así que no se les ofrece. */
  "/admin/2fa",
];

/** ¿Se le muestra esta sección del panel a esta cuenta? */
export function canOpenSection(user: MaybeUser, href: string): boolean {
  if (isFullAdmin(user)) return true;
  if (!canOpenAdmin(user)) return false;
  return !ADMIN_ONLY_SECTIONS.some(
    (section) => href === section || href.startsWith(`${section}/`),
  );
}
