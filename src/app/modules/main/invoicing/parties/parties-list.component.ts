import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { CompaniesService, Company } from '../../companies/companies.service';
import {
    PARTY_TYPES,
    PartiesService,
    Party,
    PartyType,
    partyTypeLabel,
} from '../services/parties.service';
import { PartyFormDialogComponent } from './dialogs/party-form-dialog.component';

@Component({
    selector: 'app-parties-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        OverlayLoaderDirective,
    ],
    templateUrl: './parties-list.component.html',
})
export class PartiesListComponent implements OnInit {
    private _partiesService = inject(PartiesService);
    private _companiesService = inject(CompaniesService);
    private _toast = inject(ToastrService);
    private _matDialog = inject(MatDialog);
    private _auth = inject(AuthService);

    private readonly _allDisplayedColumns = [
        'name',
        'type',
        'email',
        'phone',
        'trn',
        'companyName',
        'actions',
    ] as const;

    displayedColumns: string[];
    items: Party[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterSearch: string | null = null;
    filterType: PartyType | null = null;
    filterCompanyId: string | null = null;
    companies: Company[] = [];

    readonly partyTypes = PARTY_TYPES;
    readonly partyTypeLabel = partyTypeLabel;

    constructor() {
        const write = hasModuleWrite(this._auth.profileData, 'invoice');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'actions');
    }

    get canWrite(): boolean {
        return hasModuleWrite(this._auth.profileData, 'invoice');
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    ngOnInit(): void {
        if (this.isAdmin) {
            void this._loadCompanies();
        }
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
                this._partiesService.getParties(this.pageIndex + 1, this.pageSize, {
                    search: this.filterSearch,
                    type: this.filterType,
                    companyId: this.filterCompanyId,
                })
            );
            this.items = resp.data ?? [];
            this.total = resp.count ?? this.items.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load parties');
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
        this.filterType = null;
        this.filterCompanyId = null;
        this._suppressFilterApply = false;
        this._filterApply.now();
    }

    typeChipClass(type: string | undefined): Record<string, boolean> {
        const t = (type || '').toLowerCase();
        return {
            'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300': t === 'customer',
            'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300': t === 'vendor',
            'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300': t === 'both',
        };
    }

    openCreateDialog(): void {
        this._matDialog
            .open(PartyFormDialogComponent, {
                data: {},
                width: '96vw',
                maxWidth: '480px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) void this.loadItems();
            });
    }

    openEditDialog(row: Party): void {
        this._matDialog
            .open(PartyFormDialogComponent, {
                data: { id: row.id },
                width: '96vw',
                maxWidth: '480px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) void this.loadItems();
            });
    }

    confirmDelete(row: Party): void {
        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: {
                    title: 'Delete party',
                    message: `Delete "${row.name}"? This cannot be undone if the party is not referenced by invoices.`,
                },
            })
            .afterClosed()
            .subscribe((confirmed) => {
                if (confirmed) void this._deleteParty(row.id);
            });
    }

    private async _deleteParty(id: string): Promise<void> {
        try {
            await lastValueFrom(this._partiesService.deleteParty(id));
            this._toast.success('Party deleted');
            void this.loadItems();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Delete failed');
        }
    }
}
