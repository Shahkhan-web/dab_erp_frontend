import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LoanListItem, UpdateLoanStatusPayload } from './loans.service';

export const LOAN_STATUS_OPTIONS = ['open', 'rejected', 'approved', 'paid'] as const;

export interface LoanStatusDialogData {
    loan: LoanListItem;
}

@Component({
    selector: 'app-loan-status-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './loan-status-dialog.component.html',
})
export class LoanStatusDialogComponent {
    form: FormGroup;
    statusOptions = [...LOAN_STATUS_OPTIONS];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<LoanStatusDialogComponent, false | UpdateLoanStatusPayload>,
        @Inject(MAT_DIALOG_DATA) public data: LoanStatusDialogData
    ) {
        this.form = this._fb.group({
            status: [data.loan.status || 'open', Validators.required],
            reason: [''],
            remarks: [''],
        });
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    submit(): void {
        if (this.form.invalid) return;
        const v = this.form.value;
        const payload: UpdateLoanStatusPayload = {
            status: v.status,
            reason: (v.reason as string)?.trim() || undefined,
            remarks: (v.remarks as string)?.trim() || undefined,
        };
        this._dialogRef.close(payload);
    }
}
