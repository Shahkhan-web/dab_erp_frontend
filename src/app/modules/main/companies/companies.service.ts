import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { catchError, map, Observable, of } from 'rxjs';

export interface Company {
    id: string;
    name: string;
    employeeIdPrefix: string;
    letterHeadUrl?: unknown;
    createdAt: string;
    updatedAt: string;
}

export interface CompanyCreatePayload {
    name: string;
    employeeIdPrefix: string;
}

/** API may return a URL string, an object with a url field, or `{}` when unset. */
export function resolveLetterHeadUrl(letterHeadUrl: unknown): string | null {
    if (letterHeadUrl == null) return null;
    if (typeof letterHeadUrl === 'string' && letterHeadUrl.trim() !== '') return letterHeadUrl.trim();
    if (typeof letterHeadUrl === 'object' && !Array.isArray(letterHeadUrl)) {
        const keys = ['url', 'href', 'src', 'fileUrl'] as const;
        for (const k of keys) {
            const v = (letterHeadUrl as Record<string, unknown>)[k];
            if (typeof v === 'string' && v.trim() !== '') return v.trim();
        }
    }
    return null;
}

@Injectable({ providedIn: 'root' })
export class CompaniesService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}company`;

    /** Optional `id` filters by company UUID (GET `/company?id=`). */
    getList(companyId?: string | null): Observable<Company[]> {
        let params = new HttpParams();
        if (companyId?.trim()) {
            params = params.set('id', companyId.trim());
        }
        return this._http.get<unknown>(this._base, { params }).pipe(map((body) => this.normalizeList(body)));
    }

    /**
     * Whether the PDF API should use letterhead: true when `letterHeadUrl` resolves to a URL, else false.
     */
    letterheadEnabledForCompany(companyId: string | null | undefined): Observable<boolean> {
        const id = companyId?.trim() ?? '';
        if (!id) {
            return of(false);
        }
        return this.getList(id).pipe(
            map((companies) => {
                const c = companies[0];
                return resolveLetterHeadUrl(c?.letterHeadUrl) != null;
            }),
            catchError(() => of(false))
        );
    }

    create(payload: CompanyCreatePayload): Observable<Company> {
        return this._http.post<Company>(this._base, payload);
    }

    /** POST multipart `file` — JPEG/PNG, 1200×1700–4000×5000 px, max 5MB (server-enforced). */
    uploadLetterHead(companyId: string, file: File): Observable<unknown> {
        const formData = new FormData();
        formData.append('file', file);
        return this._http.post(`${this._base}/${companyId}/letter-head`, formData);
    }

    private normalizeList(body: unknown): Company[] {
        if (Array.isArray(body)) return body as Company[];
        const data = (body as { data?: unknown })?.data;
        return Array.isArray(data) ? (data as Company[]) : [];
    }
}
