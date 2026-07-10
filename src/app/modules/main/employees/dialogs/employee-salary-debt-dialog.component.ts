import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { shortSlipId } from '../../salary-slips/salary-debt.util';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from '../../salary-slips/salary-slip-detail-dialog.component';
import { SalaryDebtRecord, SalarySlipsService } from '../../salary-slips/salary-slips.service';

export interface EmployeeSalaryDebtDialogData {
    employeeId: string;
    employeeName: string;
}

@Component({
    selector: 'app-employee-salary-debt-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTableModule,
        MatTooltipModule,
        DatePipe,
        DecimalPipe,
    ],
    providers: [DatePipe, DecimalPipe],
    templateUrl: './employee-salary-debt-dialog.component.html',
    styleUrl: './employee-salary-debt-dialog.component.scss',
})
export class EmployeeSalaryDebtDialogComponent implements OnInit {
    loading = true;
    error: string | null = null;
    totalOutstanding = 0;
    records: SalaryDebtRecord[] = [];
    slipLoadingId: string | null = null;

    readonly displayedColumns = ['created', 'amount', 'recovered', 'status', 'sourceSlip', 'recoverySlip'];

    constructor(
        private _dialogRef: MatDialogRef<EmployeeSalaryDebtDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: EmployeeSalaryDebtDialogData,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService,
        private _matDialog: MatDialog
    ) {}

    ngOnInit(): void {
        void this.loadHistory();
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
            const resp = await lastValueFrom(this._salarySlipsService.getSalaryDebtHistory(id));
            this.totalOutstanding = Number(resp.totalOutstanding) || 0;
            this.records = [...(resp.records ?? [])].sort(
                (a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '')
            );
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this.error = httpErr?.error?.message ?? 'Failed to load salary debt history.';
            this._toast.error(this.error);
            this.totalOutstanding = 0;
            this.records = [];
        } finally {
            this.loading = false;
        }
    }

    get hasRecords(): boolean {
        return this.records.length > 0;
    }

    close(): void {
        this._dialogRef.close();
    }

    shortSlipId = shortSlipId;

    outstandingAmount(record: SalaryDebtRecord): number {
        const amount = Number(record.amount) || 0;
        const recovered = Number(record.recoveredAmount) || 0;
        return Math.max(0, amount - recovered);
    }

    isOutstanding(record: SalaryDebtRecord): boolean {
        return record.recoveredOnSalarySlipId == null || this.outstandingAmount(record) > 0.005;
    }

    statusLabel(record: SalaryDebtRecord): string {
        return this.isOutstanding(record) ? 'Outstanding' : 'Recovered';
    }

    statusChipClass(record: SalaryDebtRecord): string {
        return this.isOutstanding(record)
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
    }

    async viewSalarySlip(salarySlipId: string | null | undefined): Promise<void> {
        const employeeId = this.dialogData?.employeeId;
        if (!employeeId || !salarySlipId) return;
        this.slipLoadingId = salarySlipId;
        try {
            const slip = await lastValueFrom(
                this._salarySlipsService.getSalarySlip(employeeId, salarySlipId)
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
