/**
 * Serialize a JSON-LD object for safe embedding inside a
 * `<script type="application/ld+json">` tag via `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` escapes characters that matter to a JSON parser (quotes,
 * backslashes, control chars) but it does NOT escape characters that matter to
 * the HTML tokenizer. A string value containing `</script>` (for example a
 * professional's display name or bio) would therefore close the surrounding
 * <script> element early and let any following markup execute — a classic
 * stored/reflected XSS sink.
 *
 * Escaping `<`, `>` and `&` as JSON unicode escapes neutralizes that breakout
 * while keeping the payload byte-for-byte equivalent for any JSON consumer
 * (Google's crawler, `JSON.parse`, etc.), so structured-data / SEO behaviour
 * is unchanged.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
