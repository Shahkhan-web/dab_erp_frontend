import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
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
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { EmployeeListItem, EmployeesService } from '../employees/employees.service';
import { LoanDetailDialogComponent } from './loan-detail-dialog.component';
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
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
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

    /** Bound to employee autocomplete: `EmployeeListItem` when chosen, or search string while typing. */
    employeeFilter: EmployeeListItem | string | null = null;
    employees: EmployeeListItem[] = [];
    filteredEmployees: EmployeeListItem[] = [];
    filterApplicantType: string | null = null;
    filterStatus: string | null = null;
    filterLoanName: string | null = null;
    /** Local calendar dates; sent to API as `YYYY-MM-DD` via `_dateToYmd`. */
    createdFromDate: Date | null = null;
    createdToDate: Date | null = null;

    constructor(
        private _loansService: LoansService,
        private _employeesService: EmployeesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        this.displayedColumns = [...this._allDisplayedColumns];
    }

    get canWriteLoan(): boolean {
        return hasModuleWrite(this._auth.profileData, 'loan');
    }

    ngOnInit(): void {
        void this._init();
    }

    employeeLabel(e: EmployeeListItem): string {
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Employee';
        const code = e.employeeId ? `${e.employeeId} · ` : '';
        return `${code}${name}`;
    }

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    onEmployeeFilterChange(value: EmployeeListItem | string | null): void {
        const q =
            typeof value === 'string'
                ? value
                : value
                  ? this.employeeLabel(value)
                  : '';
        this.filteredEmployees = this._filterEmployees(q);
        if (value == null || typeof value === 'object' || (typeof value === 'string' && value === '')) {
            this.applyFilters();
        }
    }

    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        this.onEmployeeFilterChange(this.employeeFilter);
        setTimeout(() => {
            trigger.updatePosition();
            trigger.openPanel();
        });
    }

    private _selectedEmployeeId(): string | null {
        const v = this.employeeFilter;
        return v && typeof v === 'object' && 'id' in v ? (v as EmployeeListItem).id : null;
    }

    private _filterEmployees(query: string): EmployeeListItem[] {
        const q = query.trim().toLowerCase();
        if (!q) return this.employees;
        return this.employees.filter(
            (e) =>
                this.employeeLabel(e).toLowerCase().includes(q) ||
                e.id.toLowerCase().includes(q) ||
                `${e.firstName ?? ''} ${e.middleName ?? ''} ${e.lastName ?? ''}`.toLowerCase().includes(q) ||
                String(e.employeeId ?? '').toLowerCase().includes(q) ||
                String(e.employeeNameArabic ?? '').toLowerCase().includes(q)
        );
    }

    private async _init(): Promise<void> {
        await Promise.all([this._loadEmployees(), this.loadLoans()]);
    }

    private async _loadEmployees(): Promise<void> {
        try {
            const resp = await lastValueFrom(this._employeesService.getEmployees(1, 100, {}));
            this.employees = resp.employees ?? [];
            this.filteredEmployees = [...this.employees];
        } catch {
            this.employees = [];
            this.filteredEmployees = [];
        }
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
        const showOverlay = this.loans.length === 0;
        if (showOverlay) this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._loansService.getLoans(this.pageIndex + 1, this.pageSize, {
                    employeeId: this._selectedEmployeeId(),
                    applicantType: this.filterApplicantType,
                    status: this.filterStatus,
                    loanName: this.filterLoanName,
                    createdFrom: this._dateToYmd(this.createdFromDate),
                    createdTo: this._dateToYmd(this.createdToDate),
                })
            );
            this.loans = resp.data ?? [];
            this.total = resp.count ?? this.loans.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load loans');
            this.loans = [];
            this.total = 0;
        } finally {
            if (showOverlay) this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadLoans();
    }

    private _suppressFilterApply = false;
    private readonly _filterApply = createDebouncedFilterApply(() => {
        if (this._suppressFilterApply) return;
        this.pageIndex = 0;
        this.loadLoans();
    });

    applyFilters(): void {
        this._filterApply.now();
    }

    scheduleApplyFilters(): void {
        this._filterApply.schedule();
    }

    clearFilters(): void {
        this._suppressFilterApply = true;
        this.employeeFilter = null;
        this.filteredEmployees = [...this.employees];
        this.filterApplicantType = null;
        this.filterStatus = null;
        this.filterLoanName = null;
        this.createdFromDate = null;
        this.createdToDate = null;
        this._suppressFilterApply = false;
        this._filterApply.now();
    }

    /** Same shape as manual `YYYY-MM-DD` text filters; local calendar date, no timezone shift. */
    private _dateToYmd(d: Date | null): string | null {
        if (!d) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    addLoan(): void {
        this._router.navigate(['/main/loans/new']);
    }

    editLoan(loan: LoanListItem): void {
        this._router.navigate(['/main/loans', loan.employeeId, 'edit', loan.id]);
    }

    canEditLoan(loan: LoanListItem): boolean {
        return this.canWriteLoan && (loan.status || '').toLowerCase() === 'open';
    }

    async confirmDeleteLoan(loan: LoanListItem): Promise<void> {
        const label = loan.loanName?.trim() || 'this loan';
        const confirmed = await lastValueFrom(
            this._matDialog
                .open(ConfirmDeleteDialogComponent, {
                    data: { message: `Delete “${label}”? This cannot be undone.` },
                    width: '420px',
                })
                .afterClosed()
        );
        if (!confirmed) return;
        try {
            const resp = await lastValueFrom(this._loansService.deleteLoan(loan.employeeId, loan.id));
            this._toast.success(resp?.message?.trim() || 'Loan deleted');
            await this.loadLoans();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to delete loan');
        }
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

    openLoanDetail(loan: LoanListItem): void {
        if (!loan?.employeeId || !loan?.id) return;
        this._matDialog.open(LoanDetailDialogComponent, {
            data: { employeeId: loan.employeeId, loanId: loan.id },
            width: 'min(96vw, 720px)',
            maxWidth: '720px',
            maxHeight: 'calc(100dvh - 16px)',
            autoFocus: 'first-tabbable',
            panelClass: 'loan-detail-dialog-panel',
        });
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
