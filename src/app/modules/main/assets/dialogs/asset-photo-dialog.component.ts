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

export interface AssetPhotoDialogData {
    assetId: string;
}

@Component({
    selector: 'app-asset-photo-dialog',
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
    templateUrl: './asset-photo-dialog.component.html',
})
export class AssetPhotoDialogComponent implements OnInit {
    form: FormGroup;
    saving = false;
    selectedFile: File | null = null;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetPhotoDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetPhotoDialogData
    ) {
        this.form = this._fb.group({
            displayName: ['', Validators.required],
        });
    }

    ngOnInit(): void {}

    onFileSelected(event: any): void {
        const file = event.target.files?.[0];
        if (file) {
            this.selectedFile = file;
            if (!this.form.get('displayName')?.value) {
                // Pre-populate with file name without extension
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                this.form.patchValue({ displayName: nameWithoutExt });
            }
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
        if (!this.selectedFile) {
            this._toast.error('Please select an image file to upload');
            return;
        }

        const raw = this.form.getRawValue();
        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.uploadImage(this.data.assetId, this.selectedFile, String(raw.displayName).trim()));
            this._toast.success('Inventory photo uploaded successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload photo');
        } finally {
            this.saving = false;
        }
    }
}
