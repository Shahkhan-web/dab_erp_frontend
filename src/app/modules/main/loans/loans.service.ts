import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface LoanDeductionHistoryEntry {
    id: string;
    salarySlipId: string;
    /** Calendar month the deducting slip covers, `YYYY-MM`. */
    periodMonth: string;
    loanDeductedAmount: number;
    createdAt: string;
}

/** Loan workflow step attachment (S3 + presigned downloadUrl). */
export interface LoanAttachment {
    id: string;
    step: LoanStatus | string;
    displayName: string;
    contentType?: string;
    fileSize?: number;
    downloadUrl?: string;
    uploadedByUserId?: string;
    uploadedByName?: string;
    createdAt?: string;
}

export const LOAN_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const LOAN_ATTACHMENT_MAX_FILES_PER_UPLOAD = 30;
export const LOAN_ATTACHMENT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.gif';

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
    /** Present on list / GET single loan responses. */
    employeeName?: string;
    employeeCode?: string;
    /** Employee's company — used to decide whether to offer the letterhead option on PDFs. */
    employeeCompanyId?: string | null;
    /** User who last approved; null for open/rejected or legacy approved loans not re-approved via status PATCH. */
    approvedByUserId?: string | null;
    approvedByName?: string | null;
    approvedAt?: string | null;
    attachments?: LoanAttachment[];
}

/** GET `/employee/:employeeId/loans/:loanId` — loan fields plus deduction history. */
export interface LoanResponseDto extends LoanListItem {
    deductionHistory?: LoanDeductionHistoryEntry[];
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

/** PATCH `/employee/:employeeId/loans/:loanId` — all optional; at least one field required. */
export interface UpdateLoanDto {
    applicantType?: string;
    loanName?: string;
    loanAmount?: number;
    reason?: string | null;
    remarks?: string | null;
}

/** DELETE `/employee/:employeeId/loans/:loanId` — 200 `{ message: "Loan deleted" }`. */
export interface DeleteLoanResponse {
    message?: string;
}

/** Loan lifecycle statuses (API `LoanStatus` enum). */
export const LOAN_STATUSES = ['open', 'rejected', 'approved', 'disbursed', 'reimbursed'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/** Maps legacy `paid` → `reimbursed` for display and transition logic. */
export function normalizeLoanStatus(status: string | null | undefined): string {
    const s = (status ?? '').trim().toLowerCase();
    return s === 'paid' ? 'reimbursed' : s;
}

export function loanStatusLabel(status: string | null | undefined): string {
    switch (normalizeLoanStatus(status)) {
        case 'open':
            return 'Open';
        case 'rejected':
            return 'Rejected';
        case 'approved':
            return 'Approved';
        case 'disbursed':
            return 'Disbursed';
        case 'reimbursed':
            return 'Reimbursed';
        default:
            return status?.trim() ? String(status) : '—';
    }
}

export function loanStatusChipClass(status: string | null | undefined): Record<string, boolean> {
    const s = normalizeLoanStatus(status);
    return {
        'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30':
            s === 'open',
        'bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30':
            s === 'approved',
        'bg-indigo-50 text-indigo-800 border border-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30':
            s === 'disbursed',
        'bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30':
            s === 'reimbursed',
        'bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30':
            s === 'rejected',
        'bg-zinc-100 text-zinc-700 border border-zinc-200/80 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/30':
            !LOAN_STATUSES.includes(s as LoanStatus),
    };
}

/** Allowed manual status transitions per backend rules. */
export function allowedLoanStatusTransitions(current: string | null | undefined): LoanStatus[] {
    switch (normalizeLoanStatus(current)) {
        case 'open':
            return ['approved', 'rejected'];
        case 'approved':
            return ['disbursed', 'rejected'];
        case 'rejected':
            return ['approved'];
        case 'disbursed':
            return ['reimbursed'];
        case 'reimbursed':
        default:
            return [];
    }
}

export function canChangeLoanStatus(current: string | null | undefined): boolean {
    return allowedLoanStatusTransitions(current).length > 0;
}

/** Remaining balance is meaningful only after disbursement (active or fully repaid). */
export function loanShowsRemainingBalance(status: string | null | undefined): boolean {
    const s = normalizeLoanStatus(status);
    return s === 'disbursed' || s === 'reimbursed';
}

/** Approver fields are shown for approved and post-approval statuses. */
export function loanShowsApproverInfo(status: string | null | undefined): boolean {
    const s = normalizeLoanStatus(status);
    return s === 'approved' || s === 'disbursed' || s === 'reimbursed';
}

/** Upload/delete disabled when loan has reached terminal reimbursed status. */
export function loanAllowsAttachmentUpload(status: string | null | undefined): boolean {
    return normalizeLoanStatus(status) !== 'reimbursed';
}

/** Workflow steps shown in attachment timeline (lifecycle order). */
export const LOAN_ATTACHMENT_TIMELINE_STEPS: readonly LoanStatus[] = [
    'open',
    'approved',
    'rejected',
    'disbursed',
    'reimbursed',
];

export function attachmentsForLoanStep(
    attachments: LoanAttachment[] | undefined,
    step: string
): LoanAttachment[] {
    const s = normalizeLoanStatus(step);
    return (attachments ?? []).filter((a) => normalizeLoanStatus(a.step) === s);
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

    getLoan(employeeId: string, loanId: string): Observable<LoanResponseDto> {
        return this._http.get<LoanResponseDto>(`${this._baseEmployee}/${employeeId}/loans/${loanId}`);
    }

    /**
     * GET printable loan form — available at every status. Returns the document as a self-contained
     * HTML page; the caller prints it (window.print()) to produce a PDF, since the backend no longer
     * renders PDFs itself (server-side Puppeteer rendering was prone to hanging under load).
     */
    getLoanPdf(employeeId: string, loanId: string, letterhead = false): Observable<string> {
        const params = new HttpParams().set('letterhead', String(letterhead));
        return this._http.get(`${this._baseEmployee}/${employeeId}/loans/${loanId}/pdf`, {
            params,
            responseType: 'text',
        });
    }

    updateLoan(employeeId: string, loanId: string, payload: UpdateLoanDto): Observable<unknown> {
        return this._http.patch(`${this._baseEmployee}/${employeeId}/loans/${loanId}`, payload);
    }

    deleteLoan(employeeId: string, loanId: string): Observable<DeleteLoanResponse> {
        return this._http.delete<DeleteLoanResponse>(`${this._baseEmployee}/${employeeId}/loans/${loanId}`);
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

    getLoanAttachments(employeeId: string, loanId: string): Observable<LoanAttachment[]> {
        return this._http.get<LoanAttachment[]>(
            `${this._baseEmployee}/${employeeId}/loans/${loanId}/attachments`
        );
    }

    uploadLoanAttachments(
        employeeId: string,
        loanId: string,
        files: File[],
        displayNames: string[]
    ): Observable<unknown> {
        if (files.length !== displayNames.length) {
            throw new Error('files and displayNames must have the same length');
        }
        const body = new FormData();
        for (const file of files) {
            body.append('files', file);
        }
        body.append(
            'displayNames',
            JSON.stringify(displayNames.map((n) => String(n).trim()))
        );
        return this._http.post(`${this._baseEmployee}/${employeeId}/loans/${loanId}/attachments`, body);
    }

    deleteLoanAttachment(employeeId: string, loanId: string, attachmentId: string): Observable<unknown> {
        return this._http.delete(
            `${this._baseEmployee}/${employeeId}/loans/${loanId}/attachments/${attachmentId}`
        );
    }
}
