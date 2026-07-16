import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatAutocompleteModule, MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
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
import { EmployeeAutocompleteSearch } from '../employees/employee-autocomplete-search';
import { EmployeeListItem, EmployeesService } from '../employees/employees.service';
import { LoanDetailDialogComponent } from './loan-detail-dialog.component';
import { LoanStatusDialogComponent } from './loan-status-dialog.component';
import { LoanListItem, LoansService, canChangeLoanStatus, loanShowsRemainingBalance, loanStatusChipClass, loanStatusLabel } from './loans.service';

@Component({
    selector: 'app-loans-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
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
export class LoansListComponent implements OnInit, OnDestroy {
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
    readonly employeeSearch: EmployeeAutocompleteSearch;
    filterApplicantType: string | null = null;
    filterStatus: string | null = null;
    filterLoanName: string | null = null;
    /** Local calendar dates; sent to API as `YYYY-MM-DD` via `_dateToYmd`. */
    createdFromDate: Date | null = null;
    createdToDate: Date | null = null;

    private _suppressNextEmployeePanelOpen = false;
    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

    constructor(
        private _loansService: LoansService,
        private _employeesService: EmployeesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);
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

    ngOnDestroy(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    onEmployeeFilterChange(value: EmployeeListItem | string | null): void {
        if (value && typeof value === 'object' && value.id) {
            this.employeeSearch.ensureInList(value);
            this.applyFilters();
            return;
        }
        this._employeeSearchApply.schedule();
        if (value == null || (typeof value === 'string' && value.trim() === '')) {
            this.applyFilters();
        }
    }

    onEmployeeOptionSelected(): void {
        this._suppressNextEmployeePanelOpen = true;
    }

    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        if (this._suppressNextEmployeePanelOpen) {
            this._suppressNextEmployeePanelOpen = false;
            return;
        }
        void this.employeeSearch.resetAndLoad(this._employeeSearchQuery()).then(() => {
            setTimeout(() => {
                trigger.updatePosition();
                trigger.openPanel();
            });
        });
    }

    onEmployeeAutocompleteOpened(auto: MatAutocomplete): void {
        this.employeeSearch.bindPanelScroll(auto);
    }

    onEmployeeAutocompleteClosed(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private _employeeSearchQuery(): string {
        const v = this.employeeFilter;
        return typeof v === 'string' ? v.trim() : '';
    }

    private async _scheduleEmployeeSearch(): Promise<void> {
        await this.employeeSearch.resetAndLoad(this._employeeSearchQuery());
    }

    private _selectedEmployeeId(): string | null {
        const v = this.employeeFilter;
        return v && typeof v === 'object' && 'id' in v ? (v as EmployeeListItem).id : null;
    }

    private async _init(): Promise<void> {
        await Promise.all([this.employeeSearch.resetAndLoad(), this.loadLoans()]);
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

    canUpdateLoanStatus(loan: LoanListItem): boolean {
        return this.canWriteLoan && canChangeLoanStatus(loan.status);
    }

    readonly statusChipClass = loanStatusChipClass;
    readonly statusLabel = loanStatusLabel;
    readonly showsRemainingBalance = loanShowsRemainingBalance;

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

    openLoanDetail(loan: LoanListItem): void {
        if (!loan?.employeeId || !loan?.id) return;
        this._matDialog.open(LoanDetailDialogComponent, {
            data: { employeeId: loan.employeeId, loanId: loan.id },
            width: 'min(96vw, 800px)',
            maxWidth: '800px',
            maxHeight: 'calc(100dvh - 16px)',
            autoFocus: 'first-tabbable',
            panelClass: 'loan-detail-dialog-panel',
        });
    }

    async openStatusDialog(loan: LoanListItem): Promise<void> {
        const updated = await lastValueFrom(
            this._matDialog
                .open(LoanStatusDialogComponent, {
                    data: { loan, employeeId: loan.employeeId },
                    width: '96vw',
                    maxWidth: '640px',
                    maxHeight: 'calc(100dvh - 16px)',
                })
                .afterClosed()
        );
        if (!updated) return;
        this.loadLoans();
    }
}
