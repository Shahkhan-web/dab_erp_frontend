import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { SalarySlipsService } from './salary-slips.service';

@Component({
    selector: 'app-salary-slip-upload-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        MatIconModule,
        OverlayLoaderDirective,
    ],
    templateUrl: './salary-slip-upload-dialog.component.html',
})
export class SalarySlipUploadDialogComponent {
    payrollFrequency: string | null = 'monthly';
    startDate: Date | null = null;
    endDate: Date | null = null;
    uploadFile: File | null = null;
    uploading = false;
    payrollFrequencyOptions = ['monthly', 'fortnightly', 'bimonthly', 'weekly', 'daily'] as const;

    constructor(
        private _dialogRef: MatDialogRef<SalarySlipUploadDialogComponent, boolean | undefined>,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService
    ) {}

    cancel(): void {
        this._dialogRef.close();
    }

    onUploadFilePicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.uploadFile = input.files?.[0] ?? null;
    }

    private _dateToYmd(value: unknown): string | null {
        if (!value) return null;
        const d = value instanceof Date ? value : new Date(value as string);
        if (Number.isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    async upload(): Promise<void> {
        if (!this.uploadFile) {
            this._toast.error('Select a file to upload');
            return;
        }
        if (!this.payrollFrequency) {
            this._toast.error('Choose payroll frequency');
            return;
        }
        const start = this._dateToYmd(this.startDate);
        const end = this._dateToYmd(this.endDate);
        if (!start || !end) {
            this._toast.error('Select start and end date');
            return;
        }
        this.uploading = true;
        try {
            await lastValueFrom(
                this._salarySlipsService.uploadSalarySlips(this.uploadFile, this.payrollFrequency, start, end)
            );
            this._toast.success('Salary slips uploaded');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload salary slips');
        } finally {
            this.uploading = false;
        }
    }
}
