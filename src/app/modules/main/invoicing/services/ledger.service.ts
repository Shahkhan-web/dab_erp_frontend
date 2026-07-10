import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DashboardMetric, DashboardRange } from 'app/modules/main/dashboard/dashboard.service';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export type LedgerEntryType = 'debit' | 'credit';
export type LedgerCategory =
    | 'sales'
    | 'purchase'
    | 'rent'
    | 'utilities'
    | 'fuel'
    | 'maintenance'
    | 'salary'
    | 'government_fee'
    | 'bank_charge'
    | 'other';
export type LedgerSource = 'manual' | 'invoice';

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = ['debit', 'credit'];

export const LEDGER_CATEGORIES: LedgerCategory[] = [
    'sales',
    'purchase',
    'rent',
    'utilities',
    'fuel',
    'maintenance',
    'salary',
    'government_fee',
    'bank_charge',
    'other',
];

export interface LedgerEntry {
    id: string;
    companyId: string;
    companyName?: string | null;
    entryDate: string;
    entryType: LedgerEntryType;
    amount: number;
    category: LedgerCategory | string;
    description?: string | null;
    reference?: string | null;
    partyId?: string | null;
    partyName?: string | null;
    source: LedgerSource | string;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    runningBalance?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface LedgerSummary {
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
}

export interface LedgerListResponse {
    count: number;
    summary: LedgerSummary;
    data: LedgerEntry[];
}

export interface LedgerListFilters {
    companyId?: string | null;
    entryType?: LedgerEntryType | null;
    category?: LedgerCategory | string | null;
    source?: LedgerSource | string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    search?: string | null;
}

export interface LedgerEntryCreatePayload {
    companyId: string;
    entryDate: string;
    entryType: LedgerEntryType;
    amount: number;
    category: LedgerCategory | string;
    description?: string | null;
    reference?: string | null;
    partyId?: string | null;
}

export type LedgerEntryUpdatePayload = Partial<Omit<LedgerEntryCreatePayload, 'companyId'>>;

export interface LedgerInsightsMeta {
    range: DashboardRange;
    from: string;
    to: string;
    fromDate: string;
    toDate: string;
    bucket: 'day' | 'month';
    timezone: string;
}

export interface LedgerExpenseByCategory {
    category: string;
    amount: number;
}

export interface LedgerInsightsSeriesPoint {
    bucket: string;
    earnings: number;
    expenses: number;
}

export interface LedgerInsightsResponse {
    meta: LedgerInsightsMeta;
    totalEarnings: DashboardMetric;
    totalExpenses: DashboardMetric;
    salariesThisMonth: number;
    netProfit: DashboardMetric;
    outstandingReceivable: number;
    outstandingPayable: number;
    expensesByCategory: LedgerExpenseByCategory[];
    series: LedgerInsightsSeriesPoint[];
}

export function entryTypeLabel(type: LedgerEntryType | string | null | undefined): string {
    switch ((type ?? '').toLowerCase()) {
        case 'credit':
            return 'Credit';
        case 'debit':
            return 'Debit';
        default:
            return type?.trim() ? String(type) : '—';
    }
}

export function entryTypeChipClass(type: LedgerEntryType | string | null | undefined): Record<string, boolean> {
    const t = (type ?? '').toLowerCase();
    return {
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300': t === 'credit',
        'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300': t === 'debit',
    };
}

export function ledgerCategoryLabel(category: string | null | undefined): string {
    const c = (category ?? '').toLowerCase();
    const labels: Record<string, string> = {
        sales: 'Sales',
        purchase: 'Purchase',
        rent: 'Rent',
        utilities: 'Utilities',
        fuel: 'Fuel',
        maintenance: 'Maintenance',
        salary: 'Salary',
        government_fee: 'Government fee',
        bank_charge: 'Bank charge',
        other: 'Other',
    };
    return labels[c] ?? (category?.trim() ? String(category) : '—');
}

export function isManualEntry(entry: LedgerEntry | null | undefined): boolean {
    return (entry?.source ?? '').toLowerCase() === 'manual';
}

@Injectable({ providedIn: 'root' })
export class LedgerService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}ledger`;

    getLedger(page: number, limit: number, filters?: LedgerListFilters): Observable<LedgerListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.companyId) params = params.set('companyId', filters.companyId);
        if (filters?.entryType) params = params.set('entryType', filters.entryType);
        if (filters?.category) params = params.set('category', filters.category);
        if (filters?.source) params = params.set('source', filters.source);
        if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
        if (filters?.search?.trim()) params = params.set('search', filters.search.trim());
        return this._http.get<LedgerListResponse>(this._base, { params });
    }

    createEntry(payload: LedgerEntryCreatePayload): Observable<LedgerEntry> {
        return this._http.post<LedgerEntry>(this._base, payload);
    }

    updateEntry(id: string, payload: LedgerEntryUpdatePayload): Observable<LedgerEntry> {
        return this._http.put<LedgerEntry>(`${this._base}/${id}`, payload);
    }

    deleteEntry(id: string): Observable<{ message?: string }> {
        return this._http.delete<{ message?: string }>(`${this._base}/${id}`);
    }

    getInsights(range: DashboardRange = 'monthly', companyId?: string | null): Observable<LedgerInsightsResponse> {
        let params = new HttpParams().set('range', range);
        if (companyId) params = params.set('companyId', companyId);
        return this._http.get<LedgerInsightsResponse>(`${this._base}/insights`, { params });
    }
}
