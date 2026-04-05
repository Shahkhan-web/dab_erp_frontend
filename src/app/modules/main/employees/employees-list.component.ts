import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { EmployeesService, EmployeeListItem } from './employees.service';
import { EmployeePersonalDialogComponent } from './dialogs/employee-personal-dialog.component';
import { EmployeeSalaryDialogComponent } from './dialogs/employee-salary-dialog.component';
import { EmployeeDetailDialogComponent } from './dialogs/employee-detail-dialog.component';
import { EmployeeDocumentsDialogComponent } from './dialogs/employee-documents-dialog.component';
import { EmployeeDocumentsViewDialogComponent } from './dialogs/employee-documents-view-dialog.component';
import { EmployeeJoiningDialogComponent } from './dialogs/employee-joining-dialog.component';
import { EmployeeContactDialogComponent } from './dialogs/employee-contact-dialog.component';
import { EmployeeLoanHistoryDialogComponent } from './dialogs/employee-loan-history-dialog.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
    selector: 'app-employees-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatCheckboxModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './employees-list.component.html',
})
export class EmployeesListComponent implements OnInit {
    private readonly _allDisplayedColumns = [
        'select',
        'avatar',
        'employeeId',
        'name',
        'nationality',
        'workingStatus',
        'profileCompletion',
        'createdAt',
        'documents',
        'actions',
    ] as const;

    displayedColumns: string[];
    employees: EmployeeListItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;
    selectedIds = new Set<string>();

    filterEmployeeId: string | null = null;
    filterName: string | null = null;
    filterNationality: string | null = null;
    filterWorkingStatus: string | null = null;

    constructor(
        private _employeesService: EmployeesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        const write = hasModuleWrite(this._auth.profileData, 'employee');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'select' && c !== 'actions');
    }

    get canWriteEmployee(): boolean {
        return hasModuleWrite(this._auth.profileData, 'employee');
    }

    get canWriteSalarySlip(): boolean {
        return hasModuleWrite(this._auth.profileData, 'salarySlip');
    }

    ngOnInit(): void {
        this.loadEmployees();
    }

    async loadEmployees(): Promise<void> {
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._employeesService.getEmployees(this.pageIndex + 1, this.pageSize, {
                    employeeId: this.filterEmployeeId?.trim() || null,
                    name: this.filterName,
                    nationality: this.filterNationality,
                    workingStatus: this.filterWorkingStatus,
                })
            );
            this.employees = resp.employees ?? [];
            this.total = resp.count ?? this.employees.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load employees');
            this.employees = [];
            this.total = 0;
        } finally {
            this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadEmployees();
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.loadEmployees();
    }

    clearFilters(): void {
        this.filterEmployeeId = null;
        this.filterName = null;
        this.filterNationality = null;
        this.filterWorkingStatus = null;
        this.applyFilters();
    }

    addEmployee(): void {
        this._router.navigate(['/main/employees/new']);
    }

    editEmployee(employee: EmployeeListItem): void {
        this._router.navigate(['/main/employees', employee.id, 'edit']);
    }

    openDetailDialog(employee: EmployeeListItem): void {
        this._matDialog.open(EmployeeDetailDialogComponent, {
            data: { id: employee.id },
            width: '90vw',
            maxWidth: '720px',
            disableClose: false,
        });
    }

    openPersonalDialog(employee: EmployeeListItem): void {
        this._matDialog
            .open(EmployeePersonalDialogComponent, { data: { employeeId: employee.id }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.loadEmployees();
            });
    }

    openContactDialog(employee: EmployeeListItem): void {
        this._matDialog
            .open(EmployeeContactDialogComponent, { data: { employeeId: employee.id }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.loadEmployees();
            });
    }

    openJoiningDialog(employee: EmployeeListItem): void {
        this._matDialog
            .open(EmployeeJoiningDialogComponent, { data: { employeeId: employee.id }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.loadEmployees();
            });
    }

    openSalaryDialog(employee: EmployeeListItem): void {
        this._matDialog
            .open(EmployeeSalaryDialogComponent, { data: { employeeId: employee.id }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.loadEmployees();
            });
    }

    createSalarySlipForEmployee(employee: EmployeeListItem): void {
        this._router.navigate(['/main/salary-slips/new'], {
            queryParams: { employeeId: employee.id },
        });
    }

    openLoanHistoryDialog(employee: EmployeeListItem): void {
        const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') || 'Employee';
        this._matDialog.open(EmployeeLoanHistoryDialogComponent, {
            data: { employeeId: employee.id, employeeName: name },
            width: '96vw',
            maxWidth: '960px',
            disableClose: false,
        });
    }

    /** View-only uploaded files (table “View documents” link). */
    openEmployeeDocumentsView(employee: EmployeeListItem): void {
        const employeeName =
            [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim() || undefined;
        this._matDialog.open(EmployeeDocumentsViewDialogComponent, {
            data: { employeeId: employee.id, employeeName },
            width: '90vw',
            maxWidth: '720px',
            disableClose: false,
        });
    }

    /** Passport & home country ID form (actions menu). */
    openDocumentsDialog(employee: EmployeeListItem): void {
        this._matDialog
            .open(EmployeeDocumentsDialogComponent, { data: { employeeId: employee.id }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.loadEmployees();
            });
    }

    async deleteEmployee(employee: EmployeeListItem): Promise<void> {
        const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') || 'this employee';
        const confirmed = await lastValueFrom(
            this._matDialog
                .open(ConfirmDeleteDialogComponent, {
                    data: { message: `Delete ${name}? This action cannot be undone.` },
                    width: '420px',
                })
                .afterClosed()
        );
        if (!confirmed) return;
        try {
            await lastValueFrom(this._employeesService.deleteEmployee(employee.id));
            this._toast.success('Employee deleted');
            this.selectedIds.delete(employee.id);
            this.loadEmployees();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to delete employee');
        }
    }

    get selectedCount(): number {
        return this.selectedIds.size;
    }

    isAllSelected(): boolean {
        if (this.employees.length === 0) return false;
        return this.employees.every((e) => this.selectedIds.has(e.id));
    }

    isIndeterminate(): boolean {
        const n = this.selectedIds.size;
        return n > 0 && n < this.employees.length;
    }

    toggleSelectAll(): void {
        if (this.isAllSelected()) {
            this.employees.forEach((e) => this.selectedIds.delete(e.id));
        } else {
            this.employees.forEach((e) => this.selectedIds.add(e.id));
        }
    }

    isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }

    toggleSelection(employee: EmployeeListItem): void {
        if (this.selectedIds.has(employee.id)) {
            this.selectedIds.delete(employee.id);
        } else {
            this.selectedIds.add(employee.id);
        }
    }

    clearSelection(): void {
        this.selectedIds.clear();
    }

    /** Alt text for list avatar (template cannot use global `Boolean`). */
    photoAlt(item: EmployeeListItem): string {
        const name = [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ').trim();
        return `${name || 'Employee'} photo`;
    }

    async openBulkDeleteConfirm(): Promise<void> {
        const count = this.selectedIds.size;
        const confirmed = await lastValueFrom(
            this._matDialog
                .open(ConfirmDeleteDialogComponent, {
                    data: {
                        message: `Delete ${count} employee${count === 1 ? '' : 's'}? This action cannot be undone.`,
                    },
                    width: '420px',
                })
                .afterClosed()
        );
        if (confirmed) await this.bulkDelete();
    }

    async bulkDelete(): Promise<void> {
        const ids = Array.from(this.selectedIds);
        if (ids.length === 0) return;
        try {
            await lastValueFrom(this._employeesService.bulkDelete(ids));
            this._toast.success(`${ids.length} employee${ids.length === 1 ? '' : 's'} deleted`);
            this.clearSelection();
            this.loadEmployees();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to delete employees');
        }
    }
}
