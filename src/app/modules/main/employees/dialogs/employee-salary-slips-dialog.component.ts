import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from '../../salary-slips/salary-slip-detail-dialog.component';
import { SalarySlipListItem, SalarySlipsService } from '../../salary-slips/salary-slips.service';
import { monthPeriodShortLabel } from 'app/core/utils/date.utils';

export interface EmployeeSalarySlipsDialogData {
    employeeId: string;
    employeeName: string;
    companyId?: string | null;
}

@Component({
    selector: 'app-employee-salary-slips-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTableModule,
        MatPaginatorModule,
        DecimalPipe,
    ],
    providers: [DatePipe, DecimalPipe],
    templateUrl: './employee-salary-slips-dialog.component.html',
    styleUrl: './employee-salary-slips-dialog.component.scss',
})
export class EmployeeSalarySlipsDialogComponent implements OnInit {
    slips: SalarySlipListItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    loading = true;
    error: string | null = null;
    slipLoadingId: string | null = null;

    displayedColumns: string[] = ['period', 'netPayment', 'status', 'actions'];

    constructor(
        private _dialogRef: MatDialogRef<EmployeeSalarySlipsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: EmployeeSalarySlipsDialogData,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService,
        private _matDialog: MatDialog
    ) {}

    ngOnInit(): void {
        void this.loadSlips();
    }

    /** `YYYY-MM` → "Mar 2025". */
    periodLabel(slip: SalarySlipListItem): string {
        return monthPeriodShortLabel(slip?.periodMonth);
    }

    async loadSlips(): Promise<void> {
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
                this._salarySlipsService.getEmployeeSalarySlips(id, this.pageIndex + 1, this.pageSize)
            );
            this.slips = resp.data ?? [];
            this.total = resp.count ?? this.slips.length;
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this.error = httpErr?.error?.message ?? 'Failed to load salary slips.';
            this.slips = [];
            this.total = 0;
            this._toast.error(this.error);
        } finally {
            this.loading = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        void this.loadSlips();
    }

    async viewSlip(slip: SalarySlipListItem): Promise<void> {
        const employeeId = this.dialogData?.employeeId;
        if (!employeeId || !slip?.id) return;
        this.slipLoadingId = slip.id;
        try {
            const full = await lastValueFrom(this._salarySlipsService.getSalarySlip(employeeId, slip.id));
            const data: SalarySlipDetailDialogData = {
                slip: full,
                employeeDisplayName: this.dialogData.employeeName,
                companyId: this.dialogData.companyId ?? null,
            };
            this._matDialog.open(SalarySlipDetailDialogComponent, {
                data,
                maxWidth: '960px',
                width: 'min(96vw, 960px)',
                maxHeight: 'calc(100dvh - 16px)',
                autoFocus: 'first-tabbable',
                panelClass: 'salary-slip-detail-dialog-panel',
            });
        } catch (err: unknown) {
            const httpErr = err as HttpErrorResponse;
            this._toast.error(httpErr?.error?.message ?? 'Failed to load salary slip');
        } finally {
            this.slipLoadingId = null;
        }
    }

    close(): void {
        this._dialogRef.close();
    }
}
