import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { TalabatOccupationRate, TalabatOccupationRatePayload, TalabatOccupationRatesService } from './talabat-occupation-rates.service';

export interface TalabatOccupationRateFormDialogData {
    rate: TalabatOccupationRate;
}

@Component({
    selector: 'app-talabat-occupation-rate-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './talabat-occupation-rate-form-dialog.component.html',
})
export class TalabatOccupationRateFormDialogComponent {
    form: FormGroup;
    saving = false;
    occupationLabel: string;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<TalabatOccupationRateFormDialogComponent, boolean>,
        private _service: TalabatOccupationRatesService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: TalabatOccupationRateFormDialogData,
    ) {
        const r = data.rate;
        this.occupationLabel = this._formatOccupation(r.occupation);
        this.form = this._fb.group({
            occupation: [{ value: r.occupation, disabled: true }],
            pickupRateAed: [r.pickupRateAed, [Validators.required, Validators.min(0)]],
            dropoffRateAed: [r.dropoffRateAed, [Validators.required, Validators.min(0)]],
            deliveriesReturnLcRateAed: [r.deliveriesReturnLcRateAed, [Validators.required, Validators.min(0)]],
        });
    }

    private _formatOccupation(value: string): string {
        switch (value) {
            case 'bike_rider': return 'Bike Rider';
            case 'bicyclist': return 'Bicyclist';
            default: return value;
        }
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const payload: TalabatOccupationRatePayload = {
            occupation: raw.occupation,
            pickupRateAed: raw.pickupRateAed,
            dropoffRateAed: raw.dropoffRateAed,
            deliveriesReturnLcRateAed: raw.deliveriesReturnLcRateAed,
        };
        this.saving = true;
        try {
            await lastValueFrom(this._service.updateRate(payload));
            this._toast.success('Occupation rate updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Save failed');
        } finally {
            this.saving = false;
        }
    }
}
