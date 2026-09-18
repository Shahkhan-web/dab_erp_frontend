import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface SalarySlipLine {
    id?: string;
    payComponentId: string;
    componentName?: string;
    componentType?: string;
    amount: number;
}

export interface SalarySlipLoanDeduction {
    loanId: string;
    loanName?: string;
    loanDeductedAmount?: number;
}

export interface SalaryDebtRecord {
    id: string;
    salarySlipId: string;
    amount: number;
    recoveredAmount: number;
    recoveredOnSalarySlipId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SalaryDebtHistoryResponse {
    totalOutstanding: number;
    records: SalaryDebtRecord[];
}

export interface SalarySlipPerformance {
    id?: string;
    totalCompletedDeliveries?: unknown;
    pickupsCount?: unknown;
    dropoffsCount?: unknown;
    deliveriesReturnLc?: unknown;
    distanceLc?: unknown;
    pickupPayment?: unknown;
    dropoffPayment?: unknown;
}

export interface SalarySlipListItem {
    id: string;
    employeeId: string;
    employeeCode: string;
    /** Workflow state from API (e.g. draft, published). */
    status?: string | null;
    /** When `staff` (case-insensitive), rider/Talabat and performance blocks are hidden in UI (see add form). */
    employeeOccupation?: string | null;
    /** Calendar month the slip covers, `YYYY-MM`. */
    periodMonth: string;
    workingDays: number;
    absentDays: number;
    paymentDays: number;
    leaveDaysWithoutPay: number;
    grossPayment: number;
    totalDeduction: number;
    netPayment: number;
    /** Basic salary snapshot from employee profile (for audit / comparison with slip lines). */
    basicSalaryFromProfile?: number | null;
    totalInWords?: unknown;
    bankName?: unknown;
    bankAccountNo?: unknown;
    loanId?: unknown;
    loanDeductedAmount?: unknown;
    loanDeductions?: SalarySlipLoanDeduction[];
    talabatCaseRiderEarning?: unknown;
    codDeduction?: unknown;
    deliveryIncentive?: unknown;
    inventoryDeduction?: unknown;
    fuelIncentive?: unknown;
    clawbackDeduction?: unknown;
    lines?: SalarySlipLine[];
    performance?: SalarySlipPerformance;
    createdAt: string;
    updatedAt: string;
}

export interface SalarySlipsListResponse {
    count: number;
    data: SalarySlipListItem[];
}

export interface SalarySlipsListFilters {
    employeeId?: string | null;
    status?: SalarySlipStatus | null;
    /** Inclusive period bounds as `YYYY-MM`. */
    periodFrom?: string | null;
    periodTo?: string | null;
}

export type SalarySlipStatus = 'pending' | 'approved' | 'reimbursed';

export const SALARY_SLIP_STATUSES = ['pending', 'approved', 'reimbursed'] as const;

/** Maps legacy `verified` / `paid` for display and transition logic during migration. */
export function normalizeSalarySlipStatus(status: string | null | undefined): string {
    const s = (status ?? '').trim().toLowerCase();
    if (s === 'verified') return 'approved';
    if (s === 'paid') return 'reimbursed';
    return s;
}

export function salarySlipStatusLabel(status: string | null | undefined): string {
    switch (normalizeSalarySlipStatus(status)) {
        case 'pending':
            return 'Pending';
        case 'approved':
            return 'Approved';
        case 'reimbursed':
            return 'Reimbursed';
        default:
            return status?.trim() ? String(status) : '—';
    }
}

export function salarySlipStatusChipClass(status: string | null | undefined): Record<string, boolean> {
    const s = normalizeSalarySlipStatus(status);
    return {
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40':
            s === 'pending',
        'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40':
            s === 'approved',
        'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40':
            s === 'reimbursed',
        'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-300 dark:border-zinc-500/40':
            !SALARY_SLIP_STATUSES.includes(s as SalarySlipStatus),
    };
}

/** PDF download is allowed only for approved or reimbursed slips. */
export function salarySlipAllowsPdfDownload(status: string | null | undefined): boolean {
    const s = normalizeSalarySlipStatus(status);
    return s === 'approved' || s === 'reimbursed';
}

/** Response of `PATCH /salary-slips/status` — slips no longer pending come back as skipped. */
export interface BulkUpdateStatusResult {
    updated: number;
    skippedIds: string[];
}

export interface BulkUploadRowError {
    row: number;
    riderId: string;
    message: string;
}

/** Response of `POST /salary-slips/upload` — a 201 can still mean rows were skipped. */
export interface BulkUploadResult {
    created: number;
    notFoundRiderIds: string[];
    errors: BulkUploadRowError[];
}

export interface SalarySlipLineInput {
    payComponentId: string;
    amount: number;
}

export interface SalarySlipLoanDeductionInput {
    loanId: string;
    loanDeductionAmount: number;
}

export interface SalarySlipPerformanceInput {
    totalCompletedDeliveries: number;
    pickupsCount: number;
    dropoffsCount: number;
    deliveriesReturnLc: number;
    distanceLc: number;
}

/** POST body — optional fields omitted when empty */
export interface SalarySlipCreatePayload {
    /** Calendar month the slip covers, `YYYY-MM`. */
    periodMonth: string;
    workingDays: number;
    absentDays: number;
    leaveDaysWithoutPay: number;
    lines: SalarySlipLineInput[];
    loanDeductions?: SalarySlipLoanDeductionInput[];
    performance: SalarySlipPerformanceInput;
    totalInWords?: string | Record<string, unknown>;
    bankName?: string | Record<string, unknown>;
    bankAccountNo?: string | Record<string, unknown>;
    talabatCaseRiderEarning?: number;
    codDeduction?: number;
    deliveryIncentive?: number;
    inventoryDeduction?: number | null;
    fuelIncentive?: number;
    clawbackDeduction?: number;
    /** Basic salary from employee profile at selection time (optional). */
    basicSalaryFromProfile?: number;
    /** When true, outstanding salary debt from prior slips is deducted on create. */
    deductOutstandingDebt?: boolean;
}

export type SalarySlipUpdatePayload = SalarySlipCreatePayload;

/** DELETE `/employee/:employeeId/salary-slips/:salarySlipId` — pending only. */
export interface DeleteSalarySlipResponse {
    message?: string;
}

@Injectable({ providedIn: 'root' })
export class SalarySlipsService {
    private _http = inject(HttpClient);
    private _baseSlips = `${environment.apiUrl}salary-slips`;
    private _baseEmployee = `${environment.apiUrl}employee`;

    getSalarySlips(
        page: number,
        limit: number,
        filters?: SalarySlipsListFilters
    ): Observable<SalarySlipsListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.periodFrom) params = params.set('periodFrom', filters.periodFrom);
        if (filters?.periodTo) params = params.set('periodTo', filters.periodTo);
        return this._http.get<SalarySlipsListResponse>(this._baseSlips, { params });
    }

    getEmployeeSalarySlips(employeeId: string, page: number, limit: number): Observable<SalarySlipsListResponse> {
        const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        return this._http.get<SalarySlipsListResponse>(
            `${this._baseEmployee}/${employeeId}/salary-slips`,
            { params }
        );
    }

    getSalaryDebtHistory(employeeId: string): Observable<SalaryDebtHistoryResponse> {
        return this._http.get<SalaryDebtHistoryResponse>(
            `${this._baseEmployee}/${employeeId}/salary-slips/debt-history`
        );
    }

    createSalarySlip(employeeId: string, payload: SalarySlipCreatePayload): Observable<unknown> {
        return this._http.post(`${this._baseEmployee}/${employeeId}/salary-slips`, payload);
    }

    getSalarySlip(employeeId: string, salarySlipId: string): Observable<SalarySlipListItem> {
        return this._http.get<SalarySlipListItem>(`${this._baseEmployee}/${employeeId}/salary-slips/${salarySlipId}`);
    }

    updateSalarySlip(employeeId: string, salarySlipId: string, payload: SalarySlipUpdatePayload): Observable<unknown> {
        return this._http.patch(`${this._baseEmployee}/${employeeId}/salary-slips/${salarySlipId}`, payload);
    }

    deleteSalarySlip(employeeId: string, salarySlipId: string): Observable<DeleteSalarySlipResponse> {
        return this._http.delete<DeleteSalarySlipResponse>(
            `${this._baseEmployee}/${employeeId}/salary-slips/${salarySlipId}`
        );
    }

    bulkUpdateStatus(ids: string[], status: SalarySlipStatus): Observable<BulkUpdateStatusResult> {
        return this._http.patch<BulkUpdateStatusResult>(`${this._baseSlips}/status`, { ids, status });
    }

    uploadSalarySlips(file: File, periodMonth: string): Observable<BulkUploadResult> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('periodMonth', periodMonth);
        return this._http.post<BulkUploadResult>(`${this._baseSlips}/upload`, formData);
    }

    /**
     * GET the slip document. `letterhead` defaults to false (company name header); set true when letterhead
     * UI is added. Returns the document as a self-contained HTML page; the caller prints it (window.print())
     * to produce a PDF, since the backend no longer renders PDFs itself (server-side Puppeteer rendering
     * was prone to hanging under load).
     */
    getSalarySlipPdf(
        employeeId: string,
        salarySlipId: string,
        letterhead = false
    ): Observable<string> {
        const params = new HttpParams().set('letterhead', String(letterhead));
        return this._http.get(`${this._baseEmployee}/${employeeId}/salary-slips/${salarySlipId}/pdf`, {
            params,
            responseType: 'text',
        });
    }
}
