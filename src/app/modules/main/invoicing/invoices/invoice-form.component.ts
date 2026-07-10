import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
    FormArray,
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocomplete, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { CompaniesService, Company } from '../../companies/companies.service';
import { Party, PartiesService } from '../services/parties.service';
import {
    INVOICE_CREATE_STATUSES,
    InvoiceDetail,
    InvoiceDirection,
    InvoicesService,
    canEditInvoiceField,
    computeInvoicePreview,
    computeLinePreview,
    invoiceDirectionLabel,
    InvoiceEditableField,
    isInvoiceVoid,
} from '../services/invoices.service';
import { PartyAutocompleteSearch } from '../shared/party-autocomplete-search';

@Component({
    selector: 'app-invoice-form',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatIconModule,
        MatProgressSpinnerModule,
        CurrencyPipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './invoice-form.component.html',
})
export class InvoiceFormComponent implements OnInit, OnDestroy {
    private _fb = inject(FormBuilder);
    private _invoicesService = inject(InvoicesService);
    private _partiesService = inject(PartiesService);
    private _companiesService = inject(CompaniesService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _auth = inject(AuthService);

    direction: InvoiceDirection = 'receivable';
    invoiceId: string | null = null;
    isEdit = false;
    pageLoader = false;
    saving = false;
    invoice: InvoiceDetail | null = null;
    companies: Company[] = [];
    partyFilter: Party | string | null = null;

    form: FormGroup;
    lines: FormArray<FormGroup>;
    readonly createStatuses = INVOICE_CREATE_STATUSES;
    readonly partySearch: PartyAutocompleteSearch;

    constructor() {
        this.partySearch = new PartyAutocompleteSearch(this._partiesService);
        this.lines = this._fb.array<FormGroup>([]);
        this.form = this._fb.group({
            companyId: ['', Validators.required],
            invoiceNumber: [''],
            issueDate: [new Date(), Validators.required],
            dueDate: [new Date(), Validators.required],
            status: ['draft'],
            currency: ['AED', Validators.required],
            notes: [''],
            terms: [''],
        });
    }

    get entityLabel(): string {
        return invoiceDirectionLabel(this.direction);
    }

    get listBasePath(): string {
        return this.direction === 'payable' ? '/main/invoicing/bills' : '/main/invoicing/invoices';
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    get previewTotals() {
        const lineValues = this.lines.controls.map((c) => ({
            description: c.get('description')?.value ?? '',
            quantity: Number(c.get('quantity')?.value) || 0,
            unitPrice: Number(c.get('unitPrice')?.value) || 0,
            taxRatePct: Number(c.get('taxRatePct')?.value) || 0,
        }));
        return computeInvoicePreview(lineValues);
    }

    get currency(): string {
        return this.form.get('currency')?.value || 'AED';
    }

    ngOnInit(): void {
        this.direction = (this._route.snapshot.data['direction'] as InvoiceDirection) ?? 'receivable';
        const partyType = this.direction === 'payable' ? 'vendor' : 'customer';
        this.partySearch.setTypeFilter(partyType);
        this.invoiceId = this._route.snapshot.paramMap.get('id');
        this.isEdit = !!this.invoiceId;
        if (this.isAdmin) {
            void this._loadCompanies();
        } else {
            const profileCompanyId = this._auth.profileData?.company?.id ?? null;
            if (profileCompanyId) {
                this.form.patchValue({ companyId: profileCompanyId });
                this.partySearch.setCompanyId(profileCompanyId);
            }
        }
        if (this.isEdit && this.invoiceId) {
            void this._loadInvoice();
        } else {
            this.addLineRow();
        }
        this.form.get('companyId')?.valueChanges.subscribe((companyId) => {
            this.partySearch.setCompanyId(companyId);
        });
    }

    ngOnDestroy(): void {
        this.partySearch.unbindPanelScroll();
    }

    canEditField(field: Parameters<typeof canEditInvoiceField>[1]): boolean {
        if (!this.isEdit) return true;
        return canEditInvoiceField(this.invoice, field);
    }

    linePreview(index: number): { lineSubtotal: number; lineTax: number; lineTotal: number } {
        const g = this.lines.at(index);
        return computeLinePreview({
            description: g.get('description')?.value ?? '',
            quantity: Number(g.get('quantity')?.value) || 0,
            unitPrice: Number(g.get('unitPrice')?.value) || 0,
            taxRatePct: Number(g.get('taxRatePct')?.value) || 0,
        });
    }

    private async _loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch {
            this.companies = [];
        }
    }

    private async _loadInvoice(): Promise<void> {
        if (!this.invoiceId) return;
        this.pageLoader = true;
        try {
            const inv = await lastValueFrom(this._invoicesService.getInvoice(this.invoiceId));
            if (isInvoiceVoid(inv)) {
                this._toast.warning('Void invoices cannot be edited');
                void this._router.navigate([this.listBasePath, inv.id]);
                return;
            }
            this.invoice = inv;
            this.direction = inv.direction;
            this.form.patchValue({
                companyId: inv.companyId,
                invoiceNumber: inv.invoiceNumber ?? '',
                issueDate: new Date(inv.issueDate),
                dueDate: new Date(inv.dueDate),
                currency: inv.currency ?? 'AED',
                notes: inv.notes ?? '',
                terms: inv.terms ?? '',
            });
            if (inv.party) {
                this.partyFilter = inv.party;
                this.partySearch.ensureInList(inv.party);
            } else if (inv.partyId) {
                try {
                    const party = await lastValueFrom(this._partiesService.getParty(inv.partyId));
                    this.partyFilter = party;
                    this.partySearch.ensureInList(party);
                } catch {
                    /* ignore */
                }
            }
            this.partySearch.setCompanyId(inv.companyId);
            this._setLines(inv.lines ?? []);
            this._applyFieldLocks();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load invoice');
            void this._router.navigate([this.listBasePath]);
        } finally {
            this.pageLoader = false;
        }
    }

    private _applyFieldLocks(): void {
        if (!this.invoice) return;
        this.form.get('companyId')?.disable({ emitEvent: false });
        const fields: InvoiceEditableField[] = ['invoiceNumber', 'issueDate', 'currency'];
        for (const f of fields) {
            if (!this.canEditField(f)) {
                this.form.get(f)?.disable({ emitEvent: false });
            }
        }
        if (!this.canEditField('lines')) {
            this.lines.disable({ emitEvent: false });
        }
        if (!this.canEditField('notes')) this.form.get('notes')?.disable({ emitEvent: false });
        if (!this.canEditField('terms')) this.form.get('terms')?.disable({ emitEvent: false });
        if (!this.canEditField('dueDate')) this.form.get('dueDate')?.disable({ emitEvent: false });
    }

    private _lineGroup(): FormGroup {
        return this._fb.group({
            description: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(0.001)]],
            unitPrice: [0, [Validators.required, Validators.min(0)]],
            taxRatePct: [5, [Validators.required, Validators.min(0)]],
        });
    }

    private _setLines(items: Array<{ description: string; quantity: number; unitPrice: number; taxRatePct: number }>): void {
        this.lines.clear();
        if (!items.length) {
            this.addLineRow();
            return;
        }
        items.forEach((row) => {
            const g = this._lineGroup();
            g.patchValue(row);
            this.lines.push(g);
        });
    }

    addLineRow(): void {
        this.lines.push(this._lineGroup());
    }

    removeLineRow(index: number): void {
        if (this.lines.length <= 1) return;
        this.lines.removeAt(index);
    }

    partyDisplayValue(party: Party | string | null): string {
        if (!party) return '';
        if (typeof party === 'string') return party;
        return party.name;
    }

    onPartyInput(value: string): void {
        if (typeof this.partyFilter !== 'string' && this.partyFilter) return;
        this.partyFilter = value;
        void this.partySearch.resetAndLoad(value);
    }

    onPartySelected(party: Party): void {
        this.partyFilter = party;
        this.partySearch.ensureInList(party);
    }

    onPartyPanelOpened(autocomplete: MatAutocomplete): void {
        const q = typeof this.partyFilter === 'string' ? this.partyFilter : this.partyFilter?.name ?? '';
        void this.partySearch.resetAndLoad(q);
        this.partySearch.bindPanelScroll(autocomplete);
    }

    onPartyPanelClosed(): void {
        this.partySearch.unbindPanelScroll();
    }

    cancel(): void {
        if (this.isEdit && this.invoiceId) {
            void this._router.navigate([this.listBasePath, this.invoiceId]);
        } else {
            void this._router.navigate([this.listBasePath]);
        }
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.lines.controls.forEach((c) => c.markAllAsTouched());
            return;
        }
        const party = typeof this.partyFilter === 'string' ? null : this.partyFilter;
        if (!party?.id && this.canEditField('partyId')) {
            this._toast.error('Select a party');
            return;
        }
        if (this.lines.invalid) {
            this.lines.controls.forEach((c) => c.markAllAsTouched());
            this._toast.error('Complete all line items');
            return;
        }
        const raw = this.form.getRawValue();
        const linesPayload = this.lines.getRawValue().map((r: any) => ({
            description: String(r.description).trim(),
            quantity: Number(r.quantity),
            unitPrice: Number(r.unitPrice),
            taxRatePct: Number(r.taxRatePct),
        }));

        this.saving = true;
        try {
            if (this.isEdit && this.invoiceId) {
                const payload: Record<string, unknown> = {};
                if (this.canEditField('partyId')) payload['partyId'] = party!.id;
                if (this.canEditField('invoiceNumber')) payload['invoiceNumber'] = raw.invoiceNumber?.trim() || null;
                if (this.canEditField('issueDate')) payload['issueDate'] = this._formatDate(raw.issueDate);
                if (this.canEditField('dueDate')) payload['dueDate'] = this._formatDate(raw.dueDate);
                if (this.canEditField('currency')) payload['currency'] = raw.currency;
                if (this.canEditField('lines')) payload['lines'] = linesPayload;
                if (this.canEditField('notes')) payload['notes'] = raw.notes?.trim() || null;
                if (this.canEditField('terms')) payload['terms'] = raw.terms?.trim() || null;
                const updated = await lastValueFrom(
                    this._invoicesService.updateInvoice(this.invoiceId, payload as any)
                );
                this._toast.success(`${this.entityLabel} updated`);
                void this._router.navigate([this.listBasePath, updated.id]);
            } else {
                const created = await lastValueFrom(
                    this._invoicesService.createInvoice({
                        direction: this.direction,
                        companyId: raw.companyId,
                        partyId: party!.id,
                        invoiceNumber: raw.invoiceNumber?.trim() || null,
                        issueDate: this._formatDate(raw.issueDate)!,
                        dueDate: this._formatDate(raw.dueDate)!,
                        status: raw.status,
                        currency: raw.currency,
                        lines: linesPayload,
                        notes: raw.notes?.trim() || null,
                        terms: raw.terms?.trim() || null,
                    })
                );
                this._toast.success(`${this.entityLabel} created`);
                void this._router.navigate([this.listBasePath, created.id]);
            }
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
