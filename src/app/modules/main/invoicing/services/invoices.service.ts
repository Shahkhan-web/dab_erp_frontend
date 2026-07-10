import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { Party } from './parties.service';

export type InvoiceDirection = 'receivable' | 'payable';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'online' | 'other';

export const INVOICE_STATUSES: InvoiceStatus[] = [
    'draft',
    'sent',
    'partially_paid',
    'paid',
    'overdue',
    'void',
];

export const INVOICE_CREATE_STATUSES: InvoiceStatus[] = ['draft', 'sent'];

export const PAYMENT_METHODS: PaymentMethod[] = [
    'cash',
    'bank_transfer',
    'cheque',
    'card',
    'online',
    'other',
];

export const INVOICE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const INVOICE_ATTACHMENT_MAX_FILES_PER_UPLOAD = 30;
export const INVOICE_ATTACHMENT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.gif';

export interface InvoiceLine {
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRatePct: number;
    lineSubtotal?: number;
    lineTax?: number;
    lineTotal?: number;
}

export interface InvoiceLinePayload {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRatePct: number;
}

export interface InvoicePayment {
    id: string;
    amount: number;
    paidDate: string;
    method: PaymentMethod | string;
    reference?: string | null;
    notes?: string | null;
    ledgerEntryId?: string | null;
    createdAt?: string;
}

export interface InvoiceAttachment {
    id: string;
    displayName: string;
    contentType?: string;
    fileSize?: number;
    downloadUrl?: string;
    createdAt?: string;
}

export interface InvoiceListItem {
    id: string;
    direction: InvoiceDirection;
    companyId: string;
    companyName?: string | null;
    partyId: string;
    party?: Party | null;
    partyName?: string | null;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: InvoiceStatus | string;
    currency: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface InvoiceDetail extends InvoiceListItem {
    lines: InvoiceLine[];
    payments: InvoicePayment[];
    attachments?: InvoiceAttachment[];
    notes?: string | null;
    terms?: string | null;
}

export interface InvoicesListResponse {
    count: number;
    data: InvoiceListItem[];
}

export interface InvoicesListFilters {
    direction?: InvoiceDirection | null;
    status?: InvoiceStatus | string | null;
    companyId?: string | null;
    partyId?: string | null;
    issuedFrom?: string | null;
    issuedTo?: string | null;
    search?: string | null;
}

export interface InvoiceCreatePayload {
    direction: InvoiceDirection;
    companyId: string;
    partyId: string;
    invoiceNumber?: string | null;
    issueDate: string;
    dueDate: string;
    status?: InvoiceStatus;
    currency?: string;
    lines: InvoiceLinePayload[];
    notes?: string | null;
    terms?: string | null;
}

export interface InvoiceUpdatePayload {
    partyId?: string;
    invoiceNumber?: string | null;
    issueDate?: string;
    dueDate?: string;
    currency?: string;
    lines?: InvoiceLinePayload[];
    notes?: string | null;
    terms?: string | null;
}

export interface PaymentPreview {
    companyId: string;
    entryType: 'debit' | 'credit';
    amount: number;
    category: string;
    description: string;
    message: string;
}

export interface RecordPaymentPayload {
    amount: number;
    paidDate: string;
    method: PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    postToLedger: boolean;
}

export type InvoiceEditableField =
    | 'partyId'
    | 'invoiceNumber'
    | 'issueDate'
    | 'dueDate'
    | 'currency'
    | 'lines'
    | 'notes'
    | 'terms';

export function invoiceDirectionLabel(direction: InvoiceDirection | string | null | undefined): string {
    return (direction ?? '').toLowerCase() === 'payable' ? 'Bill' : 'Invoice';
}

export function invoiceDirectionPlural(direction: InvoiceDirection | string | null | undefined): string {
    return (direction ?? '').toLowerCase() === 'payable' ? 'Bills' : 'Invoices';
}

export function invoiceStatusLabel(status: string | null | undefined): string {
    switch ((status ?? '').toLowerCase()) {
        case 'draft':
            return 'Draft';
        case 'sent':
            return 'Sent';
        case 'partially_paid':
            return 'Partially paid';
        case 'paid':
            return 'Paid';
        case 'overdue':
            return 'Overdue';
        case 'void':
            return 'Void';
        default:
            return status?.trim() ? String(status) : '—';
    }
}

export function invoiceStatusChipClass(status: string | null | undefined): Record<string, boolean> {
    const s = (status ?? '').toLowerCase();
    return {
        'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300': s === 'draft',
        'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300': s === 'sent',
        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300': s === 'partially_paid',
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300': s === 'paid',
        'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300': s === 'overdue' || s === 'void',
    };
}

export function paymentMethodLabel(method: string | null | undefined): string {
    switch ((method ?? '').toLowerCase()) {
        case 'cash':
            return 'Cash';
        case 'bank_transfer':
            return 'Bank transfer';
        case 'cheque':
            return 'Cheque';
        case 'card':
            return 'Card';
        case 'online':
            return 'Online';
        case 'other':
            return 'Other';
        default:
            return method?.trim() ? String(method) : '—';
    }
}

export function isInvoiceFinanciallyLocked(invoice: InvoiceListItem | InvoiceDetail | null | undefined): boolean {
    if (!invoice) return false;
    return Number(invoice.amountPaid) > 0 || (invoice.status ?? '').toLowerCase() === 'void';
}

export function isInvoiceVoid(invoice: InvoiceListItem | InvoiceDetail | null | undefined): boolean {
    return (invoice?.status ?? '').toLowerCase() === 'void';
}

export function canEditInvoiceField(
    invoice: InvoiceListItem | InvoiceDetail | null | undefined,
    field: InvoiceEditableField
): boolean {
    if (!invoice || isInvoiceVoid(invoice)) return false;
    const locked = Number(invoice.amountPaid) > 0;
    if (!locked) return true;
    return field === 'notes' || field === 'terms' || field === 'dueDate';
}

export function computeLinePreview(line: InvoiceLinePayload): {
    lineSubtotal: number;
    lineTax: number;
    lineTotal: number;
} {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const taxPct = Number(line.taxRatePct) || 0;
    const lineSubtotal = qty * price;
    const lineTax = lineSubtotal * (taxPct / 100);
    const lineTotal = lineSubtotal + lineTax;
    return { lineSubtotal, lineTax, lineTotal };
}

export function computeInvoicePreview(lines: InvoiceLinePayload[]): {
    subtotal: number;
    taxAmount: number;
    total: number;
} {
    let subtotal = 0;
    let taxAmount = 0;
    for (const line of lines) {
        const p = computeLinePreview(line);
        subtotal += p.lineSubtotal;
        taxAmount += p.lineTax;
    }
    return { subtotal, taxAmount, total: subtotal + taxAmount };
}

@Injectable({ providedIn: 'root' })
export class InvoicesService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}invoices`;

    getInvoices(page: number, limit: number, filters?: InvoicesListFilters): Observable<InvoicesListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.direction) params = params.set('direction', filters.direction);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.companyId) params = params.set('companyId', filters.companyId);
        if (filters?.partyId) params = params.set('partyId', filters.partyId);
        if (filters?.issuedFrom) params = params.set('issuedFrom', filters.issuedFrom);
        if (filters?.issuedTo) params = params.set('issuedTo', filters.issuedTo);
        if (filters?.search?.trim()) params = params.set('search', filters.search.trim());
        return this._http.get<InvoicesListResponse>(this._base, { params });
    }

    getInvoice(id: string): Observable<InvoiceDetail> {
        return this._http.get<InvoiceDetail>(`${this._base}/${id}`);
    }

    createInvoice(payload: InvoiceCreatePayload): Observable<InvoiceDetail> {
        return this._http.post<InvoiceDetail>(this._base, payload);
    }

    updateInvoice(id: string, payload: InvoiceUpdatePayload): Observable<InvoiceDetail> {
        return this._http.put<InvoiceDetail>(`${this._base}/${id}`, payload);
    }

    deleteInvoice(id: string): Observable<{ message?: string }> {
        return this._http.delete<{ message?: string }>(`${this._base}/${id}`);
    }

    voidInvoice(id: string): Observable<InvoiceDetail> {
        return this._http.post<InvoiceDetail>(`${this._base}/${id}/void`, {});
    }

    getPaymentPreview(id: string, amount?: number | null): Observable<PaymentPreview> {
        let params = new HttpParams();
        if (amount != null && Number.isFinite(amount)) {
            params = params.set('amount', String(amount));
        }
        return this._http.get<PaymentPreview>(`${this._base}/${id}/payment-preview`, { params });
    }

    recordPayment(id: string, payload: RecordPaymentPayload): Observable<InvoicePayment> {
        return this._http.post<InvoicePayment>(`${this._base}/${id}/payments`, payload);
    }

    getAttachments(id: string): Observable<InvoiceAttachment[]> {
        return this._http.get<InvoiceAttachment[]>(`${this._base}/${id}/attachments`);
    }

    uploadAttachments(id: string, files: File[], displayNames: string[]): Observable<InvoiceAttachment[]> {
        const body = new FormData();
        for (const file of files) body.append('files', file);
        body.append('displayNames', JSON.stringify(displayNames.map((n) => String(n).trim())));
        return this._http.post<InvoiceAttachment[]>(`${this._base}/${id}/attachments`, body);
    }

    deleteAttachment(invoiceId: string, attachmentId: string): Observable<{ message?: string }> {
        return this._http.delete<{ message?: string }>(
            `${this._base}/${invoiceId}/attachments/${attachmentId}`
        );
    }
}
