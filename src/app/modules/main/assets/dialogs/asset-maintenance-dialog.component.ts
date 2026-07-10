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
import { AssetsService, MaintenanceType } from '../assets.service';

export interface AssetMaintenanceDialogData {
    assetId: string;
    companyId?: string | null;
}

@Component({
    selector: 'app-asset-maintenance-dialog',
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
    templateUrl: './asset-maintenance-dialog.component.html',
})
export class AssetMaintenanceDialogComponent implements OnInit {
    private readonly _destroyRef = inject(DestroyRef);

    form: FormGroup;
    saving = false;
    selectedFile: File | null = null;

    workshops: string[] = [];
    filteredWorkshops: string[] = [];
    workshopsLoading = false;

    maintenanceTypeOptions = [
        { value: 'routine_service', label: 'Routine Service' },
        { value: 'tyre_replace', label: 'Tyre Replace' },
        { value: 'repair', label: 'Repair' },
        { value: 'accident_repair', label: 'Accident Repair' },
        { value: 'fine_payment', label: 'Fine Payment' },
        { value: 'other', label: 'Other' },
    ];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetMaintenanceDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetMaintenanceDialogData
    ) {
        this.form = this._fb.group({
            type: ['routine_service', Validators.required],
            maintenanceDate: ['', Validators.required],
            cost: [0, [Validators.required, Validators.min(0)]],
            odometerReading: [null as number | null, Validators.min(0)],
            workshopName: [''],
            description: [''],
        });

        this.form
            .get('workshopName')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this._refreshFilteredWorkshops());
    }

    ngOnInit(): void {
        this.loadWorkshops();
    }

    private loadWorkshops(): void {
        const currentWorkshop = String(this.form.get('workshopName')?.value ?? '').trim();
        this.workshopsLoading = true;
        this._assetsService
            .getLookupWorkshops(this.data.companyId)
            .pipe(catchError(() => of([] as string[])))
            .subscribe((list) => {
                const merged = [...list];
                if (currentWorkshop && !merged.includes(currentWorkshop)) {
                    merged.push(currentWorkshop);
                }
                merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                this.workshops = merged;
                this.workshopsLoading = false;
                this._refreshFilteredWorkshops();
            });
    }

    private _refreshFilteredWorkshops(): void {
        const raw = this.form.get('workshopName')?.value;
        const query = typeof raw === 'string' ? raw : '';
        const q = query.trim().toLowerCase();
        if (!q) {
            this.filteredWorkshops = [...this.workshops];
            return;
        }
        this.filteredWorkshops = this.workshops.filter((workshop) => workshop.toLowerCase().includes(q));
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
            type: raw.type as MaintenanceType,
            maintenanceDate: raw.maintenanceDate,
            cost: Number(raw.cost),
            odometerReading: raw.odometerReading != null ? Number(raw.odometerReading) : undefined,
            workshopName: raw.workshopName ? String(raw.workshopName).trim() : undefined,
            description: raw.description ? String(raw.description).trim() : undefined,
        };

        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.uploadMaintenance(this.data.assetId, payload));
            this._toast.success('Maintenance event logged successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to log maintenance event');
        } finally {
            this.saving = false;
        }
    }
}
