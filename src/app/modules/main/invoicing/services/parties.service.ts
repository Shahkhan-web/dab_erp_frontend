import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export type PartyType = 'customer' | 'vendor' | 'both';

export const PARTY_TYPES: PartyType[] = ['customer', 'vendor', 'both'];

export interface Party {
    id: string;
    name: string;
    type: PartyType;
    companyId?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    trn?: string | null;
    address?: string | null;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface PartiesListResponse {
    count: number;
    data: Party[];
}

export interface PartiesListFilters {
    type?: PartyType | null;
    companyId?: string | null;
    search?: string | null;
}

export interface PartyCreatePayload {
    name: string;
    type?: PartyType;
    companyId?: string | null;
    email?: string | null;
    phone?: string | null;
    trn?: string | null;
    address?: string | null;
    notes?: string | null;
}

export type PartyUpdatePayload = Partial<PartyCreatePayload>;

export function partyTypeLabel(type: PartyType | string | null | undefined): string {
    switch ((type ?? '').toLowerCase()) {
        case 'customer':
            return 'Customer';
        case 'vendor':
            return 'Vendor';
        case 'both':
            return 'Customer & Vendor';
        default:
            return type?.trim() ? String(type) : '—';
    }
}

export function partyDisplayName(party: Party | null | undefined): string {
    if (!party) return '—';
    return party.name?.trim() || '—';
}

@Injectable({ providedIn: 'root' })
export class PartiesService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}parties`;

    getParties(page: number, limit: number, filters?: PartiesListFilters): Observable<PartiesListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.companyId) params = params.set('companyId', filters.companyId);
        if (filters?.search?.trim()) params = params.set('search', filters.search.trim());
        return this._http.get<PartiesListResponse>(this._base, { params });
    }

    getParty(id: string): Observable<Party> {
        return this._http.get<Party>(`${this._base}/${id}`);
    }

    createParty(payload: PartyCreatePayload): Observable<Party> {
        return this._http.post<Party>(this._base, payload);
    }

    updateParty(id: string, payload: PartyUpdatePayload): Observable<Party> {
        return this._http.put<Party>(`${this._base}/${id}`, payload);
    }

    deleteParty(id: string): Observable<{ message?: string }> {
        return this._http.delete<{ message?: string }>(`${this._base}/${id}`);
    }
}
