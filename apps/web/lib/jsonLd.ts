/**
 * JSON para meter dentro de <script type="application/ld+json">.
 *
 * `JSON.stringify` no escapa `<`, así que un texto del usuario con
 * `</script><script>…` (una bio, un nombre) cerraría la etiqueta y
 * ejecutaría código en la página de quien la mire. Escapar `<`, `>`, `&` y
 * los separadores de línea U+2028/U+2029 deja el JSON igual de válido.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
