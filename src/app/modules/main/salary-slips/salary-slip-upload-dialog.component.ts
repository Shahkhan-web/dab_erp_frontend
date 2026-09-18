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
import { formatMonthForPayload } from 'app/core/utils/date.utils';
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
    periodMonthDate: Date | null = null;
    uploadFile: File | null = null;
    uploading = false;

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

    /** Material month pickers only fire `monthSelected`; close the panel ourselves once a month is chosen. */
    onPeriodMonthSelected(date: Date, picker: { close: () => void }): void {
        this.periodMonthDate = date;
        picker.close();
    }

    async upload(): Promise<void> {
        if (!this.uploadFile) {
            this._toast.error('Select a file to upload');
            return;
        }
        const periodMonth = formatMonthForPayload(this.periodMonthDate);
        if (!periodMonth) {
            this._toast.error('Select the salary month');
            return;
        }
        this.uploading = true;
        try {
            await lastValueFrom(
                this._salarySlipsService.uploadSalarySlips(this.uploadFile, periodMonth)
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
