import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { CompaniesService } from '../companies.service';

@Component({
    selector: 'app-company-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './company-form-dialog.component.html',
})
export class CompanyFormDialogComponent {
    form = this._fb.group({
        name: ['', [Validators.required, Validators.maxLength(200)]],
        employeeIdPrefix: [
            '',
            [Validators.required, Validators.minLength(1), Validators.maxLength(32), Validators.pattern(/^[A-Za-z0-9-]+$/)]
        ],
    });
    loading = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<CompanyFormDialogComponent>,
        private _companiesService: CompaniesService,
        private _toast: ToastrService
    ) {}

    cancel(): void {
        this._dialogRef.close(false);
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        this.loading = true;
        try {
            await lastValueFrom(
                this._companiesService.create({
                    name: v.name.trim(),
                    employeeIdPrefix: v.employeeIdPrefix.trim().toUpperCase(),
                })
            );
            this._toast.success('Company created');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to create company');
        } finally {
            this.loading = false;
        }
    }
}
