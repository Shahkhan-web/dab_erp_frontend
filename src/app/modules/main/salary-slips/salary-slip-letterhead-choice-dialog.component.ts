import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/**
 * Shown when the employee’s company has a letterhead; user picks whether the PDF should include it.
 * Closes with `true` / `false`, or `undefined` when cancelled.
 */
@Component({
    selector: 'app-salary-slip-letterhead-choice-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule],
    templateUrl: './salary-slip-letterhead-choice-dialog.component.html',
})
export class SalarySlipLetterheadChoiceDialogComponent {
    /** Default: plain PDF without letterhead (matches API default). */
    includeLetterhead = false;

    constructor(
        private _dialogRef: MatDialogRef<SalarySlipLetterheadChoiceDialogComponent, boolean | undefined>
    ) {}

    cancel(): void {
        this._dialogRef.close();
    }

    confirm(): void {
        this._dialogRef.close(this.includeLetterhead);
    }
}
