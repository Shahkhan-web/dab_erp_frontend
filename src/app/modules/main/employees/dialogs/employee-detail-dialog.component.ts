import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { EmployeesService, EmployeeAssignedAsset } from '../employees.service';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleRead } from 'app/core/auth/module-access.util';

export interface EmployeeDetailDialogData {
    id: string;
}

@Component({
    selector: 'app-employee-detail-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    providers: [DatePipe, DecimalPipe],
    templateUrl: './employee-detail-dialog.component.html',
    styleUrl: './employee-detail-dialog.component.scss',
})
export class EmployeeDetailDialogComponent implements OnInit {
    data: any | null = null;
    loading = true;
    error: string | null = null;
    employeeAssets: EmployeeAssignedAsset[] = [];

    constructor(
        private dialogRef: MatDialogRef<EmployeeDetailDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public dialogData: EmployeeDetailDialogData,
        private datePipe: DatePipe,
        private decimalPipe: DecimalPipe,
        private employeesService: EmployeesService,
        private authService: AuthService,
        private toast: ToastrService
    ) {}

    get canReadAssets(): boolean {
        return hasModuleRead(this.authService.profileData, 'asset');
    }

    ngOnInit(): void {
        this.loadDetail();
    }

    private loadDetail(): void {
        const id = this.dialogData?.id;
        if (!id) {
            this.error = 'Invalid employee.';
            this.loading = false;
            return;
        }
        this.loading = true;
        this.error = null;
        lastValueFrom(this.employeesService.getEmployee(id))
            .then(async (res: any) => {
                const raw = res?.data ?? res;
                if (!raw) {
                    this.error = 'No data received.';
                    this.loading = false;
                    return;
                }
                this.data = raw;
                if (this.canReadAssets) {
                    try {
                        this.employeeAssets = await lastValueFrom(this.employeesService.getEmployeeAssets(id));
                    } catch {
                        this.employeeAssets = [];
                    }
                } else {
                    this.employeeAssets = [];
                }
                this.loading = false;
            })
            .catch((err: HttpErrorResponse) => {
                this.loading = false;
                this.error = err?.error?.message ?? 'Failed to load employee.';
                this.toast.error(this.error);
            });
    }

    /** Display value: string/number as-is; object with name/code as name or code; empty as — */
    display(value: any): string {
        if (value == null) return '—';
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'object') {
            const name = value?.name ?? value?.label;
            const code = value?.code;
            if (name != null && String(name).trim() !== '') return String(name).trim();
            if (code != null && String(code).trim() !== '') return String(code).trim();
        }
        return '—';
    }

    displayDate(value: any): string {
        if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) return '—';
        if (typeof value === 'string') return this.datePipe.transform(value, 'mediumDate') ?? '—';
        return '—';
    }

    get fullName(): string {
        if (!this.data) return '—';
        const parts = [this.data.firstName, this.data.middleName, this.data.lastName].filter(Boolean);
        return parts.join(' ') || '—';
    }

    get workingStatusLabel(): string {
        const s = this.data?.workingStatus;
        return s ? (s === 'active' ? 'Active' : 'Inactive') : '—';
    }

    get profileCompletionFormatted(): string {
        const p = this.data?.profileCompletion;
        return p != null ? (this.decimalPipe.transform(p, '1.1-1') ?? '0') + '%' : '—';
    }

    getAssetTypeLabel(type: string | undefined): string {
        if (!type) return '';
        switch (type) {
            case 'cycle': return 'Cycle';
            case 'bike': return 'Bike';
            case 'sim_card': return 'SIM Card';
            default: return 'Other';
        }
    }

    getAssetMonthlyCost(asset: EmployeeAssignedAsset): number {
        return Number(asset.monthlyCostSnapshot ?? asset.monthlyCost) || 0;
    }

    /** Same URL resolution as employee form / list. */
    get profilePictureSrc(): string | null {
        const d = this.data;
        if (!d) return null;
        const u = d.profilePictureUrl ?? d.profilePicture ?? d.profileImageUrl;
        return typeof u === 'string' && u.trim() ? u.trim() : null;
    }

    get profilePhotoAlt(): string {
        const n = this.fullName;
        return n && n !== '—' ? `Photo of ${n}` : 'Employee photo';
    }

    get occupationLabel(): string {
        const occ = String(this.data?.occupation ?? '').trim().toLowerCase();
        switch (occ) {
            case 'bicyclist':
                return 'Bicyclist';
            case 'bike rider':
                return 'Bike rider';
            case 'staff':
                return 'Staff';
            default:
                return this.data?.occupation ? String(this.data.occupation) : '—';
        }
    }

    close(): void {
        this.dialogRef.close();
    }
}
