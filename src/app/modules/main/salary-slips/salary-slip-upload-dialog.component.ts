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
import { BulkUploadResult, SalarySlipsService } from './salary-slips.service';
import { DateTime } from 'luxon';

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
    /** Luxon `DateTime` — the type the app's Material date adapter emits. */
    periodMonthDate: DateTime | null = null;
    uploadFile: File | null = null;
    uploading = false;
    /** Shown inline in the dialog, so a failure is visible even if the toast is missed. */
    errorMessage: string | null = null;
    /**
     * Set once the upload returns. A 201 can still mean rows were skipped, so the
     * dialog stays open on a partial result and reports the breakdown rather than
     * closing and leaving the operator to reconcile the list against their file.
     */
    result: BulkUploadResult | null = null;

    constructor(
        private _dialogRef: MatDialogRef<SalarySlipUploadDialogComponent, boolean | undefined>,
        private _salarySlipsService: SalarySlipsService,
        private _toast: ToastrService
    ) {}

    cancel(): void {
        // A partial upload already created slips, so the list still needs a refresh.
        this._dialogRef.close(this.result ? true : undefined);
    }

    onUploadFilePicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.uploadFile = input.files?.[0] ?? null;
        this.errorMessage = null;
        this.result = null;
    }

    /** Material month pickers only fire `monthSelected`; close the panel ourselves once a month is chosen. */
    onPeriodMonthSelected(date: DateTime, picker: { close: () => void }): void {
        this.periodMonthDate = date;
        this.errorMessage = null;
        this.result = null;
        picker.close();
    }

    /**
     * Nest returns `message` as a string for pipe failures and as a string[] for
     * DTO validation, so both shapes have to be handled or the user sees "[object Object]".
     */
    private _errorText(e: any): string {
        const body = e?.error;
        const raw = Array.isArray(body?.message)
            ? body.message.join(' ')
            : body?.message ?? (typeof body === 'string' ? body : null) ?? e?.message;
        const text = typeof raw === 'string' ? raw.trim() : '';
        return text || 'Failed to upload salary slips';
    }

    async upload(): Promise<void> {
        // Validation runs inside the try as well: a throw out here used to leave the
        // dialog completely silent — no toast, no loader, no request.
        this.errorMessage = null;
        this.result = null;
        try {
            if (!this.uploadFile) {
                this._fail('Select a file to upload');
                return;
            }
            const periodMonth = formatMonthForPayload(this.periodMonthDate);
            if (!periodMonth) {
                this._fail('Select the salary month');
                return;
            }
            this.uploading = true;
            this.result = await lastValueFrom(
                this._salarySlipsService.uploadSalarySlips(this.uploadFile, periodMonth)
            );
            const skipped =
                this.result.notFoundRiderIds.length + this.result.errors.length;
            if (skipped === 0) {
                this._toast.success(
                    `${this.result.created} salary ${this.result.created === 1 ? 'slip' : 'slips'} created`
                );
                this._dialogRef.close(true);
                return;
            }
            // Hold the dialog open so the breakdown below can be read and acted on.
            this._toast.warning(
                `${this.result.created} created, ${skipped} ${skipped === 1 ? 'row' : 'rows'} not imported`
            );
        } catch (e: any) {
            this._fail(this._errorText(e));
        } finally {
            this.uploading = false;
        }
    }

    private _fail(message: string): void {
        this.errorMessage = message;
        this._toast.error(message);
    }
}
