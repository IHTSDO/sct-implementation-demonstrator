import { Directive, ElementRef, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ValuesetDialogComponent } from './valueset-dialog.component';

/**
 * Keeps the user inside the demo when following an external spec link.
 *
 * Applies to every `<a target="_blank" href>` in modules that import it: a plain
 * click opens the page in the embedded dialog, or in a new tab when the host
 * refuses framing (see `ValuesetDialogComponent.openPage`). Modified clicks
 * (Ctrl/Cmd/Shift/middle button) keep the browser's default behaviour.
 */
@Directive({
  selector: 'a[target="_blank"][href]',
  standalone: true,
})
export class ExternalPageLinkDirective {
  constructor(
    private el: ElementRef<HTMLAnchorElement>,
    private dialog: MatDialog,
  ) {}

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = this.el.nativeElement;
    if (!/^https?:/i.test(anchor.href)) return;

    event.preventDefault();
    const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim() || anchor.hostname;
    ValuesetDialogComponent.openPage(this.dialog, { url: anchor.href, fieldName: title, dialogTitle: title });
  }
}
