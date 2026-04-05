import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom, map, startWith } from 'rxjs';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { EmployeesService, EmployeeListItem } from '../employees/employees.service';
import { LoansService } from './loans.service';

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
export class LoanFormComponent implements OnInit {
    private _destroyRef = inject(DestroyRef);

    pageLoader = false;
    saving = false;
    form: FormGroup;
    employees: EmployeeListItem[] = [];
    applicantTypeOptions: LabeledOption[] = [{ value: 'employee', label: 'Employee' }];
    statusOptions: LabeledOption[] = [{ value: 'open', label: 'Open' }];
    filteredEmployees: EmployeeListItem[] = [];
    filteredApplicantOptions: LabeledOption[] = [];
    filteredStatusOptions: LabeledOption[] = [];

    constructor(
        private _fb: FormBuilder,
        private _router: Router,
        private _loansService: LoansService,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
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
            .valueChanges.pipe(
                startWith(this.form.get('employee')!.value),
                map((val) =>
                    this._filterEmployees(
                        typeof val === 'string' ? val : val ? this.employeeLabel(val as EmployeeListItem) : ''
                    )
                ),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((list) => {
                this.filteredEmployees = list;
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
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(this._employeesService.getEmployees(1, 100, {}));
            this.employees = resp.employees ?? [];
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load employees');
        } finally {
            this.pageLoader = false;
            this.refreshEmployeeFilterList();
        }
    }

    /**
     * Options only updated on valueChanges; recompute after employees are loaded so focus can open a full list.
     */
    private refreshEmployeeFilterList(): void {
        const val = this.form.get('employee')!.value;
        const q = typeof val === 'string' ? val : val ? this.employeeLabel(val as EmployeeListItem) : '';
        this.filteredEmployees = this._filterEmployees(q);
    }

    /** Deferred open so the overlay attaches after change detection (Material autocomplete + focus). */
    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        this.refreshEmployeeFilterList();
        setTimeout(() => trigger.openPanel());
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

    private _filterEmployees(query: string): EmployeeListItem[] {
        const q = query.trim().toLowerCase();
        if (!q) return this.employees;
        return this.employees.filter(
            (e) =>
                this.employeeLabel(e).toLowerCase().includes(q) ||
                (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
                `${e.firstName ?? ''} ${e.middleName ?? ''} ${e.lastName ?? ''}`.toLowerCase().includes(q) ||
                e.id.toLowerCase().includes(q)
        );
    }

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
        const v = this.form.value;
        const emp = v.employee as EmployeeListItem;
        this.saving = true;
        try {
            await lastValueFrom(
                this._loansService.createLoan(emp.id, {
                    applicantType: v.applicantType,
                    loanName: v.loanName,
                    loanAmount: Number(v.loanAmount),
                    reason: v.reason,
                    remarks: v.remarks || '',
                    status: v.status,
                })
            );
            this._toast.success('Loan created');
            await this._router.navigate(['/main/loans']);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to create loan');
        } finally {
            this.saving = false;
        }
    }

    cancel(): void {
        this._router.navigate(['/main/loans']);
    }
}
