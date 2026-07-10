import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { CompaniesService, Company } from '../../../companies/companies.service';
import {
    LEDGER_CATEGORIES,
    LEDGER_ENTRY_TYPES,
    LedgerEntry,
    LedgerEntryType,
    LedgerService,
    ledgerCategoryLabel,
} from '../../services/ledger.service';

export interface LedgerEntryFormDialogData {
    entry?: LedgerEntry;
    defaultCompanyId?: string | null;
}

@Component({
    selector: 'app-ledger-entry-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './ledger-entry-form-dialog.component.html',
})
export class LedgerEntryFormDialogComponent implements OnInit {
    form: FormGroup;
    saving = false;
    isEdit = false;
    companies: Company[] = [];

    readonly entryTypes = LEDGER_ENTRY_TYPES;
    readonly categories = LEDGER_CATEGORIES;
    readonly ledgerCategoryLabel = ledgerCategoryLabel;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<LedgerEntryFormDialogComponent, boolean>,
        private _ledgerService: LedgerService,
        private _companiesService: CompaniesService,
        private _auth: AuthService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: LedgerEntryFormDialogData
    ) {
        this.isEdit = !!data?.entry;
        this.form = this._fb.group({
            companyId: [data?.defaultCompanyId ?? '', Validators.required],
            entryDate: [new Date(), Validators.required],
            entryType: ['credit' as LedgerEntryType, Validators.required],
            amount: [0, [Validators.required, Validators.min(0.01)]],
            category: ['other', Validators.required],
            description: [''],
            reference: [''],
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
        } else if (!this.isEdit) {
            const profileCompanyId = this._auth.profileData?.company?.id ?? null;
            if (profileCompanyId) {
                this.form.patchValue({ companyId: profileCompanyId });
            }
        }
        if (this.data?.entry) {
            const e = this.data.entry;
            this.form.patchValue({
                companyId: e.companyId,
                entryDate: new Date(e.entryDate),
                entryType: e.entryType,
                amount: e.amount,
                category: e.category,
                description: e.description ?? '',
                reference: e.reference ?? '',
            });
            this.form.get('companyId')?.disable({ emitEvent: false });
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
        this.saving = true;
        try {
            if (this.isEdit && this.data.entry) {
                await lastValueFrom(
                    this._ledgerService.updateEntry(this.data.entry.id, {
                        entryDate: this._formatDate(raw.entryDate)!,
                        entryType: raw.entryType,
                        amount: Number(raw.amount),
                        category: raw.category,
                        description: raw.description?.trim() || null,
                        reference: raw.reference?.trim() || null,
                    })
                );
                this._toast.success('Entry updated');
            } else {
                await lastValueFrom(
                    this._ledgerService.createEntry({
                        companyId: raw.companyId,
                        entryDate: this._formatDate(raw.entryDate)!,
                        entryType: raw.entryType,
                        amount: Number(raw.amount),
                        category: raw.category,
                        description: raw.description?.trim() || null,
                        reference: raw.reference?.trim() || null,
                    })
                );
                this._toast.success('Entry created');
            }
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Save failed');
        } finally {
            this.saving = false;
        }
    }

    private _formatDate(d: Date | string | null): string | null {
        if (!d) return null;
        const date = d instanceof Date ? d : new Date(d);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
