import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { LoanStatusDialogComponent } from './loan-status-dialog.component';
import { LoanListItem, LoansService } from './loans.service';

@Component({
    selector: 'app-loans-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './loans-list.component.html',
})
export class LoansListComponent implements OnInit {
    private readonly _allDisplayedColumns = [
        'loanName',
        'employeeId',
        'applicantType',
        'status',
        'loanAmount',
        'totalDeductedSoFar',
        'remaining',
        'createdAt',
        'actions',
    ] as const;

    displayedColumns: string[];
    loans: LoanListItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterEmployeeId: string | null = null;
    filterApplicantType: string | null = null;
    filterStatus: string | null = null;
    filterLoanName: string | null = null;
    filterCreatedFrom: string | null = null;
    filterCreatedTo: string | null = null;

    constructor(
        private _loansService: LoansService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        const write = hasModuleWrite(this._auth.profileData, 'loan');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'actions');
    }

    get canWriteLoan(): boolean {
        return hasModuleWrite(this._auth.profileData, 'loan');
    }

    ngOnInit(): void {
        this.loadLoans();
    }

    formatJsonField(value: unknown): string {
        if (value == null || value === '') return '—';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        try {
            return JSON.stringify(value);
        } catch {
            return '—';
        }
    }

    async loadLoans(): Promise<void> {
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._loansService.getLoans(this.pageIndex + 1, this.pageSize, {
                    employeeId: this.filterEmployeeId,
                    applicantType: this.filterApplicantType,
                    status: this.filterStatus,
                    loanName: this.filterLoanName,
                    createdFrom: this.filterCreatedFrom,
                    createdTo: this.filterCreatedTo,
                })
            );
            this.loans = resp.data ?? [];
            this.total = resp.count ?? this.loans.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load loans');
            this.loans = [];
            this.total = 0;
        } finally {
            this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadLoans();
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.loadLoans();
    }

    clearFilters(): void {
        this.filterEmployeeId = null;
        this.filterApplicantType = null;
        this.filterStatus = null;
        this.filterLoanName = null;
        this.filterCreatedFrom = null;
        this.filterCreatedTo = null;
        this.applyFilters();
    }

    addLoan(): void {
        this._router.navigate(['/main/loans/new']);
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

    async openStatusDialog(loan: LoanListItem): Promise<void> {
        const result = await lastValueFrom(
            this._matDialog
                .open(LoanStatusDialogComponent, {
                    data: { loan },
                    width: '96vw',
                    maxWidth: '440px',
                })
                .afterClosed()
        );
        if (!result) return;
        try {
            await lastValueFrom(this._loansService.updateLoanStatus(loan.id, result));
            this._toast.success('Loan status updated');
            this.loadLoans();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update loan status');
        }
    }
}
