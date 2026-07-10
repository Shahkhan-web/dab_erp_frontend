import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AssetsService } from '../assets.service';

export interface AssetRegistrationDialogData {
    assetId: string;
}

@Component({
    selector: 'app-asset-registration-dialog',
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
    templateUrl: './asset-registration-dialog.component.html',
})
export class AssetRegistrationDialogComponent implements OnInit {
    form: FormGroup;
    saving = false;
    selectedFile: File | null = null;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetRegistrationDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetRegistrationDialogData
    ) {
        this.form = this._fb.group({
            plateNumber: ['', Validators.required],
            plateCode: [''],
            registrationNumber: ['', Validators.required],
            issueDate: ['', Validators.required],
            expiryDate: ['', Validators.required],
            registrationFee: [0, [Validators.required, Validators.min(0)]],
        });
    }

    ngOnInit(): void {}

    onFileSelected(event: any): void {
        const file = event.target.files?.[0];
        if (file) {
            this.selectedFile = file;
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
        const payload = {
            file: this.selectedFile || undefined,
            plateNumber: String(raw.plateNumber).trim(),
            plateCode: raw.plateCode ? String(raw.plateCode).trim() : undefined,
            registrationNumber: String(raw.registrationNumber).trim(),
            issueDate: raw.issueDate,
            expiryDate: raw.expiryDate,
            registrationFee: Number(raw.registrationFee),
        };

        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.uploadRegistration(this.data.assetId, payload));
            this._toast.success('Registration uploaded successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload registration');
        } finally {
            this.saving = false;
        }
    }
}
