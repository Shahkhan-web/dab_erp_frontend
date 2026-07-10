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
}

export interface SalarySlipListItem {
    id: string;
    employeeId: string;
    employeeCode: string;
    /** Workflow state from API (e.g. draft, published). */
    status?: string | null;
    /** When `staff` (case-insensitive), rider/Talabat and performance blocks are hidden in UI (see add form). */
    employeeOccupation?: string | null;
    payrollFrequency: string;
    startDate: string;
    endDate: string;
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
    payrollFrequency?: string | null;
    status?: SalarySlipStatus | null;
    slipStartFrom?: string | null;
    slipStartTo?: string | null;
    slipEndFrom?: string | null;
    slipEndTo?: string | null;
}

export type SalarySlipStatus = 'pending' | 'verified' | 'paid';

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
    payrollFrequency: string;
    startDate: string;
    endDate: string;
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
    inventoryDeduction?: number;
    fuelIncentive?: number;
    clawbackDeduction?: number;
    /** Basic salary from employee profile at selection time (optional). */
    basicSalaryFromProfile?: number;
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
        if (filters?.payrollFrequency) params = params.set('payrollFrequency', filters.payrollFrequency);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.slipStartFrom) params = params.set('slipStartFrom', filters.slipStartFrom);
        if (filters?.slipStartTo) params = params.set('slipStartTo', filters.slipStartTo);
        if (filters?.slipEndFrom) params = params.set('slipEndFrom', filters.slipEndFrom);
        if (filters?.slipEndTo) params = params.set('slipEndTo', filters.slipEndTo);
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

    bulkUpdateStatus(ids: string[], status: SalarySlipStatus): Observable<unknown> {
        return this._http.patch(`${this._baseSlips}/status`, { ids, status });
    }

    uploadSalarySlips(file: File, payrollFrequency: string, startDate: string, endDate: string): Observable<unknown> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('payrollFrequency', payrollFrequency);
        formData.append('startDate', startDate);
        formData.append('endDate', endDate);
        return this._http.post(`${this._baseSlips}/upload`, formData);
    }

    /**
     * GET PDF for a slip. `letterhead` defaults to false (company name header); set true when letterhead UI is added.
     */
    getSalarySlipPdf(
        employeeId: string,
        salarySlipId: string,
        letterhead = false
    ): Observable<Blob> {
        const params = new HttpParams().set('letterhead', String(letterhead));
        return this._http.get(`${this._baseEmployee}/${employeeId}/salary-slips/${salarySlipId}/pdf`, {
            params,
            responseType: 'blob',
        });
    }
}
