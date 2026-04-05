import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'search',
  standalone: true
})
export class SearchPipe implements PipeTransform {

  transform<T>(items: T[], searchText: string, keys: (keyof T)[]): T[] {
    if (!items || !searchText || !keys?.length) {
      return items;
    }

    const term = searchText.toLowerCase();

    return items.filter(item =>
      keys.some(key =>
        String(item[key] ?? '').toLowerCase().includes(term)
      )
    );
  }
}
