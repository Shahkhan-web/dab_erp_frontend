import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AbstractControl,
    FormArray,
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
import {
    MatNativeDateModule,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { MatStepperModule } from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom, map, merge, startWith } from 'rxjs';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { EmployeesService, EmployeeListItem } from '../employees/employees.service';
import { LoanListItem, LoansService } from '../loans/loans.service';
import { PayComponent, PayComponentsService } from '../pay-components/pay-components.service';
import {
    TalabatOccupationRate,
    TalabatOccupationRatesService,
} from '../talabat-occupation-rates/talabat-occupation-rates.service';
import {
    SalarySlipCreatePayload,
    SalarySlipsService,
} from './salary-slips.service';

function employeeOptionValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const v = control.value;
        if (v == null || v === '') return { required: false };
        if (typeof v === 'string') return { employeeNotSelected: true };
        if (typeof v === 'object' && (v as EmployeeListItem)?.id) return null;
        return { employeeNotSelected: true };
    };
}

@Component({
    selector: 'app-salary-slip-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatStepperModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatTooltipModule,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './salary-slip-form.component.html',
})
export class SalarySlipFormComponent implements OnInit {
    private _destroyRef = inject(DestroyRef);

    pageLoader = false;
    saving = false;
    payrollFrequencyOptions = ['monthly', 'fortnightly', 'bimonthly', 'weekly', 'daily'] as const;

    detailsForm: FormGroup;
    paymentForm: FormGroup;
    /** Step 1: wraps `detailsForm` + `paymentForm` for a single mat-step `stepControl`. */
    detailsAndPaymentForm: FormGroup;
    bankForm: FormGroup;
    riderForm: FormGroup;
    performanceForm: FormGroup;
    earningLines: FormArray<FormGroup>;
    deductionLines: FormArray<FormGroup>;
    loanDeductions: FormArray<FormGroup>;
    linesWrapperForm: FormGroup;
    riderPerformanceForm: FormGroup;
    /** Last step: wraps `bankForm` + `riderPerformanceForm` for a single mat-step `stepControl`. */
    bankAndRiderForm: FormGroup;

    employees: EmployeeListItem[] = [];
    filteredEmployees: EmployeeListItem[] = [];
    earningComponents: PayComponent[] = [];
    deductionComponents: PayComponent[] = [];
    employeeLoans: LoanListItem[] = [];
    /** Loaded from `GET talabat-occupation-rates` for rider earning calculation. */
    talabatOccupationRates: TalabatOccupationRate[] = [];
    private _employeeOccupationForRates: string | null = null;
    private _occRefreshToken = 0;
    /** After picking an option, focus returns to the input and (focus)/(click) would reopen the panel — skip once. */
    private _suppressNextEmployeePanelOpen = false;

    /** Kept in sync with `mat-step` count in the template (zero-based last index). */
    readonly lastStepIndex = 2;
    stepperIndex = 0;

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    constructor(
        private _fb: FormBuilder,
        private _router: Router,
        private _route: ActivatedRoute,
        private _salarySlipsService: SalarySlipsService,
        private _employeesService: EmployeesService,
        private _payComponentsService: PayComponentsService,
        private _loansService: LoansService,
        private _talabatOccupationRatesService: TalabatOccupationRatesService,
        private _toast: ToastrService
    ) {
        this.detailsForm = this._fb.group({
            employee: [null as EmployeeListItem | string | null, employeeOptionValidator()],
            payrollFrequency: ['monthly' ],
            startDate: [null as Date | null ],
            endDate: [null as Date | null ],
        });

        this.paymentForm = this._fb.group({
            workingDays: [22, [ Validators.min(0)]],
            absentDays: [0, [ Validators.min(0)]],
            leaveDaysWithoutPay: [0, [Validators.min(0)]],
        });

        this.bankForm = this._fb.group({
            bankName: [''],
            bankAccountNo: [''],
        });

        this.riderForm = this._fb.group({
            talabatCaseRiderEarning: [null as number | null],
            codDeduction: [null as number | null],
            deliveryIncentive: [null as number | null],
            inventoryDeduction: [null as number | null],
            fuelIncentive: [null as number | null],
            clawbackDeduction: [null as number | null],
        });

        this.performanceForm = this._fb.group({
            totalCompletedDeliveries: [0, [Validators.min(0)]],
            pickupsCount: [0, [Validators.min(0)]],
            dropoffsCount: [0, [Validators.min(0)]],
            deliveriesReturnLc: [0, [Validators.min(0)]],
            distanceLc: [0, [Validators.min(0)]],
        });
        this.performanceForm.get('totalCompletedDeliveries')!.disable({ emitEvent: false });
        this.riderForm.get('talabatCaseRiderEarning')!.disable({ emitEvent: false });

        merge(
            this.performanceForm.get('pickupsCount')!.valueChanges,
            this.performanceForm.get('dropoffsCount')!.valueChanges,
            this.performanceForm.get('deliveriesReturnLc')!.valueChanges
        )
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this._syncPerformanceDerivedFields());

        this.earningLines = this._fb.array<FormGroup>([]);
        this.deductionLines = this._fb.array<FormGroup>([]);
        this.loanDeductions = this._fb.array<FormGroup>([]);

        this.linesWrapperForm = this._fb.group({
            earningLines: this.earningLines,
            deductionLines: this.deductionLines,
            loanDeductions: this.loanDeductions,
        });

        this.riderPerformanceForm = this._fb.group({
            rider: this.riderForm,
            performance: this.performanceForm,
        });

        this.detailsAndPaymentForm = this._fb.group({
            details: this.detailsForm,
            payment: this.paymentForm,
        });

        this.bankAndRiderForm = this._fb.group({
            bank: this.bankForm,
            riderPerformance: this.riderPerformanceForm,
        });

        this.detailsForm
            .get('employee')!
            .valueChanges.pipe(
                startWith(this.detailsForm.get('employee')!.value),
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

        this.detailsForm
            .get('employee')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((v) => {
                if (v && typeof v === 'object' && (v as EmployeeListItem).id) {
                    const emp = v as EmployeeListItem;
                    this._loadLoansForEmployee(emp.id);
                    void this._syncEmployeeProfileFromServer(emp);
                } else {
                    this.employeeLoans = [];
                    this._employeeOccupationForRates = null;
                    this._syncPerformanceDerivedFields();
                }
            });
    }

    /** Rider / Talabat performance blocks are hidden for occupation `staff` (case-insensitive). */
    get showRiderPerformanceUi(): boolean {
        const occ = this._employeeOccupationForRates;
        if (!occ) return true;
        return this._normalizeOccupationKey(occ) !== 'staff';
    }

    /** Talabat rate row matching the selected employee occupation (normalized). */
    get appliedTalabatRate(): TalabatOccupationRate | undefined {
        return this._findRateForEmployeeOccupation(this._employeeOccupationForRates);
    }

    /** Shown under Talabat rider earning: count × rate breakdown. */
    get talabatEarningFormulaHint(): string {
        const rate = this.appliedTalabatRate;
        const p = Number(this.performanceForm.get('pickupsCount')?.value) || 0;
        const d = Number(this.performanceForm.get('dropoffsCount')?.value) || 0;
        const r = Number(this.performanceForm.get('deliveriesReturnLc')?.value) || 0;
        if (!rate) {
            if (!this._employeeOccupationForRates) {
                return 'Select an employee; Talabat earning uses their occupation and configured rates.';
            }
            return `No rate row for occupation “${this._employeeOccupationForRates}”. Check Talabat occupation rates.`;
        }
        return `${p}×${rate.pickupRateAed} + ${d}×${rate.dropoffRateAed} + ${r}×${rate.deliveriesReturnLcRateAed} AED`;
    }

    private _normalizeOccupationKey(s: string): string {
        return String(s).trim().toLowerCase().replace(/\s+/g, '_');
    }

    private _findRateForEmployeeOccupation(occ: string | null | undefined): TalabatOccupationRate | undefined {
        if (!occ || !this.talabatOccupationRates.length) return undefined;
        const want = this._normalizeOccupationKey(occ);
        return this.talabatOccupationRates.find((row) => this._normalizeOccupationKey(row.occupation) === want);
    }

    private _syncPerformanceDerivedFields(): void {
        const pickups = Number(this.performanceForm.get('pickupsCount')?.value) || 0;
        const dropoffs = Number(this.performanceForm.get('dropoffsCount')?.value) || 0;
        const returnLc = Number(this.performanceForm.get('deliveriesReturnLc')?.value) || 0;
        /** Total delivered orders = pickups − deliveries return LC (e.g. 111 − 2 = 109). */
        const total = Math.max(0, pickups - returnLc);
        this.performanceForm.patchValue({ totalCompletedDeliveries: total }, { emitEvent: false });

        const rate = this._findRateForEmployeeOccupation(this._employeeOccupationForRates);
        const earning = rate
            ? pickups * (Number(rate.pickupRateAed) || 0) +
              dropoffs * (Number(rate.dropoffRateAed) || 0) +
              returnLc * (Number(rate.deliveriesReturnLcRateAed) || 0)
            : 0;
        this.riderForm.patchValue({ talabatCaseRiderEarning: earning }, { emitEvent: false });
    }

    /**
     * Loads employee detail (same source as employee detail dialog) to set Talabat occupation for rates.
     */
    private async _syncEmployeeProfileFromServer(emp: EmployeeListItem | null): Promise<void> {
        const token = ++this._occRefreshToken;
        if (!emp?.id) {
            this._employeeOccupationForRates = null;
            if (token === this._occRefreshToken) this._syncPerformanceDerivedFields();
            return;
        }
        const listOcc = String((emp as Record<string, unknown>)['occupation'] ?? '').trim();
        this._employeeOccupationForRates = listOcc || null;
        try {
            const res = await lastValueFrom(this._employeesService.getEmployee(emp.id));
            if (token !== this._occRefreshToken) return;
            const full = (res as { data?: Record<string, unknown> })?.data ?? (res as Record<string, unknown>);
            const occ = String(full['occupation'] ?? (emp as Record<string, unknown>)['occupation'] ?? '').trim();
            this._employeeOccupationForRates = occ || null;
        } catch {
            if (token !== this._occRefreshToken) return;
            this._employeeOccupationForRates =
                String((emp as Record<string, unknown>)['occupation'] ?? '').trim() || null;
        }
        this._syncPerformanceDerivedFields();
    }

    private async _refreshEmployeeOccupationFromDetailsIfAny(): Promise<void> {
        const v = this.detailsForm.get('employee')!.value;
        if (v && typeof v === 'object' && (v as EmployeeListItem).id) {
            await this._syncEmployeeProfileFromServer(v as EmployeeListItem);
        } else {
            this._employeeOccupationForRates = null;
            this._syncPerformanceDerivedFields();
        }
    }

    async ngOnInit(): Promise<void> {
        this.pageLoader = true;
        try {
            const talabatItemsPromise = lastValueFrom(this._talabatOccupationRatesService.getRates())
                .then((r) => r.items ?? [])
                .catch(() => [] as TalabatOccupationRate[]);

            const [empResp, pcResp, talabatItems] = await Promise.all([
                lastValueFrom(this._employeesService.getEmployees(1, 100, {})),
                lastValueFrom(
                    this._payComponentsService.getPayComponents(undefined, undefined, { isActive: true })
                ),
                talabatItemsPromise,
            ]);
            this.talabatOccupationRates = talabatItems;
            this.employees = empResp.employees ?? [];
            const pcs = pcResp.items ?? [];
            this.earningComponents = pcs.filter((p) => p.type === 'earning');
            this.deductionComponents = pcs.filter((p) => p.type === 'deduction');
            this.refreshEmployeeFilterList();
            await this._applyPreselectedEmployeeFromQuery();
            this.addEarningRow();
            this.addDeductionRow();
            await this._refreshEmployeeOccupationFromDetailsIfAny();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load form data');
        } finally {
            this.pageLoader = false;
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
        this.refreshEmployeeFilterList();
        setTimeout(() => {
            trigger.updatePosition();
            trigger.openPanel();
        });
    }

    onStepperSelectionChange(ev: StepperSelectionEvent): void {
        this.stepperIndex = ev.selectedIndex;
    }

    private refreshEmployeeFilterList(): void {
        const val = this.detailsForm.get('employee')!.value;
        const q = typeof val === 'string' ? val : val ? this.employeeLabel(val as EmployeeListItem) : '';
        this.filteredEmployees = this._filterEmployees(q);
    }

    /** When opened from e.g. employees list with `?employeeId=`. */
    private async _applyPreselectedEmployeeFromQuery(): Promise<void> {
        const id = this._route.snapshot.queryParamMap.get('employeeId')?.trim();
        if (!id) return;
        let emp = this.employees.find((e) => e.id === id);
        if (!emp) {
            try {
                emp = (await lastValueFrom(this._employeesService.getEmployee(id))) as EmployeeListItem;
                this.employees = [emp, ...this.employees.filter((e) => e.id !== id)];
            } catch {
                this._toast.error('Could not load the selected employee');
                return;
            }
        }
        this.detailsForm.patchValue({ employee: emp });
        this.refreshEmployeeFilterList();
    }

    employeeLabel(e: EmployeeListItem): string {
        const empId = String(e.employeeId ?? '').trim() || e.id;
        const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
        const arabic = String(e.employeeNameArabic ?? '').trim();
        return [empId, name, arabic].filter(Boolean).join(' ');
    }

    private _filterEmployees(query: string): EmployeeListItem[] {
        const q = query.trim().toLowerCase();
        if (!q) return this.employees;
        return this.employees.filter(
            (e) =>
                this.employeeLabel(e).toLowerCase().includes(q) ||
                e.id.toLowerCase().includes(q) ||
                `${e.firstName ?? ''} ${e.lastName ?? ''}`.toLowerCase().includes(q) ||
                String(e.employeeId ?? '').toLowerCase().includes(q) ||
                String(e.employeeNameArabic ?? '').toLowerCase().includes(q)
        );
    }

    private async _loadLoansForEmployee(employeeId: string): Promise<void> {
        try {
            const resp = await lastValueFrom(
                this._loansService.getLoans(1, 100, { employeeId })
            );
            this.employeeLoans = resp.data ?? [];
        } catch {
            this.employeeLoans = [];
        }
    }

    private _lineGroup(): FormGroup {
        return this._fb.group({
            payComponentId: [''],
            amount: [null as number | null, [ Validators.min(0)]],
        });
    }

    private _loanDeductionGroup(): FormGroup {
        return this._fb.group({
            loanId: [''],
            loanDeductionAmount: [null as number | null],
        });
    }

    addEarningRow(): void {
        this.earningLines.push(this._lineGroup());
    }

    removeEarningRow(index: number): void {
        if (this.earningLines.length <= 1) return;
        this.earningLines.removeAt(index);
    }

    addDeductionRow(): void {
        this.deductionLines.push(this._lineGroup());
    }

    removeDeductionRow(index: number): void {
        if (this.deductionLines.length <= 1) return;
        this.deductionLines.removeAt(index);
    }

    addLoanDeductionRow(): void {
        this.loanDeductions.push(this._loanDeductionGroup());
    }

    removeLoanDeductionRow(index: number): void {
        this.loanDeductions.removeAt(index);
    }

    sumLineAmounts(arr: FormArray<FormGroup>): number {
        let s = 0;
        for (const c of arr.controls) {
            const amt = Number(c.get('amount')?.value);
            if (!isNaN(amt)) s += amt;
        }
        return s;
    }

    sumLoanDeductions(): number {
        let s = 0;
        for (const c of this.loanDeductions.controls) {
            const amt = Number(c.get('loanDeductionAmount')?.value);
            if (!isNaN(amt)) s += amt;
        }
        return s;
    }

    get grossFromEarnings(): number {
        return this.sumLineAmounts(this.earningLines);
    }

    get totalDeductionAmount(): number {
        return this.sumLineAmounts(this.deductionLines) + this.sumLoanDeductions();
    }

    get netPayPreview(): number {
        return this.grossFromEarnings - this.totalDeductionAmount;
    }

    /** YYYY-MM-DD using the user's local calendar date (not UTC — avoids `toISOString` shifting the day). */
    private _fmtDate(d: Date | null): string | null {
        if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    private _numOrUndef(v: unknown): number | undefined {
        if (v === '' || v === null || v === undefined) return undefined;
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }

    cancel(): void {
        this._router.navigate(['/main/salary-slips']);
    }

    async save(): Promise<void> {
        await this._save();
    }

    private async _save(): Promise<void> {
        const empCtrl = this.detailsForm.get('employee')!;
        if (this.detailsForm.invalid || this.paymentForm.invalid) {
            this.detailsForm.markAllAsTouched();
            this.paymentForm.markAllAsTouched();
            empCtrl.markAsTouched();
            this._toast.error('Complete Details and Payment days');
            return;
        }
        const emp = empCtrl.value as EmployeeListItem;
        if (!emp?.id) {
            this._toast.error('Select an employee');
            return;
        }

        const linesValid = (arr: FormArray<FormGroup>): boolean => {
            for (const c of arr.controls) {
                const id = c.get('payComponentId')?.value;
                const amt = c.get('amount')?.value;
                const idEmpty = !id;
                const amtEmpty = amt === null || amt === '' || amt === undefined;
                if (idEmpty && amtEmpty) continue;
                if (idEmpty && !amtEmpty) return false;
                if (!idEmpty && (amtEmpty || isNaN(Number(amt)) || Number(amt) < 0)) return false;
            }
            return true;
        };
        if (!linesValid(this.earningLines) || !linesValid(this.deductionLines)) {
            this.earningLines.controls.forEach((c) => c.markAllAsTouched());
            this.deductionLines.controls.forEach((c) => c.markAllAsTouched());
            this._toast.error('Complete all pay component rows (or clear unused rows)');
            return;
        }

        const loansValid = (): boolean => {
            for (const c of this.loanDeductions.controls) {
                const lid = c.get('loanId')?.value;
                const amt = c.get('loanDeductionAmount')?.value;
                const lidEmpty = !lid;
                const amtEmpty = amt === null || amt === '' || amt === undefined;
                if (lidEmpty && amtEmpty) continue;
                if (!lidEmpty && (amtEmpty || isNaN(Number(amt)) || Number(amt) <= 0)) return false;
                if (lidEmpty && !amtEmpty) return false;
            }
            return true;
        };
        if (!loansValid()) {
            this.loanDeductions.controls.forEach((c) => c.markAllAsTouched());
            this._toast.error('Complete loan deduction rows or clear them');
            return;
        }

        const lines = [
            ...this.earningLines.value
                .filter((r: { payComponentId: string }) => r.payComponentId)
                .map((r: { payComponentId: string; amount: number }) => ({
                    payComponentId: r.payComponentId,
                    amount: Number(r.amount),
                })),
            ...this.deductionLines.value
                .filter((r: { payComponentId: string }) => r.payComponentId)
                .map((r: { payComponentId: string; amount: number }) => ({
                    payComponentId: r.payComponentId,
                    amount: Number(r.amount),
                })),
        ];

        if (lines.length === 0) {
            this._toast.error('Add at least one earnings or deduction line');
            return;
        }

        const loanRows = this.loanDeductions.value.filter(
            (r: { loanId: string; loanDeductionAmount: number }) =>
                r.loanId && r.loanDeductionAmount != null && Number(r.loanDeductionAmount) > 0
        );

        const d = this.detailsForm.getRawValue();
        const p = this.paymentForm.getRawValue();
        const start = this._fmtDate(d.startDate);
        const end = this._fmtDate(d.endDate);
        if (!start || !end) {
            this._toast.error('Select start and end dates');
            return;
        }

        const perf = this.performanceForm.getRawValue();
        const rider = this.riderForm.getRawValue();
        const bank = this.bankForm.getRawValue();

        const payload: SalarySlipCreatePayload = {
            payrollFrequency: d.payrollFrequency,
            startDate: start,
            endDate: end,
            workingDays: Number(p.workingDays) || 0,
            absentDays: Number(p.absentDays) || 0,
            leaveDaysWithoutPay: Number(p.leaveDaysWithoutPay) || 0,
            lines,
            loanDeductions:
                loanRows.length > 0
                    ? loanRows.map(
                          (r: { loanId: string; loanDeductionAmount: number }) => ({
                              loanId: r.loanId,
                              loanDeductionAmount: Number(r.loanDeductionAmount),
                          })
                      )
                    : undefined,
            performance: {
                totalCompletedDeliveries: Number(perf.totalCompletedDeliveries) || 0,
                pickupsCount: Number(perf.pickupsCount) || 0,
                dropoffsCount: Number(perf.dropoffsCount) || 0,
                deliveriesReturnLc: Number(perf.deliveriesReturnLc) || 0,
                distanceLc: Number(perf.distanceLc) || 0,
            },
        };

        const tn = this._numOrUndef(rider.talabatCaseRiderEarning);
        if (tn !== undefined) payload.talabatCaseRiderEarning = tn;
        const cod = this._numOrUndef(rider.codDeduction);
        if (cod !== undefined) payload.codDeduction = cod;
        const di = this._numOrUndef(rider.deliveryIncentive);
        if (di !== undefined) payload.deliveryIncentive = di;
        const inv = this._numOrUndef(rider.inventoryDeduction);
        if (inv !== undefined) payload.inventoryDeduction = inv;
        const fi = this._numOrUndef(rider.fuelIncentive);
        if (fi !== undefined) payload.fuelIncentive = fi;
        const cb = this._numOrUndef(rider.clawbackDeduction);
        if (cb !== undefined) payload.clawbackDeduction = cb;

        if (bank.bankName?.trim()) payload.bankName = bank.bankName.trim();
        if (bank.bankAccountNo?.trim()) payload.bankAccountNo = bank.bankAccountNo.trim();

        this.saving = true;
        try {
            await lastValueFrom(this._salarySlipsService.createSalarySlip(emp.id, payload));
            this._toast.success('Salary slip created');

            await this._router.navigate(['/main/salary-slips']);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to create salary slip');
        } finally {
            this.saving = false;
        }
    }
}
