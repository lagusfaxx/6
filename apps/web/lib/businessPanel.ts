/**
 * Panel propio de cada tipo de comercio. Locales (moteles, hoteles) y tiendas
 * no usan el Creator Studio de las profesionales: tienen su panel con
 * habitaciones y reservas, o productos y pedidos. Todos los accesos
 * ("Dashboard", "Editar perfil", el registro) pasan por acá para no mandar a
 * nadie a una pantalla intermedia.
 */
export type BusinessKind = "establishment" | "shop";

export function businessKindOf(user?: { profileType?: string | null; role?: string | null } | null): BusinessKind | null {
  const profileType = String(user?.profileType || "").toUpperCase();
  const role = String(user?.role || "").toUpperCase();
  if (profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER") return "establishment";
  if (profileType === "SHOP") return "shop";
  return null;
}

export function businessPanelHref(user?: { profileType?: string | null; role?: string | null } | null, tab?: string): string | null {
  const kind = businessKindOf(user);
  if (!kind) return null;
  const base = kind === "establishment" ? "/dashboard/motel" : "/dashboard/shop";
  return tab ? `${base}?tab=${tab}` : base;
}
