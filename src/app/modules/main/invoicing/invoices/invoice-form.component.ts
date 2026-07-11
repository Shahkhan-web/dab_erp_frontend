import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    FormArray,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
    MatAutocomplete,
    MatAutocompleteModule,
    MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
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
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
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
import { InvoiceAttachmentPickerComponent } from '../shared/invoice-attachment-picker.component';

@Component({
    selector: 'app-invoice-form',
    standalone: true,
    imports: [
        CommonModule,
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
        InvoiceAttachmentPickerComponent,
    ],
    templateUrl: './invoice-form.component.html',
})
export class InvoiceFormComponent implements OnInit, OnDestroy {
    @ViewChild('attachmentPicker') attachmentPicker?: InvoiceAttachmentPickerComponent;

    private _destroyRef = inject(DestroyRef);
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

    form: FormGroup;
    lines: FormArray<FormGroup>;
    readonly createStatuses = INVOICE_CREATE_STATUSES;
    readonly partySearch: PartyAutocompleteSearch;
    private _suppressNextPartyPanelOpen = false;
    private readonly _partySearchApply = createDebouncedFilterApply(() => {
        void this._schedulePartySearch();
    });

    displayParty = (value: Party | string | null): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return value.name;
    };

    constructor() {
        this.partySearch = new PartyAutocompleteSearch(this._partiesService);
        this.lines = this._fb.array<FormGroup>([]);
        this.form = this._fb.group({
            companyId: ['', Validators.required],
            party: [null as Party | string | null],
            invoiceNumber: [''],
            issueDate: [new Date(), Validators.required],
            dueDate: [new Date(), Validators.required],
            status: ['draft'],
            currency: ['AED', Validators.required],
            notes: [''],
            terms: [''],
        });

        this.form
            .get('party')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((value) => {
                if (value && typeof value === 'object' && (value as Party).id) return;
                if (value && typeof value === 'object') return;
                this._partySearchApply.schedule();
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
        this.form
            .get('companyId')!
            .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((companyId) => {
                this.partySearch.setCompanyId(companyId);
                this.form.patchValue({ party: null }, { emitEvent: false });
                this.partySearch.resetAndLoad('', true);
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
            this.form.patchValue(
                {
                    companyId: inv.companyId,
                    invoiceNumber: inv.invoiceNumber ?? '',
                    issueDate: new Date(inv.issueDate),
                    dueDate: new Date(inv.dueDate),
                    currency: inv.currency ?? 'AED',
                    notes: inv.notes ?? '',
                    terms: inv.terms ?? '',
                },
                { emitEvent: false }
            );
            if (inv.party) {
                this.form.patchValue({ party: inv.party }, { emitEvent: false });
                this.partySearch.ensureInList(inv.party);
            } else if (inv.partyId) {
                try {
                    const party = await lastValueFrom(this._partiesService.getParty(inv.partyId));
                    this.form.patchValue({ party }, { emitEvent: false });
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
        if (!this.canEditField('partyId')) this.form.get('party')?.disable({ emitEvent: false });
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

    private _partySearchQuery(): string {
        const value = this.form.get('party')!.value;
        return typeof value === 'string' ? value.trim() : '';
    }

    private async _schedulePartySearch(): Promise<void> {
        await this.partySearch.resetAndLoad(this._partySearchQuery());
    }

    onPartyOptionSelected(party: Party): void {
        this.partySearch.ensureInList(party);
        this._suppressNextPartyPanelOpen = true;
    }

    openPartyPanel(trigger: MatAutocompleteTrigger): void {
        if (this._suppressNextPartyPanelOpen) {
            this._suppressNextPartyPanelOpen = false;
            return;
        }
        void this.partySearch.resetAndLoad(this._partySearchQuery()).then(() => {
            setTimeout(() => {
                trigger.updatePosition();
                trigger.openPanel();
            });
        });
    }

    onPartyPanelOpened(autocomplete: MatAutocomplete): void {
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
        const partyValue = this.form.get('party')!.value;
        const party = partyValue && typeof partyValue === 'object' ? (partyValue as Party) : null;
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

        const picker = this.attachmentPicker;
        if (!this.isEdit && picker?.hasPending && !picker.pendingReady()) {
            this._toast.error('Enter a display name for each attachment');
            return;
        }

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
                const createPayload = {
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
                };
                const picker = this.attachmentPicker;
                const hasAttachments = !!picker?.hasPending;
                const created = await lastValueFrom(
                    hasAttachments
                        ? this._invoicesService.createInvoiceWithAttachments(
                              createPayload,
                              picker!.getFiles(),
                              picker!.getDisplayNames()
                          )
                        : this._invoicesService.createInvoice(createPayload)
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
