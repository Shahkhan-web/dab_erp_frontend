import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface PayComponent {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PayComponentsListResponse {
    count: number;
    items: PayComponent[];
}

export interface PayComponentsListFilters {
    name?: string | null;
    type?: string | null;
    isActive?: boolean | null;
}

export interface PayComponentPayload {
    name: string;
    type: string;
    isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class PayComponentsService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}pay-components`;

    getPayComponents(
        page?: number,
        limit?: number,
        filters?: PayComponentsListFilters
    ): Observable<PayComponentsListResponse> {
        let params = new HttpParams();
        if (page) params = params.set('page', String(page));
        if (limit) params = params.set('limit', String(limit));
        if (filters?.name) params = params.set('name', filters.name);
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.isActive === true || filters?.isActive === false) {
            params = params.set('isActive', String(filters.isActive));
        }
        return this._http.get<PayComponentsListResponse>(this._base, { params });
    }

    getPayComponent(id: string): Observable<PayComponent> {
        return this._http.get<PayComponent>(`${this._base}/${id}`);
    }

    createPayComponent(payload: PayComponentPayload): Observable<unknown> {
        return this._http.post(this._base, payload);
    }

    updatePayComponent(id: string, payload: PayComponentPayload): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}`, payload);
    }
}
