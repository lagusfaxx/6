/** Labels managed by admin — should NOT appear as regular user tags in cards/profiles */
export const ADMIN_CONTROLLED_LABELS = new Set([
  "premium",
  "verificada",
  "profesional con examenes",
  "profesional con exámenes",
  "destacada",
]);

/** Filter out admin-controlled labels from a tags array */
export function filterUserTags(tags: string[]): string[] {
  return tags.filter((t) => !ADMIN_CONTROLLED_LABELS.has(t.toLowerCase()));
}
