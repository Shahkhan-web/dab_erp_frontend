import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom, map, startWith } from 'rxjs';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { EmployeeAutocompleteSearch } from '../employees/employee-autocomplete-search';
import { EmployeesService, EmployeeListItem } from '../employees/employees.service';
import { LoanListItem, LoansService } from './loans.service';

type LabeledOption = { value: string; label: string };

function employeeOptionValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const v = control.value;
        if (v == null || v === '') return { required: true };
        if (typeof v === 'string') return { employeeNotSelected: true };
        if (typeof v === 'object' && (v as EmployeeListItem)?.id) return null;
        return { employeeNotSelected: true };
    };
}

function permittedValueValidator(allowed: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const v = control.value;
        if (v == null || v === '') return { required: true };
        if (typeof v !== 'string' || !allowed.includes(v)) return { invalidOption: true };
        return null;
    };
}

@Component({
    selector: 'app-loan-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatAutocompleteModule,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './loan-form.component.html',
})
export class LoanFormComponent implements OnInit, OnDestroy {
    private _destroyRef = inject(DestroyRef);

    pageLoader = false;
    saving = false;
    /** Set when URL is `/main/loans/:employeeId/edit/:loanId`. */
    editMode = false;
    /** Minimum loan amount (≥ total deducted so far) when editing. */
    minLoanAmount = 0.01;
    private _editEmployeeId: string | null = null;
    private _editLoanId: string | null = null;

    form: FormGroup;
    readonly employeeSearch: EmployeeAutocompleteSearch;
    applicantTypeOptions: LabeledOption[] = [{ value: 'employee', label: 'Employee' }];
    statusOptions: LabeledOption[] = [{ value: 'open', label: 'Open' }];
    filteredApplicantOptions: LabeledOption[] = [];
    filteredStatusOptions: LabeledOption[] = [];

    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

    constructor(
        private _fb: FormBuilder,
        private _router: Router,
        private _route: ActivatedRoute,
        private _loansService: LoansService,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);

        this.form = this._fb.group({
            employee: [null as EmployeeListItem | string | null, employeeOptionValidator()],
            applicantType: ['employee', [permittedValueValidator(['employee'])]],
            loanName: ['', Validators.required],
            loanAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
            reason: ['', Validators.required],
            remarks: [''],
            status: ['open', [permittedValueValidator(['open'])]],
        });

        this.form
            .get('employee')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((val) => {
                if (val && typeof val === 'object') return;
                this._employeeSearchApply.schedule();
            });

        this.form
            .get('applicantType')!
            .valueChanges.pipe(
                startWith(this.form.get('applicantType')!.value as string),
                map((val) => this._filterLabeled(typeof val === 'string' ? val : '', this.applicantTypeOptions)),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((list) => {
                this.filteredApplicantOptions = list;
            });

        this.form
            .get('status')!
            .valueChanges.pipe(
                startWith(this.form.get('status')!.value as string),
                map((val) => this._filterLabeled(typeof val === 'string' ? val : '', this.statusOptions)),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((list) => {
                this.filteredStatusOptions = list;
            });
    }

    async ngOnInit(): Promise<void> {
        const employeeId = this._route.snapshot.paramMap.get('employeeId');
        const loanId = this._route.snapshot.paramMap.get('loanId');
        this.pageLoader = true;
        try {
            if (employeeId && loanId) {
                await this._loadEditMode(employeeId, loanId);
            } else {
                await this.employeeSearch.resetAndLoad();
            }
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load page');
        } finally {
            this.pageLoader = false;
        }
    }

    ngOnDestroy(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private _employeeSearchQuery(): string {
        const val = this.form.get('employee')!.value;
        return typeof val === 'string' ? val.trim() : '';
    }

    private async _scheduleEmployeeSearch(): Promise<void> {
        await this.employeeSearch.resetAndLoad(this._employeeSearchQuery());
    }

    private async _loadEditMode(employeeId: string, loanId: string): Promise<void> {
        let loan: LoanListItem;
        try {
            const loanRaw = await lastValueFrom(this._loansService.getLoan(employeeId, loanId));
            const raw = (loanRaw as { data?: LoanListItem })?.data ?? loanRaw;
            loan = raw as LoanListItem;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Loan not found');
            await this._router.navigate(['/main/loans']);
            return;
        }
        if ((loan.status || '').toLowerCase() !== 'open') {
            this._toast.error('Only open loans can be edited');
            await this._router.navigate(['/main/loans']);
            return;
        }

        let emp: EmployeeListItem;
        try {
            const empRaw = await lastValueFrom(this._employeesService.getEmployee(employeeId));
            const raw = (empRaw as { data?: EmployeeListItem })?.data ?? empRaw;
            emp = raw as EmployeeListItem;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load employee');
            await this._router.navigate(['/main/loans']);
            return;
        }

        this.editMode = true;
        this._editEmployeeId = employeeId;
        this._editLoanId = loanId;
        const deducted = Number(loan.totalDeductedSoFar);
        this.minLoanAmount = Math.max(Number.isFinite(deducted) ? deducted : 0, 0.01);

        this.employeeSearch.items = [emp];
        this.employeeSearch.hasMore = false;

        this.form.patchValue({
            employee: emp,
            applicantType: loan.applicantType,
            loanName: loan.loanName,
            loanAmount: loan.loanAmount,
            reason: this._unknownToFormString(loan.reason),
            remarks: this._unknownToFormString(loan.remarks),
            status: 'open',
        });

        this.form.get('employee')?.disable();
        this.form.get('status')?.disable();
        this.form.get('reason')?.clearValidators();
        this.form.get('reason')?.updateValueAndValidity();

        this.form
            .get('loanAmount')
            ?.setValidators([Validators.required, Validators.min(this.minLoanAmount)]);
        this.form.get('loanAmount')?.updateValueAndValidity();
    }

    private _unknownToFormString(value: unknown): string {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }

    /** Deferred open so the overlay attaches after change detection (Material autocomplete + focus). */
    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        void this.employeeSearch.resetAndLoad(this._employeeSearchQuery()).then(() => {
            setTimeout(() => trigger.openPanel());
        });
    }

    onEmployeeAutocompleteOpened(auto: MatAutocomplete): void {
        this.employeeSearch.bindPanelScroll(auto);
    }

    onEmployeeAutocompleteClosed(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    employeeLabel(e: EmployeeListItem): string {
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Employee';
        const empId = e.employeeId?.trim();
        return empId ? `${empId} ${name}` : name;
    }

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    displayApplicantTypeLabel = (value: string | null): string => {
        if (value == null || value === '') return '';
        return this.applicantTypeOptions.find((o) => o.value === value)?.label ?? value;
    };

    displayStatusLabel = (value: string | null): string => {
        if (value == null || value === '') return '';
        return this.statusOptions.find((o) => o.value === value)?.label ?? value;
    };

    private _filterLabeled(query: string, options: LabeledOption[]): LabeledOption[] {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(
            (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
        );
    }

    async submit(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const loanName = String(v.loanName ?? '').trim();
        if (!loanName) {
            this._toast.error('Loan name is required');
            return;
        }

        this.saving = true;
        try {
            if (this.editMode && this._editEmployeeId && this._editLoanId) {
                const reasonTrim = String(v.reason ?? '').trim();
                const remarksTrim = String(v.remarks ?? '').trim();
                await lastValueFrom(
                    this._loansService.updateLoan(this._editEmployeeId, this._editLoanId, {
                        applicantType: v.applicantType,
                        loanName,
                        loanAmount: Number(v.loanAmount),
                        reason: reasonTrim === '' ? null : reasonTrim,
                        remarks: remarksTrim === '' ? null : remarksTrim,
                    })
                );
                this._toast.success('Loan updated');
            } else {
                const emp = v.employee as EmployeeListItem;
                await lastValueFrom(
                    this._loansService.createLoan(emp.id, {
                        applicantType: v.applicantType,
                        loanName,
                        loanAmount: Number(v.loanAmount),
                        reason: v.reason,
                        remarks: v.remarks || '',
                        status: v.status,
                    })
                );
                this._toast.success('Loan created');
            }
            await this._router.navigate(['/main/loans']);
        } catch (e: any) {
            this._toast.error(
                e?.error?.message ||
                    (this.editMode ? 'Failed to update loan' : 'Failed to create loan')
            );
        } finally {
            this.saving = false;
        }
    }

    cancel(): void {
        this._router.navigate(['/main/loans']);
    }
}
