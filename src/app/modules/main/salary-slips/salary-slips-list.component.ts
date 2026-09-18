import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import {
    formatMonthForPayload,
    monthPeriodLabel,
    monthPeriodShortLabel,
} from 'app/core/utils/date.utils';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { CompaniesService } from '../companies/companies.service';
import { EmployeeAutocompleteSearch } from '../employees/employee-autocomplete-search';
import { EmployeeListItem, EmployeesService } from '../employees/employees.service';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from './salary-slip-detail-dialog.component';
import { SalarySlipLetterheadChoiceDialogComponent } from './salary-slip-letterhead-choice-dialog.component';
import { SalarySlipPdfDialogComponent } from './salary-slip-pdf-dialog.component';
import { SalarySlipListItem, SalarySlipsService, SalarySlipStatus, normalizeSalarySlipStatus, salarySlipAllowsPdfDownload, salarySlipStatusChipClass, salarySlipStatusLabel } from './salary-slips.service';
import { SalarySlipUploadDialogComponent } from './salary-slip-upload-dialog.component';

@Component({
    selector: 'app-salary-slips-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatCheckboxModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './salary-slips-list.component.html',
})
export class SalarySlipsListComponent implements OnInit, OnDestroy {
    private readonly _allDisplayedColumns = [
        'select',
        'employeeId',
        'employeeName',
        'period',
        'workingDays',
        'grossPayment',
        'totalDeduction',
        'netPayment',
        'createdAt',
        'status',
        'actions',
    ] as const;
    displayedColumns: string[] = [];
    rows: SalarySlipListItem[] = [];
    /** Row `slip.id` while its PDF is loading for the viewer (disables that row’s PDF button). */
    pdfLoadingSlipId: string | null = null;
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    /** Bound to employee autocomplete: `EmployeeListItem` when chosen, or search string while typing. */
    employeeFilter: EmployeeListItem | string | null = null;
    readonly employeeSearch: EmployeeAutocompleteSearch;
    filterStatus: SalarySlipStatus | null = null;
    /** UI: month pickers, mapped to `periodFrom` / `periodTo` query params as `YYYY-MM`. */
    periodFromDate: Date | null = null;
    periodToDate: Date | null = null;

    statusOptions: SalarySlipStatus[] = ['pending', 'approved', 'reimbursed'];
    bulkStatusOptions: SalarySlipStatus[] = ['approved', 'reimbursed'];
    selectedIds = new Set<string>();
    bulkStatus: SalarySlipStatus | null = null;
    bulkUpdating = false;

    private _suppressNextEmployeePanelOpen = false;
    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    constructor(
        private _service: SalarySlipsService,
        private _employeesService: EmployeesService,
        private _companiesService: CompaniesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);
        const write = hasModuleWrite(this._auth.profileData, 'salarySlip');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'select' && c !== 'actions');
    }

    get canWriteSalarySlip(): boolean {
        return hasModuleWrite(this._auth.profileData, 'salarySlip');
    }

    ngOnInit(): void {
        void this._init();
    }

    employeeLabel(e: EmployeeListItem): string {
        const empId = String(e.employeeId ?? '').trim() || e.id;
        const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
        const arabic = String(e.employeeNameArabic ?? '').trim();
        return [empId, name, arabic].filter(Boolean).join(' ');
    }

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

    private _employeeById(employeeId: string | undefined): EmployeeListItem | null {
        if (!employeeId) return null;
        const fromFilter =
            this.employeeFilter && typeof this.employeeFilter === 'object' && this.employeeFilter.id === employeeId
                ? this.employeeFilter
                : null;
        return fromFilter ?? this.employeeSearch.items.find((e) => e.id === employeeId) ?? null;
    }

    private async _init(): Promise<void> {
        await Promise.all([this.employeeSearch.resetAndLoad(), this.loadList()]);
    }

    async loadList(): Promise<void> {
        const showOverlay = this.rows.length === 0;
        if (showOverlay) this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._service.getSalarySlips(this.pageIndex + 1, this.pageSize, {
                    employeeId: this._selectedEmployeeId(),
                    status: this.filterStatus,
                    periodFrom: formatMonthForPayload(this.periodFromDate),
                    periodTo: formatMonthForPayload(this.periodToDate),
                })
            );
            this.rows = resp.data ?? [];
            this._retainSelectionOnlyVisibleRows();
            this.total = resp.count ?? this.rows.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load salary slips');
            this.rows = [];
            this.total = 0;
        } finally {
            if (showOverlay) this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadList();
    }

    private _suppressFilterApply = false;
    private readonly _filterApply = createDebouncedFilterApply(() => {
        if (this._suppressFilterApply) return;
        this.pageIndex = 0;
        this.loadList();
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
        this.filterStatus = null;
        this.periodFromDate = null;
        this.periodToDate = null;
        this._suppressFilterApply = false;
        this._filterApply.now();
    }

    /** Material month pickers only fire `monthSelected`; close the panel ourselves once a month is chosen. */
    onPeriodFromMonthSelected(date: Date, picker: { close: () => void }): void {
        this.periodFromDate = date;
        picker.close();
        this.applyFilters();
    }

    onPeriodToMonthSelected(date: Date, picker: { close: () => void }): void {
        this.periodToDate = date;
        picker.close();
        this.applyFilters();
    }

    /** "March 2025" for the period column and confirmation prompts. */
    periodLabel(slip: SalarySlipListItem): string {
        return monthPeriodShortLabel(slip?.periodMonth);
    }

    goNew(): void {
        this._router.navigate(['/main/salary-slips/new']);
    }

    async openUploadDialog(): Promise<void> {
        const ref = this._matDialog.open(SalarySlipUploadDialogComponent, {
            width: 'min(96vw, 760px)',
            autoFocus: 'first-tabbable',
            panelClass: 'salary-slip-upload-dialog-panel',
        });
        const uploaded = await firstValueFrom(ref.afterClosed());
        if (uploaded) {
            await this.loadList();
        }
    }

    goEdit(slip: SalarySlipListItem): void {
        if (!slip?.employeeId || !slip?.id) return;
        if (!this.canEditSlip(slip)) {
            this._toast.warning('Only pending salary slips can be edited');
            return;
        }
        this._router.navigate(['/main/salary-slips/employee', slip.employeeId, 'salary-slips', slip.id, 'edit']);
    }

    canEditSlip(slip: SalarySlipListItem): boolean {
        return String(slip?.status ?? '').toLowerCase() === 'pending';
    }

    async confirmDeleteSlip(slip: SalarySlipListItem): Promise<void> {
        if (!slip?.employeeId || !slip?.id) return;
        if (!this.canEditSlip(slip)) {
            this._toast.warning('Only pending salary slips can be deleted');
            return;
        }
        const period = monthPeriodLabel(slip.periodMonth);
        const label = slip.employeeCode ? `${slip.employeeCode} (${period})` : period;
        const confirmed = await lastValueFrom(
            this._matDialog
                .open(ConfirmDeleteDialogComponent, {
                    data: { message: `Delete salary slip for ${label}? This cannot be undone.` },
                    width: '420px',
                })
                .afterClosed()
        );
        if (!confirmed) return;
        try {
            const resp = await lastValueFrom(this._service.deleteSalarySlip(slip.employeeId, slip.id));
            this._toast.success(resp?.message?.trim() || 'Salary slip deleted');
            this.selectedIds.delete(slip.id);
            await this.loadList();
        } catch (e: unknown) {
            const err = e as { error?: { message?: string } };
            this._toast.error(err?.error?.message || 'Failed to delete salary slip');
        }
    }

    canSelectForStatusChange(slip: SalarySlipListItem): boolean {
        return normalizeSalarySlipStatus(slip?.status) === 'pending';
    }

    canDownloadPdf(slip: SalarySlipListItem): boolean {
        return salarySlipAllowsPdfDownload(slip?.status);
    }

    readonly statusLabel = salarySlipStatusLabel;
    readonly statusChipClass = salarySlipStatusChipClass;

    employeeDisplayName(employeeId: string | undefined): string | null {
        if (!employeeId) return null;
        const e = this._employeeById(employeeId);
        if (!e) return null;
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
        return name || null;
    }

    openDetail(slip: SalarySlipListItem): void {
        const emp = this._employeeById(slip.employeeId);
        const data: SalarySlipDetailDialogData = {
            slip,
            employeeDisplayName: this.employeeDisplayName(slip.employeeId),
            companyId: emp?.companyId ?? null,
        };
        this._matDialog.open(SalarySlipDetailDialogComponent, {
            data,
            maxWidth: '960px',
            width: 'min(96vw, 960px)',
            maxHeight: 'calc(100dvh - 16px)',
            autoFocus: 'first-tabbable',
            panelClass: 'salary-slip-detail-dialog-panel',
        });
    }

    async openPdfViewer(slip: SalarySlipListItem): Promise<void> {
        if (!slip?.employeeId || !slip?.id) {
            this._toast.error('Missing employee or slip id for PDF');
            return;
        }
        if (!this.canDownloadPdf(slip)) {
            this._toast.warning('PDF is available only for approved or reimbursed salary slips');
            return;
        }
        const companyId = this._employeeById(slip.employeeId)?.companyId ?? null;
        const letterheadAvailable = await lastValueFrom(
            this._companiesService.letterheadEnabledForCompany(companyId)
        );
        let letterhead = false;
        if (letterheadAvailable) {
            const ref = this._matDialog.open(SalarySlipLetterheadChoiceDialogComponent, {
                width: 'min(96vw, 420px)',
                autoFocus: 'first-tabbable',
            });
            const choice = await firstValueFrom(ref.afterClosed());
            if (choice === undefined) {
                return;
            }
            letterhead = choice;
        }

        this.pdfLoadingSlipId = slip.id;
        try {
            const html = await lastValueFrom(
                this._service.getSalarySlipPdf(slip.employeeId, slip.id, letterhead)
            );
            const subtitle =
                this.employeeDisplayName(slip.employeeId)?.trim() || monthPeriodLabel(slip.periodMonth);
            this._matDialog.open(SalarySlipPdfDialogComponent, {
                data: {
                    html,
                    filename: `salary-slip-${slip.id}`,
                    subtitle,
                },
                maxWidth: '960px',
                width: 'min(96vw, 960px)',
                height: 'calc(100dvh - 16px)',
                maxHeight: 'calc(100dvh - 16px)',
                autoFocus: 'first-tabbable',
                panelClass: 'salary-slip-pdf-dialog-panel',
            });
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'PDF could not be loaded');
        } finally {
            this.pdfLoadingSlipId = null;
        }
    }

    get selectedCount(): number {
        return this.selectedIds.size;
    }

    isAllSelected(): boolean {
        const selectableRows = this.rows.filter((row) => this.canSelectForStatusChange(row));
        if (selectableRows.length === 0) return false;
        return selectableRows.every((row) => this.selectedIds.has(row.id));
    }

    isIndeterminate(): boolean {
        const selectableRows = this.rows.filter((row) => this.canSelectForStatusChange(row));
        const selectableIds = new Set(selectableRows.map((row) => row.id));
        const selectedOnPage = Array.from(this.selectedIds).filter((id) => selectableIds.has(id)).length;
        return selectedOnPage > 0 && selectedOnPage < selectableRows.length;
    }

    toggleSelectAll(checked: boolean): void {
        const selectableRows = this.rows.filter((row) => this.canSelectForStatusChange(row));
        if (!checked) {
            selectableRows.forEach((row) => this.selectedIds.delete(row.id));
            this._ensureBulkStatusStillValid();
            return;
        }
        selectableRows.forEach((row) => this.selectedIds.add(row.id));
        this._ensureBulkStatusStillValid();
    }

    isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }

    toggleSelection(slip: SalarySlipListItem): void {
        if (!this.canSelectForStatusChange(slip)) return;
        if (this.selectedIds.has(slip.id)) {
            this.selectedIds.delete(slip.id);
        } else {
            this.selectedIds.add(slip.id);
        }
        this._ensureBulkStatusStillValid();
    }

    clearSelection(): void {
        this.selectedIds.clear();
        this.bulkStatus = null;
    }

    selectBulkStatus(status: SalarySlipStatus): void {
        if (!this.canChooseBulkStatus(status)) return;
        this.bulkStatus = status;
    }

    canChooseBulkStatus(status: SalarySlipStatus): boolean {
        const selectedRows = this._selectedRowsOnPage();
        if (selectedRows.length === 0) return false;
        return selectedRows.every((row) => this.canTransitionStatus(row.status, status));
    }

    async applyBulkStatus(): Promise<void> {
        const selectedRows = this.rows.filter((row) => this.selectedIds.has(row.id));
        const ids = selectedRows.map((row) => row.id);
        if (!this.bulkStatus) {
            this._toast.error('Choose a status');
            return;
        }
        if (ids.length === 0) {
            this._toast.error('Select at least one salary slip');
            return;
        }
        const invalidRows = selectedRows.filter((row) => !this.canTransitionStatus(row.status, this.bulkStatus!));
        if (invalidRows.length > 0) {
            this._toast.error(
                'Invalid status change. Only pending salary slips can be marked approved or reimbursed.'
            );
            return;
        }
        this.bulkUpdating = true;
        try {
            await lastValueFrom(this._service.bulkUpdateStatus(ids, this.bulkStatus));
            this._toast.success(
                `Updated ${ids.length} salary slip${ids.length === 1 ? '' : 's'} to ${salarySlipStatusLabel(this.bulkStatus)}`
            );
            this.clearSelection();
            await this.loadList();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update status');
        } finally {
            this.bulkUpdating = false;
        }
    }

    private _retainSelectionOnlyVisibleRows(): void {
        const visibleIds = new Set(this.rows.map((r) => r.id));
        Array.from(this.selectedIds).forEach((id) => {
            if (!visibleIds.has(id)) this.selectedIds.delete(id);
        });
        this._ensureBulkStatusStillValid();
    }

    private _selectedRowsOnPage(): SalarySlipListItem[] {
        return this.rows.filter((row) => this.selectedIds.has(row.id));
    }

    private _ensureBulkStatusStillValid(): void {
        if (!this.bulkStatus) return;
        if (!this.canChooseBulkStatus(this.bulkStatus)) {
            this.bulkStatus = null;
        }
    }

    private canTransitionStatus(from: SalarySlipStatus | string | null | undefined, to: SalarySlipStatus): boolean {
        const current = normalizeSalarySlipStatus(from);
        if (current !== 'pending') return false;
        return to === 'approved' || to === 'reimbursed';
    }
}
