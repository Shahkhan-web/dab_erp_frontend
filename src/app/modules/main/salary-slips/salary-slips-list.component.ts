import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { CompaniesService } from '../companies/companies.service';
import { EmployeeListItem, EmployeesService } from '../employees/employees.service';
import {
    SalarySlipDetailDialogComponent,
    SalarySlipDetailDialogData,
} from './salary-slip-detail-dialog.component';
import { SalarySlipLetterheadChoiceDialogComponent } from './salary-slip-letterhead-choice-dialog.component';
import { SalarySlipPdfDialogComponent } from './salary-slip-pdf-dialog.component';
import { SalarySlipListItem, SalarySlipsService } from './salary-slips.service';

@Component({
    selector: 'app-salary-slips-list',
    standalone: true,
    providers: [DatePipe],
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
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
    displayedColumns: string[] = [
        'employeeId',
        'employeeName',
        'status',
        'period',
        'workingDays',
        'grossPayment',
        'totalDeduction',
        'netPayment',
        'createdAt',
        'actions',
    ];
    rows: SalarySlipListItem[] = [];
    /** Row `slip.id` while its PDF is loading for the viewer (disables that row’s PDF button). */
    pdfLoadingSlipId: string | null = null;
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterEmployeeId: string | null = null;
    filterPayrollFrequency: string | null = null;
    /** UI: mapped to `slipStartFrom` / `slipStartTo` query params as `YYYY-MM-DD` (local). */
    slipStartFromDate: Date | null = null;
    slipStartToDate: Date | null = null;
    /** UI: mapped to `slipEndFrom` / `slipEndTo` query params as `YYYY-MM-DD` (local). */
    slipEndFromDate: Date | null = null;
    slipEndToDate: Date | null = null;

    employees: EmployeeListItem[] = [];

    payrollFrequencyOptions = ['monthly', 'fortnightly', 'bimonthly', 'weekly', 'daily'] as const;

    constructor(
        private _service: SalarySlipsService,
        private _employeesService: EmployeesService,
        private _companiesService: CompaniesService,
        private _router: Router,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService,
        private _datePipe: DatePipe
    ) {}

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
        await Promise.all([this._loadEmployees(), this.loadList()]);
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
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._service.getSalarySlips(this.pageIndex + 1, this.pageSize, {
                    employeeId: this.filterEmployeeId,
                    payrollFrequency: this.filterPayrollFrequency,
                    slipStartFrom: this._dateToYmd(this.slipStartFromDate),
                    slipStartTo: this._dateToYmd(this.slipStartToDate),
                    slipEndFrom: this._dateToYmd(this.slipEndFromDate),
                    slipEndTo: this._dateToYmd(this.slipEndToDate),
                })
            );
            this.rows = resp.data ?? [];
            this.total = resp.count ?? this.rows.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load salary slips');
            this.rows = [];
            this.total = 0;
        } finally {
            this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadList();
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.loadList();
    }

    clearFilters(): void {
        this.filterEmployeeId = null;
        this.filterPayrollFrequency = null;
        this.slipStartFromDate = null;
        this.slipStartToDate = null;
        this.slipEndFromDate = null;
        this.slipEndToDate = null;
        this.applyFilters();
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
}
