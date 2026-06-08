/** Convert plain-text newlines to <br> for HTML email bodies.
 *  Does NOT escape — Handlebars already escapes interpolated values and
 *  HTML in signatures must pass through. */
export function newlinesToHtml(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, "<br>");
}
