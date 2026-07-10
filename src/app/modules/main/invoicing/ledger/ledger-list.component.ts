import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite, isAdminProfile } from 'app/core/auth/module-access.util';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { CompaniesService, Company } from '../../companies/companies.service';
import {
    LEDGER_CATEGORIES,
    LEDGER_ENTRY_TYPES,
    LedgerEntry,
    LedgerService,
    LedgerSummary,
    entryTypeChipClass,
    entryTypeLabel,
    isManualEntry,
    ledgerCategoryLabel,
} from '../services/ledger.service';
import { LedgerEntryFormDialogComponent } from './dialogs/ledger-entry-form-dialog.component';

@Component({
    selector: 'app-ledger-list',
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
        MatTooltipModule,
        DatePipe,
        CurrencyPipe,
        OverlayLoaderDirective,
    ],
    templateUrl: './ledger-list.component.html',
})
export class LedgerListComponent implements OnInit {
    private _ledgerService = inject(LedgerService);
    private _companiesService = inject(CompaniesService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _matDialog = inject(MatDialog);
    private _auth = inject(AuthService);

    displayedColumns: string[] = [
        'entryDate',
        'entryType',
        'amount',
        'category',
        'description',
        'reference',
        'partyName',
        'runningBalance',
        'source',
    ];

    constructor() {
        if (hasModuleWrite(this._auth.profileData, 'invoice')) {
            this.displayedColumns = [...this.displayedColumns, 'actions'];
        }
    }

    items: LedgerEntry[] = [];
    summary: LedgerSummary | null = null;
    total = 0;
    pageIndex = 0;
    pageSize = 20;
    pageLoader = false;

    filterSearch: string | null = null;
    filterCompanyId: string | null = null;
    filterEntryType: string | null = null;
    filterCategory: string | null = null;
    filterSource: string | null = null;
    filterDateFrom: Date | null = null;
    filterDateTo: Date | null = null;

    companies: Company[] = [];
    readonly entryTypes = LEDGER_ENTRY_TYPES;
    readonly categories = LEDGER_CATEGORIES;
    readonly entryTypeLabel = entryTypeLabel;
    readonly entryTypeChipClass = entryTypeChipClass;
    readonly ledgerCategoryLabel = ledgerCategoryLabel;
    readonly isManualEntry = isManualEntry;

    get canWrite(): boolean {
        return hasModuleWrite(this._auth.profileData, 'invoice');
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    ngOnInit(): void {
        this._route.queryParamMap.subscribe((params) => {
            const search = params.get('search');
            if (search) this.filterSearch = search;
        });
        if (this.isAdmin) void this._loadCompanies();
        void this.loadItems();
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
        try {
            const resp = await lastValueFrom(
                this._ledgerService.getLedger(this.pageIndex + 1, this.pageSize, {
                    companyId: this.filterCompanyId,
                    entryType: this.filterEntryType as any,
                    category: this.filterCategory,
                    source: this.filterSource,
                    dateFrom: this._formatDate(this.filterDateFrom),
                    dateTo: this._formatDate(this.filterDateTo),
                    search: this.filterSearch,
                })
            );
            this.items = resp.data ?? [];
            this.summary = resp.summary ?? null;
            this.total = resp.count ?? this.items.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load ledger');
            this.items = [];
            this.summary = null;
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
        this.filterCompanyId = null;
        this.filterEntryType = null;
        this.filterCategory = null;
        this.filterSource = null;
        this.filterDateFrom = null;
        this.filterDateTo = null;
        this._suppressFilterApply = false;
        void this._router.navigate([], { relativeTo: this._route, queryParams: {} });
        this._filterApply.now();
    }

    openCreateDialog(): void {
        this._matDialog
            .open(LedgerEntryFormDialogComponent, {
                data: { defaultCompanyId: this.filterCompanyId },
                width: '96vw',
                maxWidth: '480px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) void this.loadItems();
            });
    }

    openEditDialog(entry: LedgerEntry): void {
        this._matDialog
            .open(LedgerEntryFormDialogComponent, {
                data: { entry },
                width: '96vw',
                maxWidth: '480px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) void this.loadItems();
            });
    }

    confirmDelete(entry: LedgerEntry): void {
        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: { message: 'Delete this ledger entry?' },
            })
            .afterClosed()
            .subscribe((confirmed) => {
                if (confirmed) void this._deleteEntry(entry.id);
            });
    }

    private async _deleteEntry(id: string): Promise<void> {
        try {
            await lastValueFrom(this._ledgerService.deleteEntry(id));
            this._toast.success('Entry deleted');
            void this.loadItems();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Delete failed');
        }
    }

    private _formatDate(d: Date | null): string | null {
        if (!d) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
