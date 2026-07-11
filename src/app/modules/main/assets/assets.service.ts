import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { map, Observable } from 'rxjs';

export type AssetType = 'cycle' | 'bike' | 'sim_card' | 'other';
export type AssetStatus = 'available' | 'assigned' | 'under_maintenance' | 'damaged' | 'lost' | 'retired';
export type AcquisitionType = 'bought' | 'rented';
export type InsuranceCoverageType = 'comprehensive' | 'third_party';
export type MaintenanceType = 'routine_service' | 'tyre_replace' | 'repair' | 'accident_repair' | 'fine_payment' | 'other';

export interface Asset {
    id: string;
    companyId: string;
    companyName?: string;
    company?: {
        id: string;
        name: string;
        employeeIdPrefix?: string;
    };
    type: AssetType;
    name: string;
    serialNumber: string;
    acquisitionType: AcquisitionType;
    purchasePrice?: number;
    monthlyCost: number;
    acquisitionDate: string;
    status: AssetStatus;
    assignedToEmployeeId?: string | null;
    createdAt: string;
    updatedAt: string;
    currentAssignment?: AssetAssignment | null;
    assignedToEmployee?: AssetAssignment | Record<string, unknown> | null;
    images?: AssetInventoryImage[];
    registrations?: MulkiyaRegistration[];
    insurances?: InsurancePolicy[];
    maintenances?: MaintenanceLog[];
    assignments?: AssetAssignment[];
}

export interface AssetAssignment {
    id: string;
    assetId: string;
    employeeId: string;
    employeeName?: string;
    employeeCode?: string;
    assignedAt: string;
    returnedAt?: string | null;
    deductFromSalary: boolean;
    monthlyCostSnapshot?: number;
    assignmentNotes?: string | null;
    returnNotes?: string | null;
    createdAt: string;
    employee?: {
        id?: string;
        employeeId?: string;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        [key: string]: unknown;
    };
}

export interface AssetInventoryImage {
    id: string;
    assetId: string;
    displayName: string;
    imageUrl: string;
    createdAt: string;
}

export interface MulkiyaRegistration {
    id: string;
    assetId: string;
    plateNumber: string;
    plateCode?: string;
    registrationNumber: string;
    issueDate: string;
    expiryDate: string;
    registrationFee: number;
    cardScanUrl?: string;
    createdAt: string;
}

export interface InsurancePolicy {
    id: string;
    assetId: string;
    providerName: string;
    policyNumber: string;
    coverageType: InsuranceCoverageType;
    startDate: string;
    expiryDate: string;
    premiumCost: number;
    policyPdfUrl?: string;
    createdAt: string;
}

export interface MaintenanceLog {
    id: string;
    assetId: string;
    type: MaintenanceType;
    maintenanceDate: string;
    cost: number;
    odometerReading?: number;
    workshopName?: string;
    description?: string;
    invoiceScanUrl?: string;
    createdAt: string;
}

export interface AssetSummaryItem {
    type: AssetType;
    count: number;
    totalMonthlyCost: number;
}

export interface AssetDashboardCosts {
    assetSummary: AssetSummaryItem[];
    totalHistoricalMaintenance: number;
    activeMonthlySalaryRecoveries: number;
}

export interface AssetsListResponse {
    count: number;
    data: Asset[];
}

export interface AssetsListFilters {
    type?: string | null;
    status?: string | null;
    companyId?: string | null;
    employeeId?: string | null;
    search?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AssetsService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}assets`;

    getAssets(page: number, limit: number, filters?: AssetsListFilters): Observable<AssetsListResponse> {
        let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.companyId) params = params.set('companyId', filters.companyId);
        if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
        if (filters?.search) params = params.set('search', filters.search);
        return this._http.get<unknown>(this._base, { params }).pipe(map((body) => this.normalizeListResponse(body)));
    }

    getAsset(id: string): Observable<Asset> {
        return this._http.get<unknown>(`${this._base}/${id}`).pipe(map((body) => this.normalizeAsset(body)));
    }

    createAsset(payload: Partial<Asset>): Observable<Asset> {
        return this._http.post<Asset>(this._base, payload);
    }

    updateAsset(id: string, payload: Partial<Asset>): Observable<Asset> {
        return this._http.put<Asset>(`${this._base}/${id}`, payload);
    }

    updateAssetStatus(id: string, status: AssetStatus): Observable<Asset> {
        return this._http
            .patch<unknown>(`${this._base}/${id}/status`, { status })
            .pipe(map((body) => this.normalizeAsset(body)));
    }

    deleteAsset(id: string): Observable<unknown> {
        return this._http.delete(`${this._base}/${id}`);
    }

    getDashboardCosts(companyId?: string | null): Observable<AssetDashboardCosts> {
        let params = new HttpParams();
        if (companyId) {
            params = params.set('companyId', companyId);
        }
        return this._http
            .get<unknown>(`${this._base}/dashboard/costs`, { params })
            .pipe(map((body) => this.normalizeDashboardCosts(body)));
    }

    getLookupNames(companyId?: string | null): Observable<string[]> {
        return this.getStringLookup('names', companyId);
    }

    getLookupInsuranceProviders(companyId?: string | null): Observable<string[]> {
        return this.getStringLookup('insurance-providers', companyId);
    }

    getLookupWorkshops(companyId?: string | null): Observable<string[]> {
        return this.getStringLookup('workshops', companyId);
    }

    private getStringLookup(kind: 'names' | 'insurance-providers' | 'workshops', companyId?: string | null): Observable<string[]> {
        let params = new HttpParams();
        if (companyId) {
            params = params.set('companyId', companyId);
        }
        return this._http
            .get<unknown>(`${this._base}/lookups/${kind}`, { params })
            .pipe(map((body) => this.normalizeStringLookup(body)));
    }

    /** Backend list payloads may use `data`, `assets`, `items`, a bare array, or nest under `data`. */
    private normalizeListResponse(body: unknown): AssetsListResponse {
        const root = (body as { data?: unknown })?.data ?? body;
        const items = this.extractAssetArray(root).map((item) => this.normalizeAssetRecord(item));
        const meta = (root as { meta?: { total?: unknown } })?.meta;
        const count =
            typeof meta?.total === 'number'
                ? meta.total
                : typeof (root as { count?: unknown })?.count === 'number'
                  ? (root as { count: number }).count
                  : items.length;
        return { count, data: items };
    }

    private normalizeAsset(body: unknown): Asset {
        const raw = (body as { data?: unknown })?.data ?? body;
        return this.normalizeAssetRecord(raw);
    }

    private normalizeAssetRecord(raw: unknown): Asset {
        const record = (raw ?? {}) as Asset & Record<string, unknown>;
        const company = record.company as { name?: string } | null | undefined;
        const assignedToEmployee = record.assignedToEmployee;

        const asset: Asset = { ...record };

        if (!asset.companyName && company?.name) {
            asset.companyName = company.name;
        }

        if (Array.isArray(asset.assignments)) {
            asset.assignments = asset.assignments.map((assignment) => this.normalizeAssignment(assignment));
        }

        const activeAssignment = asset.assignments?.find((assignment) => !assignment.returnedAt);
        if (activeAssignment) {
            asset.currentAssignment = activeAssignment;
        } else if (assignedToEmployee && typeof assignedToEmployee === 'object') {
            const display = this.extractEmployeeDisplay(assignedToEmployee);
            asset.currentAssignment = {
                id: '',
                assetId: String(record.id ?? ''),
                employeeId: display.employeeId,
                employeeName: display.employeeName,
                employeeCode: display.employeeCode,
                assignedAt: '',
                returnedAt: null,
                deductFromSalary: false,
                createdAt: '',
            };
        }

        return asset;
    }

    private normalizeAssignment(assignment: AssetAssignment): AssetAssignment {
        const row = assignment as AssetAssignment & Record<string, unknown>;
        const display = this.extractEmployeeDisplay(row.employee ?? row);
        return {
            ...row,
            employeeId: row.employeeId || display.employeeId,
            employeeName: row.employeeName || display.employeeName,
            employeeCode: row.employeeCode || display.employeeCode,
        };
    }

    private extractEmployeeDisplay(source: unknown): {
        employeeId: string;
        employeeName?: string;
        employeeCode?: string;
    } {
        const emp = (source ?? {}) as Record<string, unknown>;
        const employeeName =
            typeof emp['employeeName'] === 'string' && emp['employeeName'].trim()
                ? emp['employeeName'].trim()
                : [emp['firstName'], emp['middleName'], emp['lastName']]
                      .filter((part) => typeof part === 'string' && part.trim() !== '')
                      .map((part) => String(part).trim())
                      .join(' ') || undefined;
        const employeeCode =
            typeof emp['employeeCode'] === 'string' && emp['employeeCode'].trim()
                ? emp['employeeCode'].trim()
                : typeof emp['employeeId'] === 'string' && emp['employeeId'].trim()
                  ? emp['employeeId'].trim()
                  : undefined;
        const employeeId =
            typeof emp['id'] === 'string'
                ? emp['id']
                : typeof emp['employeeId'] === 'string'
                  ? emp['employeeId']
                  : '';
        return { employeeId, employeeName, employeeCode };
    }

    private normalizeDashboardCosts(body: unknown): AssetDashboardCosts {
        const raw = (body as { data?: unknown })?.data ?? body;
        const costs = raw as AssetDashboardCosts;
        return {
            assetSummary: Array.isArray(costs?.assetSummary) ? costs.assetSummary : [],
            totalHistoricalMaintenance: Number(costs?.totalHistoricalMaintenance) || 0,
            activeMonthlySalaryRecoveries: Number(costs?.activeMonthlySalaryRecoveries) || 0,
        };
    }

    private normalizeStringLookup(body: unknown): string[] {
        const raw = (body as { data?: unknown })?.data ?? body;
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
            .map((item) => item.trim())
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    private extractAssetArray(body: unknown): Asset[] {
        if (Array.isArray(body)) return body as Asset[];
        if (!body || typeof body !== 'object') return [];
        const record = body as Record<string, unknown>;
        for (const key of ['items', 'assets', 'data']) {
            const value = record[key];
            if (Array.isArray(value)) return value as Asset[];
        }
        return [];
    }

    assignAsset(id: string, payload: { employeeId: string; assignedAt?: string; deductFromSalary: boolean; assignmentNotes?: string }): Observable<unknown> {
        return this._http.post(`${this._base}/${id}/assign`, payload);
    }

    returnAsset(id: string, payload: { returnedAt?: string; returnNotes?: string }): Observable<unknown> {
        return this._http.post(`${this._base}/${id}/return`, payload);
    }

    uploadImage(id: string, file: File, displayName: string): Observable<unknown> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('displayName', displayName);
        return this._http.post(`${this._base}/${id}/images`, formData);
    }

    deleteImage(id: string, imageId: string): Observable<unknown> {
        return this._http.delete(`${this._base}/${id}/images/${imageId}`);
    }

    uploadRegistration(id: string, payload: { file?: File; plateNumber: string; plateCode?: string; registrationNumber: string; issueDate: string; expiryDate: string; registrationFee: number }): Observable<unknown> {
        const formData = new FormData();
        if (payload.file) {
            formData.append('file', payload.file);
        }
        formData.append('plateNumber', payload.plateNumber);
        if (payload.plateCode) formData.append('plateCode', payload.plateCode);
        formData.append('registrationNumber', payload.registrationNumber);
        formData.append('issueDate', payload.issueDate);
        formData.append('expiryDate', payload.expiryDate);
        formData.append('registrationFee', String(payload.registrationFee));
        return this._http.post(`${this._base}/${id}/registration`, formData);
    }

    uploadInsurance(id: string, payload: { file?: File; providerName: string; policyNumber: string; coverageType: InsuranceCoverageType; startDate: string; expiryDate: string; premiumCost: number }): Observable<unknown> {
        const formData = new FormData();
        if (payload.file) {
            formData.append('file', payload.file);
        }
        formData.append('providerName', payload.providerName);
        formData.append('policyNumber', payload.policyNumber);
        formData.append('coverageType', payload.coverageType);
        formData.append('startDate', payload.startDate);
        formData.append('expiryDate', payload.expiryDate);
        formData.append('premiumCost', String(payload.premiumCost));
        return this._http.post(`${this._base}/${id}/insurance`, formData);
    }

    uploadMaintenance(id: string, payload: { file?: File; type: MaintenanceType; maintenanceDate: string; cost: number; odometerReading?: number; workshopName?: string; description?: string }): Observable<unknown> {
        const formData = new FormData();
        if (payload.file) {
            formData.append('file', payload.file);
        }
        formData.append('type', payload.type);
        formData.append('maintenanceDate', payload.maintenanceDate);
        formData.append('cost', String(payload.cost));
        if (payload.odometerReading !== undefined && payload.odometerReading !== null) {
            formData.append('odometerReading', String(payload.odometerReading));
        }
        if (payload.workshopName) formData.append('workshopName', payload.workshopName);
        if (payload.description) formData.append('description', payload.description);
        return this._http.post(`${this._base}/${id}/maintenance`, formData);
    }
}
