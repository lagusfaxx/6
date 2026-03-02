/**
 * Tag normalization utilities for case-insensitive and accent-insensitive matching
 */

/**
 * Normalize a single tag: lowercase, trim, collapse spaces, remove accents/diacritics
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // collapse multiple spaces
    .normalize("NFD") // decompose accents
    .replace(/[\u0300-\u036f]/g, ""); // remove diacritics
}

/**
 * Parse and normalize a comma-separated list of tags
 * Returns array of normalized tags
 */
export function parseAndNormalizeTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) return [];

  return rawTags
    .split(",")
    .map((t) => normalizeTag(t))
    .filter(Boolean);
}

/**
 * Check if a normalized tag matches any in a list of normalized tags
 */
export function matchesTag(searchTag: string, normalizedTags: string[]): boolean {
  const normalizedSearch = normalizeTag(searchTag);
  return normalizedTags.includes(normalizedSearch);
}
