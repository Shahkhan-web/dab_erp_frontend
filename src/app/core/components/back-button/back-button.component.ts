import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-back-button',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './back-button.component.html',
  styles: ``
})
export class BackButtonComponent {
constructor(private readonly location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
