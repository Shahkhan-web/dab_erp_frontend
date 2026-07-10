import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
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
import { MatAutocompleteModule, MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
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
import { lastValueFrom, merge } from 'rxjs';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { EmployeeAutocompleteSearch } from '../employees/employee-autocomplete-search';
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
export class SalarySlipFormComponent implements OnInit, OnDestroy {
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

    readonly employeeSearch: EmployeeAutocompleteSearch;
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
    isEditMode = false;
    editEmployeeId: string | null = null;
    editSalarySlipId: string | null = null;

    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

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
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);

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
        this.performanceForm.get('totalCompletedDeliveries');
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
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((v) => {
                if (v && typeof v === 'object' && (v as EmployeeListItem).id) {
                    const emp = v as EmployeeListItem;
                    this._loadLoansForEmployee(emp.id);
                    void this._syncEmployeeProfileFromServer(emp);
                    return;
                }
                if (v && typeof v === 'object') return;
                this.employeeLoans = [];
                this._employeeOccupationForRates = null;
                this._syncPerformanceDerivedFields();
                this._employeeSearchApply.schedule();
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

            const [pcResp, talabatItems] = await Promise.all([
                lastValueFrom(
                    this._payComponentsService.getPayComponents(undefined, undefined, { isActive: true })
                ),
                talabatItemsPromise,
            ]);
            this.talabatOccupationRates = talabatItems;
            const pcs = pcResp.items ?? [];
            this.earningComponents = pcs.filter((p) => p.type === 'earning');
            this.deductionComponents = pcs.filter((p) => p.type === 'deduction');
            await this.employeeSearch.resetAndLoad();
            await this._applyPreselectedEmployeeFromQuery();
            await this._initEditIfNeeded();
            if (this.earningLines.length === 0) this.addEarningRow();
            if (this.deductionLines.length === 0) this.addDeductionRow();
            await this._refreshEmployeeOccupationFromDetailsIfAny();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load form data');
        } finally {
            this.pageLoader = false;
        }
    }

    ngOnDestroy(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private _employeeSearchQuery(): string {
        const val = this.detailsForm.get('employee')!.value;
        return typeof val === 'string' ? val.trim() : '';
    }

    private async _scheduleEmployeeSearch(): Promise<void> {
        await this.employeeSearch.resetAndLoad(this._employeeSearchQuery());
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

    onStepperSelectionChange(ev: StepperSelectionEvent): void {
        this.stepperIndex = ev.selectedIndex;
    }

    /** When opened from e.g. employees list with `?employeeId=`. */
    private async _applyPreselectedEmployeeFromQuery(): Promise<void> {
        if (this.isEditMode) return;
        const id = this._route.snapshot.queryParamMap.get('employeeId')?.trim();
        if (!id) return;
        let emp = this.employeeSearch.items.find((e) => e.id === id);
        if (!emp) {
            try {
                emp = (await lastValueFrom(this._employeesService.getEmployee(id))) as EmployeeListItem;
                this.employeeSearch.ensureInList(emp);
            } catch {
                this._toast.error('Could not load the selected employee');
                return;
            }
        }
        this.detailsForm.patchValue({ employee: emp });
    }

    employeeLabel(e: EmployeeListItem): string {
        const empId = String(e.employeeId ?? '').trim() || e.id;
        const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
        const arabic = String(e.employeeNameArabic ?? '').trim();
        return [empId, name, arabic].filter(Boolean).join(' ');
    }

    private async _loadLoansForEmployee(employeeId: string): Promise<void> {
        try {
            const resp = await lastValueFrom(
                this._loansService.getLoans(1, 100, { employeeId, status: 'disbursed' })
            );
            this.employeeLoans = (resp.data ?? []).filter((l) => Number(l.remaining) > 0);
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

    private _toLocalDate(value: unknown): Date | null {
        if (!value || typeof value !== 'string') return null;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    private _setLineArray(arr: FormArray<FormGroup>, items: Array<{ payComponentId: string; amount: number }>): void {
        arr.clear();
        items.forEach((row) => {
            const g = this._lineGroup();
            g.patchValue({
                payComponentId: row.payComponentId,
                amount: Number(row.amount) || 0,
            });
            arr.push(g);
        });
    }

    private async _initEditIfNeeded(): Promise<void> {
        const employeeId = this._route.snapshot.paramMap.get('employeeId')?.trim();
        const salarySlipId = this._route.snapshot.paramMap.get('salarySlipId')?.trim();
        if (!employeeId || !salarySlipId) return;
        this.isEditMode = true;
        this.editEmployeeId = employeeId;
        this.editSalarySlipId = salarySlipId;
        const slip = await lastValueFrom(this._salarySlipsService.getSalarySlip(employeeId, salarySlipId));
        if (String(slip.status ?? '').toLowerCase() !== 'pending') {
            this._toast.error('Only pending salary slips can be edited');
            await this._router.navigate(['/main/salary-slips']);
            return;
        }
        let selectedEmployee = this.employeeSearch.items.find((e) => e.id === employeeId) ?? null;
        if (!selectedEmployee) {
            try {
                selectedEmployee = (await lastValueFrom(
                    this._employeesService.getEmployee(employeeId)
                )) as EmployeeListItem;
            } catch {
                selectedEmployee = null;
            }
        }
        if (selectedEmployee) {
            this.employeeSearch.ensureInList(selectedEmployee);
        }
        this.detailsForm.patchValue({
            employee: selectedEmployee,
            payrollFrequency: slip.payrollFrequency ?? 'monthly',
            startDate: this._toLocalDate(slip.startDate),
            endDate: this._toLocalDate(slip.endDate),
        });
        this.detailsForm.get('employee')!.disable({ emitEvent: false });
        this.paymentForm.patchValue({
            workingDays: Number(slip.workingDays) || 0,
            absentDays: Number(slip.absentDays) || 0,
            leaveDaysWithoutPay: Number(slip.leaveDaysWithoutPay) || 0,
        });
        this.bankForm.patchValue({
            bankName: typeof slip.bankName === 'string' ? slip.bankName : '',
            bankAccountNo: typeof slip.bankAccountNo === 'string' ? slip.bankAccountNo : '',
        });
        this.riderForm.patchValue({
            talabatCaseRiderEarning: this._numOrUndef(slip.talabatCaseRiderEarning) ?? null,
            codDeduction: this._numOrUndef(slip.codDeduction) ?? null,
            deliveryIncentive: this._numOrUndef(slip.deliveryIncentive) ?? null,
            inventoryDeduction: this._numOrUndef(slip.inventoryDeduction) ?? null,
            fuelIncentive: this._numOrUndef(slip.fuelIncentive) ?? null,
            clawbackDeduction: this._numOrUndef(slip.clawbackDeduction) ?? null,
        });
        this.performanceForm.patchValue({
            totalCompletedDeliveries: Number(slip.performance?.totalCompletedDeliveries) || 0,
            pickupsCount: Number(slip.performance?.pickupsCount) || 0,
            dropoffsCount: Number(slip.performance?.dropoffsCount) || 0,
            deliveriesReturnLc: Number(slip.performance?.deliveriesReturnLc) || 0,
            distanceLc: Number(slip.performance?.distanceLc) || 0,
        });
        const earningPayComponentIds = new Set(this.earningComponents.map((c) => c.id));
        const deductionPayComponentIds = new Set(this.deductionComponents.map((c) => c.id));
        const earnings =
            slip.lines
                ?.filter((line) => earningPayComponentIds.has(line.payComponentId) || line.componentType === 'earning')
                .map((line) => ({
                    payComponentId: line.payComponentId,
                    amount: Number(line.amount) || 0,
                })) ?? [];
        const deductions =
            slip.lines
                ?.filter((line) => deductionPayComponentIds.has(line.payComponentId) || line.componentType === 'deduction')
                .map((line) => ({
                    payComponentId: line.payComponentId,
                    amount: Number(line.amount) || 0,
                })) ?? [];
        this._setLineArray(this.earningLines, earnings);
        this._setLineArray(this.deductionLines, deductions);
        this.loanDeductions.clear();
        slip.loanDeductions?.forEach((d) => {
            const g = this._loanDeductionGroup();
            g.patchValue({
                loanId: d.loanId,
                loanDeductionAmount: Number(d.loanDeductedAmount) || null,
            });
            this.loanDeductions.push(g);
        });
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
        const employeeId = this.editEmployeeId || emp?.id;
        if (!emp?.id) {
            if (!this.editEmployeeId) {
                this._toast.error('Select an employee');
                return;
            }
        }
        if (!employeeId) {
            this._toast.error('Missing employee id');
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

        // if (lines.length === 0) {
        //     this._toast.error('Add at least one earnings or deduction line');
        //     return;
        // }

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
            if (this.isEditMode && this.editEmployeeId && this.editSalarySlipId) {
                await lastValueFrom(
                    this._salarySlipsService.updateSalarySlip(this.editEmployeeId, this.editSalarySlipId, payload)
                );
                this._toast.success('Salary slip updated');
            } else {
                await lastValueFrom(this._salarySlipsService.createSalarySlip(employeeId, payload));
                this._toast.success('Salary slip created');
            }

            await this._router.navigate(['/main/salary-slips']);
        } catch (e: any) {
            this._toast.error(
                e?.error?.message || (this.isEditMode ? 'Failed to update salary slip' : 'Failed to create salary slip')
            );
        } finally {
            this.saving = false;
        }
    }
}
