/**
 * Syntax-highlight a JSON string as HTML. highlight.js is loaded globally via
 * CDN (src/index.html); falls back to escaped plain text when it is missing.
 *
 * We highlight to an HTML string instead of using the `highlight-js` directive
 * because the directive inserts sibling nodes and fails inside containers that
 * are not attached yet (mat-tab, flip cards).
 */
export function highlightJson(code: string): string {
  const hljs = (window as any).hljs;
  if (hljs?.highlight) {
    try {
      return hljs.highlight(code, { language: 'json' }).value;
    } catch {
      /* fall through to escaped plain text */
    }
  }
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
