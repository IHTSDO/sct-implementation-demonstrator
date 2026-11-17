import { Pipe, PipeTransform } from '@angular/core';

/**
 * Renders the small Markdown subset used by CDS card details (paragraphs, line breaks,
 * bold, italics and links) to HTML. The input is escaped first, and Angular sanitizes the
 * result again when it is bound to `innerHTML`.
 */
@Pipe({ name: 'simpleMarkdown', standalone: false })
export class SimpleMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => `<p>${this.inline(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private inline(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  }
}
