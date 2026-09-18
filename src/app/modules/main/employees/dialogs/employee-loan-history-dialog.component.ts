import { CommonModule, DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import {
    EmployeeLoanHistoryItem,
    LoanDeductionHistoryEntry,
    LoansService,
    loanShowsApproverInfo,
    loanShowsRemainingBalance,
    loanStatusChipClass,
    loanStatusLabel,
    normalizeLoanStatus,
} from '../../loans/loans.service';
import { LoanAttachmentsPanelComponent } from '../../loans/loan-attachments-panel.component';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from '../../salary-slips/salary-slip-detail-dialog.component';
import { SalarySlipsService } from '../../salary-slips/salary-slips.service';
import { monthPeriodLabel } from 'app/core/utils/date.utils';

export interface EmployeeLoanHistoryDialogData {
    employeeId: string;
    employeeName: string;
}

export type LoanHistorySort =
    | 'date_desc'
    | 'status'
    | 'amount_asc'
    | 'remaining_desc';

export type LoanHistoryGroupBy = 'none' | 'status';

export interface LoanHistoryGroup {
    key: string;
    label: string;
    loans: EmployeeLoanHistoryItem[];
}

const LOAN_STATUS_SORT_ORDER: Record<string, number> = {
    open: 0,
    approved: 1,
    disbursed: 2,
    reimbursed: 3,
    rejected: 4,
};

@Component({
    selector: 'app-employee-loan-history-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatExpansionModule,
        MatTableModule,
        MatPaginatorModule,
        MatSelectModule,
        DatePipe,
        LoanAttachmentsPanelComponent,
    ],
    providers: [DatePipe],
    templateUrl: './employee-loan-history-dialog.component.html',
    styleUrl: './employee-loan-history-dialog.component.scss',
})
export class EmployeeLoanHistoryDialogComponent implements OnInit {
    private allLoans: EmployeeLoanHistoryItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    sortBy: LoanHistorySort = 'date_desc';
    groupBy: LoanHistoryGroupBy = 'none';
    loading = true;
    error: string | null = null;
    slipLoadingId: string | null = null;

    readonly sortOptions: { value: LoanHistorySort; label: string }[] = [
        { value: 'date_desc', label: 'Date (newest first)' },
        { value: 'status', label: 'Status' },
        { value: 'amount_asc', label: 'Amount (low to high)' },
        { value: 'remaining_desc', label: 'Remaining (highest first)' },
    ];

    readonly groupOptions: { value: LoanHistoryGroupBy; label: string }[] = [
        { value: 'none', label: 'None' },
        { value: 'status', label: 'Status' },
    ];

    deductionColumns: string[] = ['period', 'amount', 'salarySlip', 'deductedAt'];

    constructor(
        private _dialogRef: MatDialogRef<EmployeeLoanHistoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: EmployeeLoanHistoryDialogData,
        private _loansService: LoansService,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService,
        private _datePipe: DatePipe,
        private _matDialog: MatDialog
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
                    page: 1,
                    limit: 100,
                })
            );
            this.allLoans = resp.data ?? [];
            this.total = resp.count ?? this.allLoans.length;
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this.error = httpErr?.error?.message ?? 'Failed to load loan history.';
            this._toast.error(this.error);
            this.allLoans = [];
            this.total = 0;
        } finally {
            this.loading = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
    }

    onSortChange(): void {
        this.pageIndex = 0;
    }

    onGroupChange(): void {
        this.pageIndex = 0;
    }

    get displayedLoans(): EmployeeLoanHistoryItem[] {
        const sorted = this._sortLoans(this.allLoans);
        const start = this.pageIndex * this.pageSize;
        return sorted.slice(start, start + this.pageSize);
    }

    /** Groups for the current page when groupBy is status; otherwise one flat group. */
    get loanGroups(): LoanHistoryGroup[] {
        const pageLoans = this.displayedLoans;
        if (this.groupBy !== 'status') {
            return [{ key: 'all', label: '', loans: pageLoans }];
        }
        const map = new Map<string, EmployeeLoanHistoryItem[]>();
        for (const loan of pageLoans) {
            const key = normalizeLoanStatus(loan.status) || 'unknown';
            const list = map.get(key) ?? [];
            list.push(loan);
            map.set(key, list);
        }
        return [...map.keys()]
            .sort(
                (a, b) =>
                    (LOAN_STATUS_SORT_ORDER[a] ?? 99) - (LOAN_STATUS_SORT_ORDER[b] ?? 99)
            )
            .map((key) => ({
                key,
                label: loanStatusLabel(key),
                loans: map.get(key) ?? [],
            }));
    }

    get hasLoans(): boolean {
        return this.allLoans.length > 0;
    }

    private _sortLoans(list: EmployeeLoanHistoryItem[]): EmployeeLoanHistoryItem[] {
        const items = [...list];
        switch (this.sortBy) {
            case 'status':
                return items.sort(
                    (a, b) =>
                        (LOAN_STATUS_SORT_ORDER[normalizeLoanStatus(a.status)] ?? 99) -
                        (LOAN_STATUS_SORT_ORDER[normalizeLoanStatus(b.status)] ?? 99)
                );
            case 'amount_asc':
                return items.sort((a, b) => Number(a.loanAmount) - Number(b.loanAmount));
            case 'remaining_desc':
                return items.sort(
                    (a, b) => this._remainingSortValue(b) - this._remainingSortValue(a)
                );
            case 'date_desc':
            default:
                return items.sort(
                    (a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '')
                );
        }
    }

    /** Non-disbursed loans sort after active balances when sorting by remaining. */
    private _remainingSortValue(loan: EmployeeLoanHistoryItem): number {
        if (!loanShowsRemainingBalance(loan.status)) return -1;
        return Number(loan.remaining) || 0;
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

    deductionPeriod(row: { periodMonth: string }): string {
        return monthPeriodLabel(row?.periodMonth);
    }

    deductionsFor(loan: EmployeeLoanHistoryItem): LoanDeductionHistoryEntry[] {
        return loan.deductionHistory ?? [];
    }

    showsApproverInfo(loan: EmployeeLoanHistoryItem): boolean {
        return loanShowsApproverInfo(loan.status);
    }

    showsRemainingBalance(loan: EmployeeLoanHistoryItem): boolean {
        return loanShowsRemainingBalance(loan.status);
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
                employeeDisplayName: this.dialogData.employeeName ?? null,
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
