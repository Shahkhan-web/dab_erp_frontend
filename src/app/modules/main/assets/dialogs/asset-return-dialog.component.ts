import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AssetsService } from '../assets.service';

export interface AssetReturnDialogData {
    assetId: string;
}

@Component({
    selector: 'app-asset-return-dialog',
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
    templateUrl: './asset-return-dialog.component.html',
})
export class AssetReturnDialogComponent implements OnInit {
    form: FormGroup;
    saving = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetReturnDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetReturnDialogData
    ) {
        this.form = this._fb.group({
            returnedAt: [''],
            returnNotes: [''],
        });
    }

    ngOnInit(): void {}

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
            returnedAt: raw.returnedAt ? raw.returnedAt : undefined,
            returnNotes: raw.returnNotes ? String(raw.returnNotes).trim() : undefined,
        };

        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.returnAsset(this.data.assetId, payload));
            this._toast.success('Asset returned to inventory successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to return asset');
        } finally {
            this.saving = false;
        }
    }
}
