import { CommonModule, DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import {
    EmployeeLoanHistoryItem,
    LoanDeductionHistoryEntry,
    LoansService,
} from '../../loans/loans.service';

export interface EmployeeLoanHistoryDialogData {
    employeeId: string;
    employeeName: string;
}

@Component({
    selector: 'app-employee-loan-history-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatExpansionModule,
        MatTableModule,
        MatPaginatorModule,
        DatePipe,
    ],
    providers: [DatePipe],
    templateUrl: './employee-loan-history-dialog.component.html',
    styleUrl: './employee-loan-history-dialog.component.scss',
})
export class EmployeeLoanHistoryDialogComponent implements OnInit {
    loans: EmployeeLoanHistoryItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    loading = true;
    error: string | null = null;

    deductionColumns: string[] = ['period', 'frequency', 'amount', 'salarySlip', 'deductedAt'];

    constructor(
        private _dialogRef: MatDialogRef<EmployeeLoanHistoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: EmployeeLoanHistoryDialogData,
        private _loansService: LoansService,
        private _toast: ToastrService,
        private _datePipe: DatePipe
    ) {}

    ngOnInit(): void {
        this.loadHistory();
    }

    async loadHistory(): Promise<void> {
        const id = this.dialogData?.employeeId;
        if (!id) {
            this.error = 'Invalid employee.';
            this.loading = false;
            return;
        }
        this.loading = true;
        this.error = null;
        try {
            const resp = await lastValueFrom(
                this._loansService.getEmployeeLoanHistory(id, {
                    page: this.pageIndex + 1,
                    limit: this.pageSize,
                })
            );
            this.loans = resp.data ?? [];
            this.total = resp.count ?? this.loans.length;
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this.error = httpErr?.error?.message ?? 'Failed to load loan history.';
            this._toast.error(this.error);
            this.loans = [];
            this.total = 0;
        } finally {
            this.loading = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadHistory();
    }

    close(): void {
        this._dialogRef.close();
    }

    statusChipClass(status: string | undefined): Record<string, boolean> {
        const s = (status || '').toLowerCase();
        return {
            'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300': s === 'open',
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300': s === 'approved',
            'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300': s === 'rejected',
            'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300': s === 'paid',
            'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300':
                !['open', 'approved', 'rejected', 'paid'].includes(s),
        };
    }

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

    deductionsFor(loan: EmployeeLoanHistoryItem): LoanDeductionHistoryEntry[] {
        return loan.deductionHistory ?? [];
    }
}
