import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export type DashboardRange = 'today' | 'weekly' | 'monthly' | 'last_6_months' | 'yearly';
export type DashboardBucket = 'day' | 'month';

export const DASHBOARD_RANGES: { value: DashboardRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'last_6_months', label: 'Last 6 months' },
    { value: 'yearly', label: 'Yearly' },
];

export interface DashboardMeta {
    range: DashboardRange;
    from: string;
    to: string;
    fromDate: string;
    toDate: string;
    bucket: DashboardBucket;
    timezone: string;
}

export interface DashboardMetric {
    value: number;
    previous: number;
    changePct: number | null;
}

export interface DashboardBreakdownItem {
    key?: string;
    label?: string;
    status?: string;
    frequency?: string;
    type?: string;
    name?: string;
    count: number;
    amount?: number;
    value?: number;
    remaining?: number;
    loanAmount?: number;
    activeEmployees?: number;
}

export interface DashboardSeriesPoint {
    bucket: string;
    slips?: number;
    grossPayment?: number;
    totalDeduction?: number;
    netPayment?: number;
    issuedCount?: number;
    issuedAmount?: number;
    recoveredAmount?: number;
    joiners?: number;
    deliveries?: number;
    pickups?: number;
    dropoffs?: number;
    distanceKm?: number;
    totalActions?: number;
    [key: string]: string | number | undefined;
}

export interface DashboardOverviewWorkforce {
    activeEmployees: DashboardMetric;
    totalEmployees: DashboardMetric;
    newJoiners: DashboardMetric;
    byWorkingStatus: DashboardBreakdownItem[];
}

export interface DashboardOverviewPayroll {
    slips: DashboardMetric;
    grossPayment: DashboardMetric;
    totalDeduction: DashboardMetric;
    netPayment: DashboardMetric;
    byStatus: DashboardBreakdownItem[];
    pendingNetPayment: number;
}

export interface DashboardOverviewLoans {
    issuedAmount: DashboardMetric;
    issuedCount: DashboardMetric;
    outstandingAmount: number;
    recoveredInRange: number;
    byStatus: DashboardBreakdownItem[];
}

export interface DashboardOverviewSalaryDebt {
    outstandingAmount: number;
    employeesWithDebt: number;
    newDebt: DashboardMetric;
}

export interface DashboardOverviewPerformance {
    deliveries: DashboardMetric;
    distanceKm: DashboardMetric;
    pickups: DashboardMetric;
    dropoffs: DashboardMetric;
}

export interface DashboardOverview {
    meta: DashboardMeta;
    workforce: DashboardOverviewWorkforce | null;
    payroll: DashboardOverviewPayroll | null;
    loans: DashboardOverviewLoans | null;
    salaryDebt: DashboardOverviewSalaryDebt | null;
    performance: DashboardOverviewPerformance | null;
}

export interface DashboardPayrollResponse {
    meta: DashboardMeta;
    series: DashboardSeriesPoint[];
    byStatus: DashboardBreakdownItem[];
    byFrequency: DashboardBreakdownItem[];
    deductionComposition: DashboardBreakdownItem[];
    topPayComponents: DashboardTopItem[];
}

export interface DashboardWorkforceResponse {
    meta: DashboardMeta;
    totalEmployees: number;
    byWorkingStatus: DashboardBreakdownItem[];
    byOccupation: DashboardBreakdownItem[];
    byCompany: DashboardBreakdownItem[];
    joinersSeries: DashboardSeriesPoint[];
    activeBasicSalaryTotal: number;
    activeCostToCompanyTotal: number;
    passportsExpiringSoon: number;
    contractsEndingSoon: number;
}

export interface DashboardLoansResponse {
    meta: DashboardMeta;
    byStatus: DashboardBreakdownItem[];
    series: DashboardSeriesPoint[];
    outstandingAmount: number;
    recoveredInRange: number;
    openLoans: number;
}

export interface DashboardPerformanceResponse {
    meta: DashboardMeta;
    totalDeliveries: number;
    totalPickups: number;
    totalDropoffs: number;
    totalDistanceKm: number;
    ridersReporting: number;
    series: DashboardSeriesPoint[];
    topPerformers: DashboardTopPerformer[];
}

export interface DashboardActivityResponse {
    meta: DashboardMeta;
    totalActions: number;
    byAction: DashboardBreakdownItem[];
    byResource: DashboardBreakdownItem[];
    series: DashboardSeriesPoint[];
    topUsers: DashboardTopUser[];
}

export interface DashboardTopItem {
    name: string;
    amount: number;
    count?: number;
}

export interface DashboardTopPerformer {
    staffId: string;
    name: string;
    occupation?: string;
    deliveries: number;
    distanceKm?: number;
}

export interface DashboardTopUser {
    userId: string;
    email: string;
    count: number;
}

export interface DashboardQueryParams {
    range?: DashboardRange;
    companyId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}dashboard`;

    getOverview(params?: DashboardQueryParams): Observable<DashboardOverview> {
        return this._http.get<DashboardOverview>(`${this._base}/overview`, {
            params: this.buildParams(params),
        });
    }

    getPayroll(params?: DashboardQueryParams): Observable<DashboardPayrollResponse> {
        return this._http.get<DashboardPayrollResponse>(`${this._base}/payroll`, {
            params: this.buildParams(params),
        });
    }

    getWorkforce(params?: DashboardQueryParams): Observable<DashboardWorkforceResponse> {
        return this._http.get<DashboardWorkforceResponse>(`${this._base}/workforce`, {
            params: this.buildParams(params),
        });
    }

    getLoans(params?: DashboardQueryParams): Observable<DashboardLoansResponse> {
        return this._http.get<DashboardLoansResponse>(`${this._base}/loans`, {
            params: this.buildParams(params),
        });
    }

    getPerformance(params?: DashboardQueryParams): Observable<DashboardPerformanceResponse> {
        return this._http.get<DashboardPerformanceResponse>(`${this._base}/performance`, {
            params: this.buildParams(params),
        });
    }

    getActivity(params?: DashboardQueryParams): Observable<DashboardActivityResponse> {
        return this._http.get<DashboardActivityResponse>(`${this._base}/activity`, {
            params: this.buildParams(params),
        });
    }

    private buildParams(params?: DashboardQueryParams): HttpParams {
        let httpParams = new HttpParams();
        if (params?.range) {
            httpParams = httpParams.set('range', params.range);
        }
        if (params?.companyId?.trim()) {
            httpParams = httpParams.set('companyId', params.companyId.trim());
        }
        return httpParams;
    }
}
