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
import { AssetsService, Asset, AssetType, AcquisitionType } from '../assets.service';
import { CompaniesService, Company } from '../../companies/companies.service';

export interface AssetFormDialogData {
    id?: string;
}

@Component({
    selector: 'app-asset-form-dialog',
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
    templateUrl: './asset-form-dialog.component.html',
})
export class AssetFormDialogComponent implements OnInit {
    private readonly _destroyRef = inject(DestroyRef);

    form: FormGroup;
    loading = false;
    saving = false;
    isEdit = false;

    companies: Company[] = [];
    assetNames: string[] = [];
    filteredAssetNames: string[] = [];
    assetNamesLoading = false;
    hasActiveAssignment = false;
    companyName = '';
    private _editCompanyId: string | null = null;

    private _hasActiveAssignment(asset: Asset): boolean {
        const record = asset as Asset & Record<string, unknown>;
        if (typeof record['assignedToEmployeeId'] === 'string' && record['assignedToEmployeeId'].trim()) {
            return true;
        }
        if (asset.assignedToEmployee && typeof asset.assignedToEmployee === 'object') {
            return true;
        }
        if (asset.currentAssignment && !asset.currentAssignment.returnedAt) {
            return true;
        }
        return !!asset.assignments?.some((assignment) => !assignment.returnedAt);
    }

    typeOptions = [
        { value: 'cycle', label: 'Cycle' },
        { value: 'bike', label: 'Bike' },
        { value: 'sim_card', label: 'SIM Card' },
        { value: 'other', label: 'Other' },
    ];

    acquisitionTypeOptions = [
        { value: 'bought', label: 'Bought' },
        { value: 'rented', label: 'Rented' },
    ];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetFormDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _companiesService: CompaniesService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetFormDialogData
    ) {
        this.isEdit = !!data?.id;
        this.form = this._fb.group({
            companyId: ['', Validators.required],
            type: ['cycle', Validators.required],
            name: ['', Validators.required],
            serialNumber: ['', Validators.required],
            acquisitionType: ['bought', Validators.required],
            purchasePrice: [null as number | null, Validators.min(0)],
            monthlyCost: [0, [Validators.min(0)]],
            acquisitionDate: ['', Validators.required],
        });

        this.form
            .get('companyId')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this.loadAssetNames());

        this.form
            .get('name')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this._refreshFilteredAssetNames());

        this.form
            .get('acquisitionType')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((value) => this._applyAcquisitionValidators(value as AcquisitionType));
    }

    async ngOnInit(): Promise<void> {
        this.loading = true;
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
            if (this.isEdit && this.data.id) {
                const asset = await lastValueFrom(this._assetsService.getAsset(this.data.id));
                this.hasActiveAssignment = this._hasActiveAssignment(asset);
                this._editCompanyId = asset.companyId;
                this.companyName =
                    asset.companyName ||
                    this.companies.find((c) => c.id === asset.companyId)?.name ||
                    '—';
                this.form.removeControl('companyId');
                this.form.patchValue({
                    type: asset.type,
                    name: asset.name,
                    serialNumber: asset.serialNumber,
                    acquisitionType: asset.acquisitionType,
                    purchasePrice: asset.purchasePrice,
                    monthlyCost: asset.monthlyCost,
                    acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.split('T')[0] : '',
                });
                if (this.hasActiveAssignment) {
                    this.form.get('type')!.disable({ emitEvent: false });
                    this.form.get('acquisitionType')!.disable({ emitEvent: false });
                }
            }
            this._applyAcquisitionValidators(this.form.get('acquisitionType')!.value as AcquisitionType);
            this.loadAssetNames();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load initial data');
            this._dialogRef.close(false);
        } finally {
            this.loading = false;
        }
    }

    private loadAssetNames(): void {
        const companyId = this.isEdit
            ? this._editCompanyId
            : ((this.form.get('companyId')?.value as string | null) ?? null);
        const currentName = String(this.form.get('name')?.value ?? '').trim();
        this.assetNamesLoading = true;
        this._assetsService
            .getLookupNames(companyId)
            .pipe(catchError(() => of([] as string[])))
            .subscribe((list) => {
                const merged = [...list];
                if (currentName && !merged.includes(currentName)) {
                    merged.push(currentName);
                }
                merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                this.assetNames = merged;
                this.assetNamesLoading = false;
                this._refreshFilteredAssetNames();
            });
    }

    private _refreshFilteredAssetNames(): void {
        const raw = this.form.get('name')?.value;
        const query = typeof raw === 'string' ? raw : '';
        const q = query.trim().toLowerCase();
        if (!q) {
            this.filteredAssetNames = [...this.assetNames];
            return;
        }
        this.filteredAssetNames = this.assetNames.filter((name) => name.toLowerCase().includes(q));
    }

    get serialNumberLabel(): string {
        const type = this.form.get('type')?.value as AssetType;
        switch (type) {
            case 'sim_card':
                return 'Phone Number';
            case 'bike':
                return 'Plate/Chassis Number';
            case 'cycle':
                return 'Frame/Serial Number';
            default:
                return 'Serial Number';
        }
    }

    get purchasePriceLabel(): string {
        const acquisitionType = this.form.get('acquisitionType')?.value as AcquisitionType;
        return acquisitionType === 'bought' ? 'Purchase Price' : 'Purchase Price (Optional)';
    }

    get monthlyCostLabel(): string {
        const acquisitionType = this.form.get('acquisitionType')?.value as AcquisitionType;
        return acquisitionType === 'rented' ? 'Monthly Cost' : 'Monthly Cost (Optional)';
    }

    private _applyAcquisitionValidators(acquisitionType: AcquisitionType): void {
        const purchasePriceCtrl = this.form.get('purchasePrice')!;
        const monthlyCostCtrl = this.form.get('monthlyCost')!;
        if (acquisitionType === 'bought') {
            purchasePriceCtrl.setValidators([Validators.required, Validators.min(0.01)]);
            monthlyCostCtrl.setValidators([Validators.min(0)]);
        } else {
            purchasePriceCtrl.setValidators([Validators.min(0)]);
            monthlyCostCtrl.setValidators([Validators.required, Validators.min(0.01)]);
        }
        purchasePriceCtrl.updateValueAndValidity({ emitEvent: false });
        monthlyCostCtrl.updateValueAndValidity({ emitEvent: false });
    }

    get serialNumberPlaceholder(): string {
        const type = this.form.get('type')?.value as AssetType;
        switch (type) {
            case 'sim_card':
                return 'e.g. +971501234567';
            case 'bike':
                return 'e.g. DXB-12345';
            case 'cycle':
                return 'e.g. CYC-98765';
            default:
                return 'e.g. SN-123456';
        }
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    private _buildUpdatePayload(raw: ReturnType<typeof this.form.getRawValue>): Partial<Asset> {
        const payload: Partial<Asset> = {
            name: raw.name,
            serialNumber: raw.serialNumber,
            monthlyCost: raw.monthlyCost,
            acquisitionDate: raw.acquisitionDate,
        };

        if (!this.hasActiveAssignment) {
            payload.type = raw.type;
            payload.acquisitionType = raw.acquisitionType;
        }

        if (raw.purchasePrice != null) {
            payload.purchasePrice = raw.purchasePrice;
        }

        return payload;
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const payload = this.isEdit ? this._buildUpdatePayload(raw) : ({ ...raw } as Partial<Asset>);
        this.saving = true;
        try {
            if (this.isEdit && this.data.id) {
                await lastValueFrom(this._assetsService.updateAsset(this.data.id, payload));
                this._toast.success('Asset updated successfully');
            } else {
                await lastValueFrom(this._assetsService.createAsset(payload as Partial<Asset>));
                this._toast.success('Asset registered successfully');
            }
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Save failed');
        } finally {
            this.saving = false;
        }
    }
}
