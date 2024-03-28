import { Pipe, PipeTransform } from '@angular/core';
import Filter from 'bad-words';

@Pipe({
  name: 'safeText'
})
export class SafeTextPipe implements PipeTransform {
  private filter = new Filter();

  transform(value: string): string {
    if (!value) return value;

    // You can customize the filter, e.g., by adding more bad words
    // this.filter.addWords('some', 'additional', 'badwords');

    // Replace bad words with the provided replacement character or string
    return this.filter.clean(value);
  }
}
