import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  standalone: true
})
export class ConfirmDialogComponent {

  inputValue = '';

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  confirm(): void {
    this.dialogRef.close({
      confirmed: true,
      value: this.data.showInput ? this.inputValue : undefined
    });
  }

  cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}
