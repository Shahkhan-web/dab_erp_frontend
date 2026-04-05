import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface ActivityLog {
    id: string;
    userId?: string;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    createdAt: string;
}

export interface LogsListResponse {
    count: number;
    logs: ActivityLog[];
}

export interface LogsFilters {
    userId?: string | null;
    action?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LogsService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}logs`;

    getLogs(
        page: number,
        limit: number,
        filters?: LogsFilters
    ): Observable<LogsListResponse> {
        let params = new HttpParams()
            .set('page', String(page))
            .set('limit', String(limit));
        if (filters?.userId) params = params.set('userId', filters.userId);
        if (filters?.action) params = params.set('action', filters.action);
        if (filters?.startDate) params = params.set('startDate', filters.startDate);
        if (filters?.endDate) params = params.set('endDate', filters.endDate);
        return this._http.get<LogsListResponse>(this._base, { params });
    }
}
