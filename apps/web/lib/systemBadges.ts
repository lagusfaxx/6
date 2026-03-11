/**
 * System badges are admin-controlled labels stored in the profileTags array.
 * They should be rendered as distinct visual indicators (near the name/photo)
 * rather than as regular profile tag chips.
 *
 * Mirrors ADMIN_CONTROLLED_LABELS from apps/api/src/admin/routes.ts
 */

export const SYSTEM_BADGE_TAGS = new Set([
  "premium",
  "verificada",
  "profesional con examenes",
]);

/** Returns true if the tag is a system badge managed by admin. */
export function isSystemBadge(tag: string): boolean {
  return SYSTEM_BADGE_TAGS.has(tag.toLowerCase().trim());
}

/** Filters out system badges, returning only user-defined profile tags. */
export function filterUserTags(tags: string[] | null | undefined): string[] {
  if (!tags) return [];
  return tags.filter((t) => !isSystemBadge(t));
}

/** Extracts system badges from the profileTags array. */
export function getSystemBadges(tags: string[] | null | undefined): string[] {
  if (!tags) return [];
  return tags.filter((t) => isSystemBadge(t));
}

/** Check if profileTags contain the "premium" badge. */
export function hasPremiumBadge(tags: string[] | null | undefined): boolean {
  return (tags || []).some((t) => t.toLowerCase().trim() === "premium");
}

/** Check if profileTags contain the "verificada" badge. */
export function hasVerifiedBadge(tags: string[] | null | undefined): boolean {
  return (tags || []).some((t) => t.toLowerCase().trim() === "verificada");
}
