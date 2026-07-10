import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite, isAdminProfile } from 'app/core/auth/module-access.util';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { CompaniesService, Company } from '../../companies/companies.service';
import { Party } from '../services/parties.service';
import {
    INVOICE_STATUSES,
    InvoiceDirection,
    InvoiceListItem,
    InvoicesService,
    invoiceDirectionLabel,
    invoiceDirectionPlural,
    invoiceStatusChipClass,
    invoiceStatusLabel,
} from '../services/invoices.service';
import { PartyAutocompleteSearch } from '../shared/party-autocomplete-search';
import { PartiesService } from '../services/parties.service';

@Component({
    selector: 'app-invoices-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatTooltipModule,
        DatePipe,
        CurrencyPipe,
        OverlayLoaderDirective,
    ],
    templateUrl: './invoices-list.component.html',
})
export class InvoicesListComponent implements OnInit, OnDestroy {
    private _invoicesService = inject(InvoicesService);
    private _partiesService = inject(PartiesService);
    private _companiesService = inject(CompaniesService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _auth = inject(AuthService);

    direction: InvoiceDirection = 'receivable';
    displayedColumns = [
        'invoiceNumber',
        'party',
        'issueDate',
        'dueDate',
        'status',
        'total',
        'amountPaid',
        'amountDue',
    ];

    items: InvoiceListItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterSearch: string | null = null;
    filterStatus: string | null = null;
    filterCompanyId: string | null = null;
    filterIssuedFrom: Date | null = null;
    filterIssuedTo: Date | null = null;
    partyFilter: Party | string | null = null;

    companies: Company[] = [];
    readonly invoiceStatuses = INVOICE_STATUSES;
    readonly invoiceStatusLabel = invoiceStatusLabel;
    readonly invoiceStatusChipClass = invoiceStatusChipClass;
    readonly partySearch: PartyAutocompleteSearch;

    private _suppressNextPartyPanelOpen = false;

    constructor() {
        this.partySearch = new PartyAutocompleteSearch(this._partiesService);
    }

    get canWrite(): boolean {
        return hasModuleWrite(this._auth.profileData, 'invoice');
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    get entityLabel(): string {
        return invoiceDirectionLabel(this.direction);
    }

    get entityPlural(): string {
        return invoiceDirectionPlural(this.direction);
    }

    get listBasePath(): string {
        return this.direction === 'payable' ? '/main/invoicing/bills' : '/main/invoicing/invoices';
    }

    ngOnInit(): void {
        this.direction = (this._route.snapshot.data['direction'] as InvoiceDirection) ?? 'receivable';
        const partyType = this.direction === 'payable' ? 'vendor' : 'customer';
        this.partySearch.setTypeFilter(partyType);
        if (this.isAdmin) void this._loadCompanies();
        void this.loadItems();
    }

    ngOnDestroy(): void {
        this.partySearch.unbindPanelScroll();
    }

    private async _loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch {
            this.companies = [];
        }
    }

    async loadItems(): Promise<void> {
        const showOverlay = this.items.length === 0;
        if (showOverlay) this.pageLoader = true;
        const partyId =
            this.partyFilter && typeof this.partyFilter !== 'string' ? this.partyFilter.id : null;
        try {
            const resp = await lastValueFrom(
                this._invoicesService.getInvoices(this.pageIndex + 1, this.pageSize, {
                    direction: this.direction,
                    status: this.filterStatus,
                    companyId: this.filterCompanyId,
                    partyId,
                    issuedFrom: this._formatDate(this.filterIssuedFrom),
                    issuedTo: this._formatDate(this.filterIssuedTo),
                    search: this.filterSearch,
                })
            );
            this.items = resp.data ?? [];
            this.total = resp.count ?? this.items.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || `Failed to load ${this.entityPlural.toLowerCase()}`);
            this.items = [];
            this.total = 0;
        } finally {
            if (showOverlay) this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        void this.loadItems();
    }

    private _suppressFilterApply = false;
    private readonly _filterApply = createDebouncedFilterApply(() => {
        if (this._suppressFilterApply) return;
        this.pageIndex = 0;
        void this.loadItems();
    });

    applyFilters(): void {
        this._filterApply.now();
    }

    scheduleApplyFilters(): void {
        this._filterApply.schedule();
    }

    clearFilters(): void {
        this._suppressFilterApply = true;
        this.filterSearch = null;
        this.filterStatus = null;
        this.filterCompanyId = null;
        this.filterIssuedFrom = null;
        this.filterIssuedTo = null;
        this.partyFilter = null;
        this._suppressFilterApply = false;
        this._filterApply.now();
    }

    openDetail(row: InvoiceListItem): void {
        void this._router.navigate([this.listBasePath, row.id]);
    }

    openCreate(): void {
        void this._router.navigate([this.listBasePath, 'new']);
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
        this.applyFilters();
    }

    onPartyPanelOpened(autocomplete: MatAutocomplete): void {
        if (this._suppressNextPartyPanelOpen) {
            this._suppressNextPartyPanelOpen = false;
            return;
        }
        const q = typeof this.partyFilter === 'string' ? this.partyFilter : this.partyFilter?.name ?? '';
        void this.partySearch.resetAndLoad(q);
        this.partySearch.bindPanelScroll(autocomplete);
    }

    onPartyPanelClosed(): void {
        this.partySearch.unbindPanelScroll();
    }

    clearPartyFilter(trigger: MatAutocompleteTrigger): void {
        this.partyFilter = null;
        this._suppressNextPartyPanelOpen = true;
        trigger.closePanel();
        this.applyFilters();
    }

    private _formatDate(d: Date | null): string | null {
        if (!d) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
