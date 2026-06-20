import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { CompaniesService } from '../companies/companies.service';
import { EmployeeListItem, EmployeesService } from '../employees/employees.service';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from './salary-slip-detail-dialog.component';
import { SalarySlipLetterheadChoiceDialogComponent } from './salary-slip-letterhead-choice-dialog.component';
import { SalarySlipPdfDialogComponent } from './salary-slip-pdf-dialog.component';
import { SalarySlipListItem, SalarySlipsService, SalarySlipStatus } from './salary-slips.service';
import { SalarySlipUploadDialogComponent } from './salary-slip-upload-dialog.component';

@Component({
    selector: 'app-salary-slips-list',
    standalone: true,
    providers: [DatePipe],
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatCheckboxModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
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
export class SalarySlipsListComponent implements OnInit {
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

    filterEmployeeId: string | null = null;
    filterPayrollFrequency: string | null = null;
    filterStatus: SalarySlipStatus | null = null;
    /** UI: mapped to `slipStartFrom` / `slipStartTo` query params as `YYYY-MM-DD` (local). */
    slipStartFromDate: Date | null = null;
    slipStartToDate: Date | null = null;
    /** UI: mapped to `slipEndFrom` / `slipEndTo` query params as `YYYY-MM-DD` (local). */
    slipEndFromDate: Date | null = null;
    slipEndToDate: Date | null = null;

    employees: EmployeeListItem[] = [];

    payrollFrequencyOptions = ['monthly', 'fortnightly', 'bimonthly', 'weekly', 'daily'] as const;
    statusOptions: SalarySlipStatus[] = ['pending', 'verified', 'paid'];
    bulkStatusOptions: SalarySlipStatus[] = ['verified', 'paid'];
    selectedIds = new Set<string>();
    bulkStatus: SalarySlipStatus | null = null;
    bulkUpdating = false;

    constructor(
        private _service: SalarySlipsService,
        private _employeesService: EmployeesService,
        private _companiesService: CompaniesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService,
        private _datePipe: DatePipe
    ) {
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
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Employee';
        return `${name} (${e.id.slice(0, 8)}…)`;
    }

    private async _init(): Promise<void> {
        await Promise.all([this.loadList()]);
    }

    private async _loadEmployees(): Promise<void> {
        try {
            const resp = await lastValueFrom(this._employeesService.getEmployees(1, 100, {}));
            this.employees = resp.employees ?? [];
        } catch {
            this.employees = [];
        }
    }

    async loadList(): Promise<void> {
        const showOverlay = this.rows.length === 0;
        if (showOverlay) this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._service.getSalarySlips(this.pageIndex + 1, this.pageSize, {
                    employeeId: this.filterEmployeeId,
                    payrollFrequency: this.filterPayrollFrequency,
                    status: this.filterStatus,
                    slipStartFrom: this._dateToYmd(this.slipStartFromDate),
                    slipStartTo: this._dateToYmd(this.slipStartToDate),
                    slipEndFrom: this._dateToYmd(this.slipEndFromDate),
                    slipEndTo: this._dateToYmd(this.slipEndToDate),
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
        this.filterEmployeeId = null;
        this.filterPayrollFrequency = null;
        this.filterStatus = null;
        this.slipStartFromDate = null;
        this.slipStartToDate = null;
        this.slipEndFromDate = null;
        this.slipEndToDate = null;
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

    canSelectForStatusChange(slip: SalarySlipListItem): boolean {
        const status = String(slip?.status ?? '').toLowerCase();
        return status === 'pending' || status === 'verified';
    }

    employeeDisplayName(employeeId: string | undefined): string | null {
        if (!employeeId) return null;
        const e = this.employees.find((x) => x.id === employeeId);
        if (!e) return null;
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
        return name || null;
    }

    openDetail(slip: SalarySlipListItem): void {
        const emp = this.employees.find((e) => e.id === slip.employeeId);
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
        const companyId = this.employees.find((e) => e.id === slip.employeeId)?.companyId ?? null;
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
            const blob = await lastValueFrom(
                this._service.getSalarySlipPdf(slip.employeeId, slip.id, letterhead)
            );
            const subtitle =
                this.employeeDisplayName(slip.employeeId)?.trim() ||
                `${this._datePipe.transform(slip.startDate, 'mediumDate') ?? ''} — ${this._datePipe.transform(slip.endDate, 'mediumDate') ?? ''}`;
            this._matDialog.open(SalarySlipPdfDialogComponent, {
                data: {
                    blob,
                    filename: `salary-slip-${slip.id}.pdf`,
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
            this._toast.error('Invalid status change. Verified slips can only move to paid, and paid slips cannot be changed.');
            return;
        }
        this.bulkUpdating = true;
        try {
            await lastValueFrom(this._service.bulkUpdateStatus(ids, this.bulkStatus));
            this._toast.success(`Updated ${ids.length} salary slip${ids.length === 1 ? '' : 's'} to ${this.bulkStatus}`);
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
        const current = String(from ?? '').toLowerCase() as SalarySlipStatus;
        if (current === 'paid') return false;
        if (current === 'verified') return to === 'paid';
        if (current === 'pending') return to === 'verified' || to === 'paid';
        return false;
    }
}
