import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { CompaniesService, Company } from '../../../companies/companies.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { AuthService } from 'app/core/auth/auth.service';
import { PARTY_TYPES, PartiesService, Party, PartyType } from '../../services/parties.service';

export interface PartyFormDialogData {
    id?: string;
}

@Component({
    selector: 'app-party-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './party-form-dialog.component.html',
})
export class PartyFormDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;
    saving = false;
    isEdit = false;
    companies: Company[] = [];
    readonly partyTypes = PARTY_TYPES;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<PartyFormDialogComponent, boolean>,
        private _partiesService: PartiesService,
        private _companiesService: CompaniesService,
        private _auth: AuthService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: PartyFormDialogData
    ) {
        this.isEdit = !!data?.id;
        this.form = this._fb.group({
            name: ['', Validators.required],
            type: ['customer' as PartyType, Validators.required],
            companyId: [null as string | null],
            email: [''],
            phone: [''],
            trn: [''],
            address: [''],
            notes: [''],
        });
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    async ngOnInit(): Promise<void> {
        if (this.isAdmin) {
            try {
                this.companies = await lastValueFrom(this._companiesService.getList());
            } catch {
                this.companies = [];
            }
        }
        if (!this.data?.id) return;
        this.loading = true;
        try {
            const row = await lastValueFrom(this._partiesService.getParty(this.data.id));
            this.form.patchValue({
                name: row.name,
                type: row.type,
                companyId: row.companyId ?? null,
                email: row.email ?? '',
                phone: row.phone ?? '',
                trn: row.trn ?? '',
                address: row.address ?? '',
                notes: row.notes ?? '',
            });
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load party');
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
        const raw = this.form.getRawValue();
        const payload = {
            name: raw.name,
            type: raw.type,
            companyId: raw.companyId || null,
            email: raw.email?.trim() || null,
            phone: raw.phone?.trim() || null,
            trn: raw.trn?.trim() || null,
            address: raw.address?.trim() || null,
            notes: raw.notes?.trim() || null,
        };
        this.saving = true;
        try {
            if (this.isEdit && this.data.id) {
                await lastValueFrom(this._partiesService.updateParty(this.data.id, payload));
                this._toast.success('Party updated');
            } else {
                await lastValueFrom(this._partiesService.createParty(payload));
                this._toast.success('Party created');
            }
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Save failed');
        } finally {
            this.saving = false;
        }
    }
}
