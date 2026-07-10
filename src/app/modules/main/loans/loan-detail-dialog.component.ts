import { CommonModule, DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from '../salary-slips/salary-slip-detail-dialog.component';
import { SalarySlipsService } from '../salary-slips/salary-slips.service';
import { LoanAttachmentsPanelComponent } from './loan-attachments-panel.component';
import {
    LoanAttachment,
    LoanDeductionHistoryEntry,
    LoanResponseDto,
    LoansService,
    loanShowsApproverInfo,
    loanShowsRemainingBalance,
    loanStatusChipClass,
    loanStatusLabel,
} from './loans.service';

export interface LoanDetailDialogData {
    employeeId: string;
    loanId: string;
}

@Component({
    selector: 'app-loan-detail-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTableModule,
        DatePipe,
        LoanAttachmentsPanelComponent,
    ],
    providers: [DatePipe],
    templateUrl: './loan-detail-dialog.component.html',
    styleUrl: './loan-detail-dialog.component.scss',
})
export class LoanDetailDialogComponent implements OnInit {
    loan: LoanResponseDto | null = null;
    attachments: LoanAttachment[] = [];
    loading = true;
    error: string | null = null;
    slipLoadingId: string | null = null;

    deductionColumns: string[] = ['period', 'frequency', 'amount', 'salarySlip'];

    constructor(
        private _dialogRef: MatDialogRef<LoanDetailDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: LoanDetailDialogData,
        private _loansService: LoansService,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService,
        private _datePipe: DatePipe,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {}

    get canWriteLoan(): boolean {
        return hasModuleWrite(this._auth.profileData, 'loan');
    }

    ngOnInit(): void {
        void this.loadLoan();
    }

    get deductions(): LoanDeductionHistoryEntry[] {
        return this.loan?.deductionHistory ?? [];
    }

    showsApproverInfo(): boolean {
        return loanShowsApproverInfo(this.loan?.status);
    }

    showsRemainingBalance(): boolean {
        return loanShowsRemainingBalance(this.loan?.status);
    }

    async loadLoan(): Promise<void> {
        const { employeeId, loanId } = this.dialogData ?? {};
        if (!employeeId || !loanId) {
            this.error = 'Invalid loan.';
            this.loading = false;
            return;
        }
        this.loading = true;
        this.error = null;
        try {
            this.loan = await lastValueFrom(this._loansService.getLoan(employeeId, loanId));
            this.attachments = this.loan?.attachments ?? [];
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this.error = httpErr?.error?.message ?? 'Failed to load loan.';
            this._toast.error(this.error);
            this.loan = null;
        } finally {
            this.loading = false;
        }
    }

    onAttachmentsChange(list: LoanAttachment[]): void {
        this.attachments = list;
        if (this.loan) {
            this.loan = { ...this.loan, attachments: list };
        }
    }

    close(): void {
        this._dialogRef.close();
    }

    readonly statusChipClass = loanStatusChipClass;
    readonly statusLabel = loanStatusLabel;

    formatJsonField(value: unknown): string {
        if (value == null || value === '') return '—';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object' && Object.keys(value as object).length === 0) return '—';
        try {
            return JSON.stringify(value);
        } catch {
            return '—';
        }
    }

    deductionPeriod(row: { startDate: string; endDate: string }): string {
        const a = this._datePipe.transform(row.startDate, 'mediumDate');
        const b = this._datePipe.transform(row.endDate, 'mediumDate');
        if (a && b) return `${a} – ${b}`;
        return a || b || '—';
    }

    async viewSalarySlip(entry: LoanDeductionHistoryEntry): Promise<void> {
        const employeeId = this.dialogData?.employeeId;
        if (!employeeId || !entry?.salarySlipId) return;
        this.slipLoadingId = entry.salarySlipId;
        try {
            const slip = await lastValueFrom(
                this._salarySlipsService.getSalarySlip(employeeId, entry.salarySlipId)
            );
            const data: SalarySlipDetailDialogData = {
                slip,
                employeeDisplayName: this.loan?.employeeName ?? null,
            };
            this._matDialog.open(SalarySlipDetailDialogComponent, {
                data,
                maxWidth: '960px',
                width: 'min(96vw, 960px)',
                maxHeight: 'calc(100dvh - 16px)',
                autoFocus: 'first-tabbable',
                panelClass: 'salary-slip-detail-dialog-panel',
            });
        } catch (e: unknown) {
            const httpErr = e as HttpErrorResponse;
            this._toast.error(httpErr?.error?.message ?? 'Failed to load salary slip');
        } finally {
            this.slipLoadingId = null;
        }
    }
}
