import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface EmployeeListItem {
    id: string;
    companyId?: string;
    employeeId?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    employeeNameArabic?: string;
    referenceEmployeeName?: string;
    personalNumber?: string;
    riderId?: string;
    nationality?: string;
    workingStatus?: string;
    profileCompletion?: number;
    profilePictureUrl?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

export interface EmployeesListResponse {
    count: number;
    employees: EmployeeListItem[];
}

/** Extra document returned on GET employee or after upload; field names may vary by API. */
export interface EmployeeExtraDocument {
    id: string;
    displayName?: string;
    mimeType?: string;
    url?: string;
    createdAt?: string;
    [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class EmployeesService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}employee`;

    getEmployees(
        page: number,
        limit: number,
        filters?: {
            employeeId?: string | null;
            riderId?: string | null;
            name?: string | null;
            nationality?: string | null;
            workingStatus?: string | null;
            companyId?: string | null;
            occupation?: string | null;
        }
    ): Observable<EmployeesListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
        if (filters?.riderId) params = params.set('riderId', filters.riderId);
        if (filters?.name) params = params.set('name', filters.name);
        if (filters?.nationality) params = params.set('nationality', filters.nationality);
        if (filters?.workingStatus) params = params.set('workingStatus', filters.workingStatus);
        if (filters?.companyId) params = params.set('companyId', filters.companyId);
        if (filters?.occupation) params = params.set('occupation', filters.occupation);
        return this._http.get<EmployeesListResponse>(this._base, { params });
    }

    getEmployee(id: string): Observable<EmployeeListItem & Record<string, unknown>> {
        return this._http.get<EmployeeListItem & Record<string, unknown>>(`${this._base}/${id}`);
    }

    deleteEmployee(id: string): Observable<unknown> {
        return this._http.delete(`${this._base}/${id}`);
    }

    createEmployee(payload: {
        firstName: string;
        middleName?: string;
        lastName: string;
        employeeNameArabic?: string;
        personalNumber?: string;
        riderId?: string;
        employeeIdIndex?: number;
        workingStatus: string;
        occupation: string;
        dateOfJoining?: string;
        postingDate: string;
        referenceEmployeeName?: string;
        companyId: string;
    }): Observable<{ id?: string; employee?: { id?: string } }> {
        return this._http.post<{ id?: string; employee?: { id?: string } }>(this._base, payload);
    }

    /**
     * Used by the stepper "Step 1 — Overview" update button.
     * Backend commonly supports PATCH /employee/:id for top-level fields.
     */
    updateEmployeeOverview(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}`, payload);
    }

    updatePersonalDetails(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}/personal`, payload);
    }

    updateContactDetails(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}/contact`, payload);
    }

    updateJoiningDetails(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}/joining`, payload);
    }

    updateSalaryDetails(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}/salary`, payload);
    }

    updateDocumentsDetails(id: string, payload: Record<string, unknown>): Observable<unknown> {
        return this._http.patch(`${this._base}/${id}/documents`, payload);
    }

    /**
     * POST multipart: repeated `files` + `displayNames` as JSON array (same order and count).
     * Up to 30 files; max 15MB each; PDF / JPEG / PNG / WebP / GIF.
     */
    uploadExtraDocuments(employeeId: string, files: File[], displayNames: string[]): Observable<unknown> {
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
        return this._http.post(`${this._base}/${employeeId}/extra-documents`, body);
    }

    renameExtraDocument(employeeId: string, documentId: string, displayName: string): Observable<unknown> {
        return this._http.patch(`${this._base}/${employeeId}/extra-documents/${documentId}`, {
            displayName: displayName.trim(),
        });
    }

    deleteExtraDocument(employeeId: string, documentId: string): Observable<unknown> {
        return this._http.delete(`${this._base}/${employeeId}/extra-documents/${documentId}`);
    }

    /** POST multipart `file` — max 5MB; JPEG, PNG, WebP, GIF (per API). */
    uploadProfilePicture(employeeId: string, file: File): Observable<unknown> {
        const body = new FormData();
        body.append('file', file);
        return this._http.post(`${this._base}/${employeeId}/profile-picture`, body);
    }

    deleteProfilePicture(employeeId: string): Observable<unknown> {
        return this._http.delete(`${this._base}/${employeeId}/profile-picture`);
    }

    bulkDelete(ids: string[]): Observable<unknown> {
        return this._http.delete(`${this._base}/bulk-delete`, { body: { ids } });
    }
}
