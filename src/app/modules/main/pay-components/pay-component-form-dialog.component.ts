import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { PayComponentsService } from './pay-components.service';

export interface PayComponentFormDialogData {
    id?: string;
}

@Component({
    selector: 'app-pay-component-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './pay-component-form-dialog.component.html',
})
export class PayComponentFormDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;
    saving = false;
    isEdit = false;

    typeOptions = [
        { value: 'earning', label: 'Earning' },
        { value: 'deduction', label: 'Deduction' },
    ];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<PayComponentFormDialogComponent, boolean>,
        private _service: PayComponentsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: PayComponentFormDialogData
    ) {
        this.isEdit = !!data?.id;
        this.form = this._fb.group({
            name: ['', Validators.required],
            type: ['earning', Validators.required],
            isActive: [true],
        });
    }

    async ngOnInit(): Promise<void> {
        if (!this.data?.id) return;
        this.loading = true;
        try {
            const row = await lastValueFrom(this._service.getPayComponent(this.data.id));
            this.form.patchValue({
                name: row.name,
                type: row.type,
                isActive: row.isActive,
            });
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load pay component');
            this._dialogRef.close(false);
        } finally {
            this.loading = false;
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
        const payload = this.form.getRawValue() as { name: string; type: string; isActive: boolean };
        this.saving = true;
        try {
            if (this.isEdit && this.data.id) {
                await lastValueFrom(this._service.updatePayComponent(this.data.id, payload));
                this._toast.success('Pay component updated');
            } else {
                await lastValueFrom(this._service.createPayComponent(payload));
                this._toast.success('Pay component created');
            }
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Save failed');
        } finally {
            this.saving = false;
        }
    }
}
