import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface LoanDeductionHistoryEntry {
    id: string;
    salarySlipId: string;
    payrollFrequency: string;
    startDate: string;
    endDate: string;
    loanDeductedAmount: number;
    createdAt: string;
}

export interface LoanListItem {
    id: string;
    applicantType: string;
    status: string;
    loanName: string;
    reason?: unknown;
    loanAmount: number;
    totalDeductedSoFar: number;
    remaining: number;
    remarks?: unknown;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
}

/** Loan row returned by GET `/employee/{id}/loans/history` */
export interface EmployeeLoanHistoryItem extends LoanListItem {
    deductionHistory?: LoanDeductionHistoryEntry[];
}

export interface EmployeeLoanHistoryResponse {
    count: number;
    data: EmployeeLoanHistoryItem[];
}

export interface EmployeeLoanHistoryQuery {
    page?: number;
    limit?: number;
    status?: string | null;
}

export interface LoansListResponse {
    count: number;
    data: LoanListItem[];
}

export interface LoansListFilters {
    employeeId?: string | null;
    applicantType?: string | null;
    status?: string | null;
    loanName?: string | null;
    createdFrom?: string | null;
    createdTo?: string | null;
}

export interface CreateLoanPayload {
    applicantType: string;
    loanName: string;
    loanAmount: number;
    reason: string;
    remarks: string;
    status: string;
}

export interface UpdateLoanStatusPayload {
    status: string;
    reason?: string;
    remarks?: string;
}

@Injectable({ providedIn: 'root' })
export class LoansService {
    private _http = inject(HttpClient);
    private _baseLoans = `${environment.apiUrl}loans`;
    private _baseEmployee = `${environment.apiUrl}employee`;

    getLoans(page: number, limit: number, filters?: LoansListFilters): Observable<LoansListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
        if (filters?.applicantType) params = params.set('applicantType', filters.applicantType);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.loanName) params = params.set('loanName', filters.loanName);
        if (filters?.createdFrom) params = params.set('createdFrom', filters.createdFrom);
        if (filters?.createdTo) params = params.set('createdTo', filters.createdTo);
        return this._http.get<LoansListResponse>(this._baseLoans, { params });
    }

    createLoan(employeeId: string, payload: CreateLoanPayload): Observable<unknown> {
        return this._http.post(`${this._baseEmployee}/${employeeId}/loans`, payload);
    }

    updateLoanStatus(id: string, payload: UpdateLoanStatusPayload): Observable<unknown> {
        return this._http.patch(`${this._baseLoans}/${id}/status`, payload);
    }

    getEmployeeLoanHistory(employeeId: string, query?: EmployeeLoanHistoryQuery): Observable<EmployeeLoanHistoryResponse> {
        const page = query?.page ?? 1;
        const limit = query?.limit ?? 20;
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (query?.status) params = params.set('status', query.status);
        return this._http.get<EmployeeLoanHistoryResponse>(`${this._baseEmployee}/${employeeId}/loans/history`, {
            params,
        });
    }
}
