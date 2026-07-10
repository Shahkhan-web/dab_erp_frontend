import { CommonModule } from '@angular/common';
import { Component, Inject, ViewChild } from '@angular/core';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { LoanAttachmentsPanelComponent } from './loan-attachments-panel.component';
import {
    allowedLoanStatusTransitions,
    LoanAttachment,
    LoanListItem,
    LoansService,
    LoanStatus,
    loanStatusLabel,
    normalizeLoanStatus,
    UpdateLoanStatusPayload,
} from './loans.service';

export interface LoanStatusDialogData {
    loan: LoanListItem;
    employeeId: string;
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
        MatProgressSpinnerModule,
        LoanAttachmentsPanelComponent,
    ],
    templateUrl: './loan-status-dialog.component.html',
})
export class LoanStatusDialogComponent {
    @ViewChild(LoanAttachmentsPanelComponent) attachmentsPanel?: LoanAttachmentsPanelComponent;

    form: FormGroup;
    readonly allowedStatuses: LoanStatus[];
    readonly statusLabel = loanStatusLabel;
    attachments: LoanAttachment[] = [];
    saving = false;
    /** Updated after successful PATCH so uploads tag the new step. */
    effectiveLoanStatus: string;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<LoanStatusDialogComponent, boolean>,
        @Inject(MAT_DIALOG_DATA) public data: LoanStatusDialogData,
        private _loansService: LoansService,
        private _toast: ToastrService,
        private _auth: AuthService
    ) {
        this.allowedStatuses = allowedLoanStatusTransitions(data.loan.status);
        this.effectiveLoanStatus = normalizeLoanStatus(data.loan.status);
        this.attachments = data.loan.attachments ?? [];
        this.form = this._fb.group({
            status: [this.allowedStatuses[0] ?? '', Validators.required],
            reason: [''],
            remarks: [''],
        });
    }

    get canWriteLoan(): boolean {
        return hasModuleWrite(this._auth.profileData, 'loan');
    }

    get currentStatusLabel(): string {
        return loanStatusLabel(normalizeLoanStatus(this.data.loan.status));
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    async submit(): Promise<void> {
        if (this.form.invalid || this.saving) return;
        const v = this.form.value;
        const payload: UpdateLoanStatusPayload = {
            status: v.status,
            reason: (v.reason as string)?.trim() || undefined,
            remarks: (v.remarks as string)?.trim() || undefined,
        };

        this.saving = true;
        try {
            const panel = this.attachmentsPanel;
            const pendingReady = panel?.pendingUploadReady() ?? false;
            const newStatus = normalizeLoanStatus(payload.status);

            if (pendingReady && newStatus === 'reimbursed') {
                await panel!.uploadPending();
            }

            await lastValueFrom(this._loansService.updateLoanStatus(this.data.loan.id, payload));
            this.effectiveLoanStatus = newStatus;
            this._toast.success('Loan status updated');

            if (pendingReady && newStatus !== 'reimbursed') {
                await panel!.uploadPending();
            }

            this._dialogRef.close(true);
        } catch (e: unknown) {
            const err = e as { error?: { message?: string } };
            this._toast.error(err?.error?.message || 'Failed to update loan status');
        } finally {
            this.saving = false;
        }
    }
}
