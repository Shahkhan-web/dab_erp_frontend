import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite, isAdminProfile } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { AssetsService, Asset, AssetType, AssetStatus, AcquisitionType, AssetInventoryImage } from './assets.service';
import {
    canChangeAssetStatusViaDropdown,
    getAssetStatusClass,
    getAssetStatusDropdownOptions,
    getAssetStatusLabel,
    isAssetLinkedButNotAssigned,
} from './asset-status.util';
import { AssetAssignDialogComponent } from './dialogs/asset-assign-dialog.component';
import { AssetReturnDialogComponent } from './dialogs/asset-return-dialog.component';
import { AssetRegistrationDialogComponent } from './dialogs/asset-registration-dialog.component';
import { AssetInsuranceDialogComponent } from './dialogs/asset-insurance-dialog.component';
import { AssetMaintenanceDialogComponent } from './dialogs/asset-maintenance-dialog.component';
import { AssetPhotoDialogComponent } from './dialogs/asset-photo-dialog.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
    selector: 'app-asset-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        MatCardModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatMenuModule,
        MatSelectModule,
        MatTabsModule,
        MatTableModule,
        MatTooltipModule,
        DatePipe,
        CurrencyPipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './asset-detail.component.html',
})
export class AssetDetailComponent implements OnInit {
    private _assetsService = inject(AssetsService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _matDialog = inject(MatDialog);
    private _auth = inject(AuthService);

    assetId: string | null = null;
    asset: Asset | null = null;
    pageLoader = false;
    statusChanging = false;

    // Table Columns
    assignmentColumns: string[] = ['employee', 'assignedAt', 'returnedAt', 'deductFromSalary', 'monthlyCostSnapshot', 'notes'];
    registrationColumns: string[] = ['plate', 'regNumber', 'dates', 'fee', 'document'];
    insuranceColumns: string[] = ['provider', 'policyNumber', 'coverage', 'dates', 'cost', 'document'];
    maintenanceColumns: string[] = ['type', 'date', 'cost', 'odometer', 'workshop', 'description', 'document'];

    get canWriteAsset(): boolean {
        return hasModuleWrite(this._auth.profileData, 'asset');
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    ngOnInit(): void {
        this.assetId = this._route.snapshot.paramMap.get('id');
        if (this.assetId) {
            void this.loadAsset();
        } else {
            this._toast.error('Asset ID not found');
            void this._router.navigate(['/main/assets']);
        }
    }

    async loadAsset(): Promise<void> {
        if (!this.assetId) return;
        this.pageLoader = true;
        try {
            this.asset = await lastValueFrom(this._assetsService.getAsset(this.assetId));
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load asset details');
            void this._router.navigate(['/main/assets']);
        } finally {
            this.pageLoader = false;
        }
    }

    get showsMulkiyaTab(): boolean {
        return this.asset?.type === 'bike' || this.asset?.type === 'cycle';
    }

    get statusDropdownOptions(): { value: AssetStatus; label: string }[] {
        if (!this.asset) return [];
        return getAssetStatusDropdownOptions(this.asset);
    }

    get canChangeStatus(): boolean {
        return !!this.asset && canChangeAssetStatusViaDropdown(this.asset);
    }

    get isLinkedButNotAssigned(): boolean {
        return !!this.asset && isAssetLinkedButNotAssigned(this.asset);
    }

    async onStatusChange(newStatus: AssetStatus): Promise<void> {
        if (!this.assetId || !this.asset || newStatus === this.asset.status || this.statusChanging) {
            return;
        }

        this.statusChanging = true;
        try {
            this.asset = await lastValueFrom(this._assetsService.updateAssetStatus(this.assetId, newStatus));
            this._toast.success(`Status updated to ${getAssetStatusLabel(newStatus)}`);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update asset status');
        } finally {
            this.statusChanging = false;
        }
    }

    openAssignDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetAssignDialogComponent, {
                width: '90vw',
                maxWidth: '520px',
                data: {
                    assetId: this.assetId,
                    companyId: this.asset?.companyId,
                    companyName: this.asset?.companyName ?? this.asset?.company?.name,
                    acquisitionType: this.asset?.acquisitionType,
                    monthlyCost: this.asset?.monthlyCost,
                },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    openReturnDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetReturnDialogComponent, {
                width: '90vw',
                maxWidth: '520px',
                data: { assetId: this.assetId },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    openRegistrationDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetRegistrationDialogComponent, {
                width: '90vw',
                maxWidth: '640px',
                data: { assetId: this.assetId },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    openInsuranceDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetInsuranceDialogComponent, {
                width: '90vw',
                maxWidth: '640px',
                data: { assetId: this.assetId, companyId: this.asset?.companyId },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    openMaintenanceDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetMaintenanceDialogComponent, {
                width: '90vw',
                maxWidth: '640px',
                data: { assetId: this.assetId, companyId: this.asset?.companyId },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    openPhotoDialog(): void {
        if (!this.assetId) return;
        this._matDialog
            .open(AssetPhotoDialogComponent, {
                width: '90vw',
                maxWidth: '520px',
                data: { assetId: this.assetId },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadAsset();
            });
    }

    deletePhoto(image: AssetInventoryImage): void {
        if (!this.assetId) return;
        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: {
                    title: 'Delete Photo',
                    message: `Are you sure you want to delete the photo "${image.displayName}"?`,
                },
            })
            .afterClosed()
            .subscribe(async (confirmed) => {
                if (confirmed) {
                    this.pageLoader = true;
                    try {
                        await lastValueFrom(this._assetsService.deleteImage(this.assetId!, image.id));
                        this._toast.success('Photo deleted successfully');
                        void this.loadAsset();
                    } catch (e: any) {
                        this._toast.error(e?.error?.message || 'Failed to delete photo');
                        this.pageLoader = false;
                    }
                }
            });
    }

    openDocumentUrl(url: string | undefined): void {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    getAssetTypeLabel(type: AssetType | undefined): string {
        if (!type) return '';
        const options = [
            { value: 'cycle', label: 'Cycle' },
            { value: 'bike', label: 'Bike' },
            { value: 'sim_card', label: 'SIM Card' },
            { value: 'other', label: 'Other' },
        ];
        return options.find((o) => o.value === type)?.label ?? type;
    }

    getAssetStatusLabel = getAssetStatusLabel;
    getAssetStatusClass = getAssetStatusClass;

    getAcquisitionTypeLabel(type: AcquisitionType | undefined): string {
        if (!type) return '';
        return type === 'bought' ? 'Bought' : 'Rented';
    }

    getMaintenanceTypeLabel(type: string): string {
        const options = [
            { value: 'routine_service', label: 'Routine Service' },
            { value: 'tyre_replace', label: 'Tyre Replace' },
            { value: 'repair', label: 'Repair' },
            { value: 'accident_repair', label: 'Accident Repair' },
            { value: 'fine_payment', label: 'Fine Payment' },
            { value: 'other', label: 'Other' },
        ];
        return options.find((o) => o.value === type)?.label ?? type;
    }

    getCoverageTypeLabel(type: string): string {
        return type === 'comprehensive' ? 'Comprehensive' : 'Third Party';
    }
}
