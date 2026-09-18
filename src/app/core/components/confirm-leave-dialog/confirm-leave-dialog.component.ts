import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** Asked before navigation discards data the user typed but never saved. */
@Component({
    selector: 'app-confirm-leave-dialog',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatDialogModule],
    templateUrl: './confirm-leave-dialog.component.html',
})
export class ConfirmLeaveDialogComponent {
    constructor(private _dialogRef: MatDialogRef<ConfirmLeaveDialogComponent, boolean>) {}

    stay(): void {
        this._dialogRef.close(false);
    }

    discard(): void {
        this._dialogRef.close(true);
    }
}
