import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { CompaniesService } from '../companies/companies.service';
import {
    TalabatOccupationRate,
    TalabatOccupationRatesService,
} from '../talabat-occupation-rates/talabat-occupation-rates.service';
import { inferredCarriedDebtDeduction, shortSlipId } from './salary-debt.util';
import { SalarySlipLetterheadChoiceDialogComponent } from './salary-slip-letterhead-choice-dialog.component';
import { SalarySlipPdfDialogComponent } from './salary-slip-pdf-dialog.component';
import {
    SalaryDebtRecord,
    SalarySlipLine,
    SalarySlipListItem,
    SalarySlipsService,
    salarySlipAllowsPdfDownload,
    salarySlipStatusChipClass,
    salarySlipStatusLabel,
} from './salary-slips.service';

export interface SalarySlipDetailDialogData {
    slip: SalarySlipListItem;
    /** Optional friendly name from parent (e.g. resolved from employees list). */
    employeeDisplayName?: string | null;
    /** Employee’s company — used to resolve letterhead before opening PDF. */
    companyId?: string | null;
}

@Component({
    selector: 'app-salary-slip-detail-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
    ],
    providers: [DatePipe, DecimalPipe],
    templateUrl: './salary-slip-detail-dialog.component.html',
    styleUrl: './salary-slip-detail-dialog.component.scss',
})
export class SalarySlipDetailDialogComponent implements OnInit {
    pdfLoading = false;
    debtLoading = false;
    debtRecords: SalaryDebtRecord[] = [];
    talabatOccupationRates: TalabatOccupationRate[] = [];
    /** Cached PDF for this slip so reopening the viewer avoids another request. */
    private _pdfBlob: Blob | null = null;
    /** Letterhead flag used when `_pdfBlob` was fetched (invalidate if it changes). */
    private _pdfLetterhead: boolean | null = null;

    constructor(
        private _dialogRef: MatDialogRef<SalarySlipDetailDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: SalarySlipDetailDialogData,
        private _datePipe: DatePipe,
        private _decimalPipe: DecimalPipe,
        private _salarySlipsService: SalarySlipsService,
        private _companiesService: CompaniesService,
        private _talabatOccupationRatesService: TalabatOccupationRatesService,
        private _toast: ToastrService,
        private _matDialog: MatDialog
    ) {}

    ngOnInit(): void {
        void this._loadDebtHistory();
        void this._loadTalabatRates();
    }

    private async _loadTalabatRates(): Promise<void> {
        try {
            const resp = await lastValueFrom(this._talabatOccupationRatesService.getRates());
            this.talabatOccupationRates = resp.items ?? [];
        } catch {
            this.talabatOccupationRates = [];
        }
    }

    get slip(): SalarySlipListItem {
        return this.dialogData.slip;
    }

    get canDownloadPdf(): boolean {
        return salarySlipAllowsPdfDownload(this.slip?.status);
    }

    readonly statusLabel = salarySlipStatusLabel;
    readonly statusChipClass = salarySlipStatusChipClass;

    get earningLines(): SalarySlipLine[] {
        return (this.slip.lines ?? []).filter(
            (l) => (l.componentType ?? '').toLowerCase() === 'earning'
        );
    }

    get deductionLines(): SalarySlipLine[] {
        return (this.slip.lines ?? []).filter(
            (l) => (l.componentType ?? '').toLowerCase() === 'deduction'
        );
    }

    get otherLines(): SalarySlipLine[] {
        const t = (c: string | undefined) => (c ?? '').toLowerCase();
        return (this.slip.lines ?? []).filter((l) => t(l.componentType) !== 'earning' && t(l.componentType) !== 'deduction');
    }

    get debtsCreatedOnThisSlip(): SalaryDebtRecord[] {
        return this.debtRecords.filter((r) => r.salarySlipId === this.slip.id);
    }

    get debtsRecoveredOnThisSlip(): SalaryDebtRecord[] {
        return this.debtRecords.filter((r) => r.recoveredOnSalarySlipId === this.slip.id);
    }

    get carriedForwardDebtDeduction(): number {
        return inferredCarriedDebtDeduction(this.slip);
    }

    get hasDebtSection(): boolean {
        return (
            this.debtsCreatedOnThisSlip.length > 0 ||
            this.debtsRecoveredOnThisSlip.length > 0 ||
            this.carriedForwardDebtDeduction > 0
        );
    }

    shortSlipId = shortSlipId;

    debtOutstanding(record: SalaryDebtRecord): number {
        const amount = Number(record.amount) || 0;
        const recovered = Number(record.recoveredAmount) || 0;
        return Math.max(0, amount - recovered);
    }

    private async _loadDebtHistory(): Promise<void> {
        const employeeId = this.slip?.employeeId;
        if (!employeeId) return;
        this.debtLoading = true;
        try {
            const resp = await lastValueFrom(this._salarySlipsService.getSalaryDebtHistory(employeeId));
            this.debtRecords = resp.records ?? [];
        } catch {
            this.debtRecords = [];
        } finally {
            this.debtLoading = false;
        }
    }

    close(): void {
        this._dialogRef.close();
    }

    async openPdfViewer(): Promise<void> {
        const slip = this.slip;
        if (!slip?.employeeId || !slip?.id) {
            this._toast.error('Missing employee or slip id for PDF');
            return;
        }
        if (!this.canDownloadPdf) {
            this._toast.warning('PDF is available only for approved or reimbursed salary slips');
            return;
        }
        const letterheadAvailable = await lastValueFrom(
            this._companiesService.letterheadEnabledForCompany(this.dialogData.companyId ?? null)
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
        const needFetch = !this._pdfBlob || this._pdfLetterhead !== letterhead;
        if (needFetch) {
            this.pdfLoading = true;
            try {
                this._pdfBlob = await lastValueFrom(
                    this._salarySlipsService.getSalarySlipPdf(slip.employeeId, slip.id, letterhead)
                );
                this._pdfLetterhead = letterhead;
            } catch (e: any) {
                this._toast.error(e?.error?.message || 'PDF could not be loaded');
                return;
            } finally {
                this.pdfLoading = false;
            }
        }
        const subtitle =
            this.dialogData.employeeDisplayName?.trim() ||
            `${this._datePipe.transform(slip.startDate, 'mediumDate') ?? ''} — ${this._datePipe.transform(slip.endDate, 'mediumDate') ?? ''}`;
        this._matDialog.open(SalarySlipPdfDialogComponent, {
            data: {
                blob: this._pdfBlob,
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
    }

    /** String / number / localized object → readable text */
    display(value: unknown): string {
        if (value == null) return '—';
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'object' && !Array.isArray(value)) {
            const o = value as Record<string, unknown>;
            const name = o['name'] ?? o['label'] ?? o['en'] ?? o['ar'];
            const code = o['code'];
            if (name != null && String(name).trim() !== '') return String(name).trim();
            if (code != null && String(code).trim() !== '') return String(code).trim();
            const keys = Object.keys(o);
            if (keys.length === 0) return '—';
        }
        return '—';
    }

    displayDate(value: unknown): string {
        if (value == null) return '—';
        if (typeof value === 'string' && value.trim() !== '') {
            return this._datePipe.transform(value, 'medium') ?? value;
        }
        return '—';
    }

    /** Period labels: date only (shorter than `medium`). */
    displayPeriodDate(value: unknown): string {
        if (value == null) return '—';
        if (typeof value === 'string' && value.trim() !== '') {
            return this._datePipe.transform(value, 'mediumDate') ?? value;
        }
        return '—';
    }

    get hasBasicSalaryFromProfile(): boolean {
        const v = this.slip.basicSalaryFromProfile;
        return v != null && Number.isFinite(v);
    }

    /** Rider / Talabat and performance blocks are hidden for occupation `staff` (same as add form). */
    get showRiderPerformanceUi(): boolean {
        const occ = this.slip.employeeOccupation;
        if (occ == null || String(occ).trim() === '') return true;
        return this._normalizeOccupationKey(String(occ)) !== 'staff';
    }

    private _normalizeOccupationKey(s: string): string {
        return String(s).trim().toLowerCase().replace(/\s+/g, '_');
    }

    get hasRiderSection(): boolean {
        if (!this.showRiderPerformanceUi) return false;
        const s = this.slip;
        const fields = [
            s.talabatCaseRiderEarning,
            s.codDeduction,
            s.deliveryIncentive,
            s.inventoryDeduction,
            s.fuelIncentive,
            s.clawbackDeduction,
        ];
        return fields.some((v) => this._fieldHasValue(v));
    }

    get hasPerformanceSection(): boolean {
        if (!this.showRiderPerformanceUi) return false;
        const p = this.slip.performance;
        if (!p) return false;
        return [
            p.totalCompletedDeliveries,
            p.pickupsCount,
            p.dropoffsCount,
            p.deliveriesReturnLc,
            p.distanceLc,
        ].some((v) => this.display(v) !== '—');
    }

    /** Stored rider earning from the API includes distance LC when set. */
    get hasDistanceLcInRiderEarning(): boolean {
        const distanceLc = Number(this.slip.performance?.distanceLc);
        return Number.isFinite(distanceLc) && distanceLc > 0;
    }

    private _appliedTalabatRate(): TalabatOccupationRate | undefined {
        const occ = this.slip.employeeOccupation;
        if (!occ || !this.talabatOccupationRates.length) return undefined;
        const want = this._normalizeOccupationKey(String(occ));
        return this.talabatOccupationRates.find((row) => this._normalizeOccupationKey(row.occupation) === want);
    }

    private _numField(value: unknown): number {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    /** Pickup payment from API or pickups count × occupation pickup rate. */
    get pickupPayment(): number | null {
        const fromApi = this.slip.performance?.pickupPayment;
        if (fromApi != null && Number.isFinite(Number(fromApi))) return Number(fromApi);
        const rate = this._appliedTalabatRate();
        if (!rate) return null;
        return this._numField(this.slip.performance?.pickupsCount) * (Number(rate.pickupRateAed) || 0);
    }

    /** Dropoff payment from API or dropoffs count × occupation dropoff rate. */
    get dropoffPayment(): number | null {
        const fromApi = this.slip.performance?.dropoffPayment;
        if (fromApi != null && Number.isFinite(Number(fromApi))) return Number(fromApi);
        const rate = this._appliedTalabatRate();
        if (!rate) return null;
        return this._numField(this.slip.performance?.dropoffsCount) * (Number(rate.dropoffRateAed) || 0);
    }

    get hasPickupPayment(): boolean {
        return this.pickupPayment != null;
    }

    get hasDropoffPayment(): boolean {
        return this.dropoffPayment != null;
    }

    private _fieldHasValue(value: unknown): boolean {
        if (value == null) return false;
        if (typeof value === 'number' && Number.isFinite(value)) return true;
        if (typeof value === 'string' && value.trim() !== '') return true;
        if (typeof value === 'object') return this.display(value) !== '—';
        return false;
    }

    formatMoney(value: number | null | undefined): string {
        if (value == null || !Number.isFinite(value)) return '—';
        return this._decimalPipe.transform(value, '1.2-2') ?? String(value);
    }

    /** API may return numbers or wrapped values for rider fields */
    displayMoneyField(value: unknown): string {
        if (value == null) return '—';
        if (typeof value === 'number' && Number.isFinite(value)) {
            return this._decimalPipe.transform(value, '1.2-2') ?? String(value);
        }
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
            return this._decimalPipe.transform(Number(value), '1.2-2') ?? value;
        }
        const s = this.display(value);
        return s;
    }

    componentTypeLabel(type: string | undefined): string {
        const t = (type ?? '').toLowerCase();
        if (t === 'earning') return 'Earning';
        if (t === 'deduction') return 'Deduction';
        return type ? type : '—';
    }
}
