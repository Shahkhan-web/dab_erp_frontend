import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { catchError, lastValueFrom, of } from 'rxjs';
import { AssetsService, InsuranceCoverageType } from '../assets.service';

export interface AssetInsuranceDialogData {
    assetId: string;
    companyId?: string | null;
}

@Component({
    selector: 'app-asset-insurance-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatAutocompleteModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './asset-insurance-dialog.component.html',
})
export class AssetInsuranceDialogComponent implements OnInit {
    private readonly _destroyRef = inject(DestroyRef);

    form: FormGroup;
    saving = false;
    selectedFile: File | null = null;

    insuranceProviders: string[] = [];
    filteredInsuranceProviders: string[] = [];
    insuranceProvidersLoading = false;

    coverageTypeOptions = [
        { value: 'comprehensive', label: 'Comprehensive' },
        { value: 'third_party', label: 'Third Party' },
    ];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetInsuranceDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetInsuranceDialogData
    ) {
        this.form = this._fb.group({
            providerName: ['', Validators.required],
            policyNumber: ['', Validators.required],
            coverageType: ['comprehensive', Validators.required],
            startDate: ['', Validators.required],
            expiryDate: ['', Validators.required],
            premiumCost: [0, [Validators.required, Validators.min(0)]],
        });

        this.form
            .get('providerName')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this._refreshFilteredInsuranceProviders());
    }

    ngOnInit(): void {
        this.loadInsuranceProviders();
    }

    private loadInsuranceProviders(): void {
        const currentProvider = String(this.form.get('providerName')?.value ?? '').trim();
        this.insuranceProvidersLoading = true;
        this._assetsService
            .getLookupInsuranceProviders(this.data.companyId)
            .pipe(catchError(() => of([] as string[])))
            .subscribe((list) => {
                const merged = [...list];
                if (currentProvider && !merged.includes(currentProvider)) {
                    merged.push(currentProvider);
                }
                merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                this.insuranceProviders = merged;
                this.insuranceProvidersLoading = false;
                this._refreshFilteredInsuranceProviders();
            });
    }

    private _refreshFilteredInsuranceProviders(): void {
        const raw = this.form.get('providerName')?.value;
        const query = typeof raw === 'string' ? raw : '';
        const q = query.trim().toLowerCase();
        if (!q) {
            this.filteredInsuranceProviders = [...this.insuranceProviders];
            return;
        }
        this.filteredInsuranceProviders = this.insuranceProviders.filter((provider) =>
            provider.toLowerCase().includes(q)
        );
    }

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
            providerName: String(raw.providerName).trim(),
            policyNumber: String(raw.policyNumber).trim(),
            coverageType: raw.coverageType as InsuranceCoverageType,
            startDate: raw.startDate,
            expiryDate: raw.expiryDate,
            premiumCost: Number(raw.premiumCost),
        };

        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.uploadInsurance(this.data.assetId, payload));
            this._toast.success('Insurance policy uploaded successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload insurance policy');
        } finally {
            this.saving = false;
        }
    }
}
