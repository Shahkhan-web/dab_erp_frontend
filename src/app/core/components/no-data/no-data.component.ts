import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type NoDataSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-no-data',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './no-data.component.html',
  styleUrls: ['./no-data.component.scss']
})
export class NoDataComponent {
  /** Custom message. Default: "No data" */
  @Input() message = 'No data';

  /** Material icon SVG name (e.g. "heroicons_outline:inbox"). Empty = no icon. */
  @Input() icon: string | null = 'heroicons_outline:inbox';

  /** Visual size: sm (compact, e.g. table cell), md (default), lg (full page). */
  @Input() size: NoDataSize = 'md';
}
