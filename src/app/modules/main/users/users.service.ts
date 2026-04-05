import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ModuleAccess } from 'app/core/auth/module-access.util';
import { environment } from 'environments/environment';
import { map, Observable } from 'rxjs';

export interface UserListItem {
    id: string;
    email: string;
    role: string;
    displayName: string;
    designation?: string | null;
    moduleAccess?: ModuleAccess | null;
    /** Some APIs return the same shape as auth/me under `access`. */
    access?: ModuleAccess | null;
    createdAt: string;
    updatedAt: string;
    suspendedAt?: string | null;
    profilePictureUrl?: string | null;
    [key: string]: unknown;
}

export interface UsersListResponse {
    count: number;
    users: UserListItem[];
}

export interface UsersListParams {
    page?: number;
    limit?: number;
    id?: string;
    displayName?: string;
    email?: string;
    role?: string;
    isSuspended?: boolean;
}

/** GET /users/designations */
export interface DesignationsResponse {
    designations: string[];
}

export interface UserCreateUpdatePayload {
    email: string;
    password?: string;
    role: 'admin' | 'manager';
    displayName: string;
    designation?: string;
    moduleAccess: ModuleAccess;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}users`;
    private _authUsersBase = `${environment.apiUrl}auth/users`;

    getList(params?: UsersListParams): Observable<UsersListResponse> {
        let httpParams = new HttpParams();
        if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
        if (params?.limit != null) httpParams = httpParams.set('limit', String(params.limit));
        if (params?.id) httpParams = httpParams.set('id', params.id);
        if (params?.displayName) httpParams = httpParams.set('displayName', params.displayName);
        if (params?.email) httpParams = httpParams.set('email', params.email);
        if (params?.role) httpParams = httpParams.set('role', params.role);
        if (params?.isSuspended !== undefined && params?.isSuspended !== null)
            httpParams = httpParams.set('isSuspended', String(params.isSuspended));
        return this._http.get<UsersListResponse>(this._base, { params: httpParams });
    }

    /** Sorted unique designations (admin-only on backend). */
    getDesignations(): Observable<string[]> {
        return this._http
            .get<DesignationsResponse | { data: DesignationsResponse }>(`${this._base}/designations`)
            .pipe(
                map((raw: any) => {
                    const body = raw?.data ?? raw;
                    const list = body?.designations;
                    if (!Array.isArray(list)) return [];
                    return list
                        .filter((d: unknown) => typeof d === 'string' && String(d).trim() !== '')
                        .map((d: string) => d.trim());
                })
            );
    }

    create(payload: UserCreateUpdatePayload): Observable<UserListItem> {
        return this._http.post<UserListItem>(this._authUsersBase, payload);
    }

    update(id: string, payload: UserCreateUpdatePayload): Observable<UserListItem> {
        return this._http.patch<UserListItem>(`${this._authUsersBase}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this._http.delete<void>(`${this._authUsersBase}/${id}`);
    }

    setSuspended(id: string, suspended: boolean): Observable<UserListItem> {
        return this._http.patch<UserListItem>(`${this._authUsersBase}/${id}/suspend`, { suspended });
    }

    /** POST multipart `file` — same constraints as employee profile (per API). */
    uploadProfilePicture(userId: string, file: File): Observable<unknown> {
        const body = new FormData();
        body.append('file', file);
        return this._http.post(`${this._authUsersBase}/${userId}/profile-picture`, body);
    }

    deleteProfilePicture(userId: string): Observable<unknown> {
        return this._http.delete(`${this._authUsersBase}/${userId}/profile-picture`);
    }
}
