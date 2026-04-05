import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-global-dropdown',
  imports: [CommonModule, MatButtonModule, MatMenuModule,MatIconModule],
  templateUrl: './global-dropdown.component.html',
  styles: ``
})
export class GlobalDropdownComponent {
  @Input({ required: true }) items: any[] = [];
  @Input({ required: true }) labelKey!: string;
  @Input() label: string = 'Select Account';
  @Input() disabledIds = new Set<string>();
  @Output() itemSelected = new EventEmitter<any>();

  onSelect(item: any): void {
    this.itemSelected.emit(item);
  }
}
