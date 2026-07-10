import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule, MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite, isAdminProfile } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { AssetsService, Asset, AssetType, AssetStatus, AssetDashboardCosts } from './assets.service';
import { CompaniesService, Company } from '../companies/companies.service';
import { EmployeesService, EmployeeListItem } from '../employees/employees.service';
import { EmployeeAutocompleteSearch } from '../employees/employee-autocomplete-search';
import { AssetFormDialogComponent } from './dialogs/asset-form-dialog.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
    selector: 'app-assets-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatAutocompleteModule,
        DatePipe,
        CurrencyPipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './assets-list.component.html',
})
export class AssetsListComponent implements OnInit, OnDestroy {
    private _assetsService = inject(AssetsService);
    private _companiesService = inject(CompaniesService);
    private _employeesService = inject(EmployeesService);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _matDialog = inject(MatDialog);
    private _auth = inject(AuthService);

    displayedColumns: string[] = [
        'type',
        'name',
        'serialNumber',
        'companyName',
        'status',
        'currentAssignment',
        'monthlyCost',
        'actions',
    ];

    assets: Asset[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    // Filters
    filterSearch: string | null = null;
    filterType: string | null = null;
    filterStatus: string | null = null;
    filterCompanyId: string | null = null;
    employeeFilter: EmployeeListItem | string | null = null;

    companies: Company[] = [];
    dashboardCosts: AssetDashboardCosts | null = null;

    readonly employeeSearch: EmployeeAutocompleteSearch;
    private _suppressNextEmployeePanelOpen = false;

    readonly typeOptions = [
        { value: 'cycle', label: 'Cycle' },
        { value: 'bike', label: 'Bike' },
        { value: 'sim_card', label: 'SIM Card' },
        { value: 'other', label: 'Other' },
    ];

    readonly statusOptions = [
        { value: 'available', label: 'Available' },
        { value: 'assigned', label: 'Assigned' },
        { value: 'under_maintenance', label: 'Under Maintenance' },
        { value: 'damaged', label: 'Damaged' },
        { value: 'lost', label: 'Lost' },
        { value: 'retired', label: 'Retired' },
    ];

    private readonly _filterApply = createDebouncedFilterApply(() => {
        this.pageIndex = 0;
        this.loadAssets();
    });

    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

    constructor() {
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);
    }

    get canWriteAsset(): boolean {
        return hasModuleWrite(this._auth.profileData, 'asset');
    }

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    ngOnInit(): void {
        void this._init();
    }

    ngOnDestroy(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private async _init(): Promise<void> {
        await Promise.all([
            this.loadCompanies(),
            this.loadDashboardCosts(),
            this.employeeSearch.resetAndLoad(),
            this.loadAssets(),
        ]);
    }

    async loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch {
            this.companies = [];
        }
    }

    async loadDashboardCosts(): Promise<void> {
        try {
            this.dashboardCosts = await lastValueFrom(this._assetsService.getDashboardCosts(this.filterCompanyId));
        } catch {
            this.dashboardCosts = null;
        }
    }

    get totalAssetsRegistered(): number {
        if (!this.dashboardCosts?.assetSummary) return 0;
        return this.dashboardCosts.assetSummary.reduce((sum, item) => sum + item.count, 0);
    }

    get currentTotalLiabilities(): number {
        if (!this.dashboardCosts?.assetSummary) return 0;
        return this.dashboardCosts.assetSummary.reduce((sum, item) => sum + item.totalMonthlyCost, 0);
    }

    get activeMonthlyRecoveries(): number {
        return this.dashboardCosts?.activeMonthlySalaryRecoveries ?? 0;
    }

    async loadAssets(): Promise<void> {
        const showOverlay = this.assets.length === 0;
        if (showOverlay) this.pageLoader = true;
        try {
            const employeeId = this._selectedEmployeeId();
            const resp = await lastValueFrom(
                this._assetsService.getAssets(this.pageIndex + 1, this.pageSize, {
                    type: this.filterType || null,
                    status: this.filterStatus || null,
                    companyId: this.filterCompanyId || null,
                    employeeId: employeeId || null,
                    search: this.filterSearch?.trim() || null,
                })
            );
            this.assets = resp.data ?? [];
            this.total = resp.count ?? this.assets.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load assets');
            this.assets = [];
            this.total = 0;
        } finally {
            if (showOverlay) this.pageLoader = false;
        }
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.loadAssets();
        void this.loadDashboardCosts();
    }

    onSearchInput(): void {
        this._filterApply.schedule();
    }

    onSelectFilterChange(): void {
        this.applyFilters();
    }

    // Employee Autocomplete Filter
    employeeLabel(e: EmployeeListItem): string {
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Employee';
        const code = e.employeeId ? `${e.employeeId} · ` : '';
        return `${code}${name}`;
    }

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    onEmployeeFilterChange(value: EmployeeListItem | string | null): void {
        if (value && typeof value === 'object' && value.id) {
            this.employeeSearch.ensureInList(value);
            this.applyFilters();
            return;
        }
        this._employeeSearchApply.schedule();
        if (value == null || (typeof value === 'string' && value.trim() === '')) {
            this.applyFilters();
        }
    }

    onEmployeeOptionSelected(): void {
        this._suppressNextEmployeePanelOpen = true;
    }

    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        if (this._suppressNextEmployeePanelOpen) {
            this._suppressNextEmployeePanelOpen = false;
            return;
        }
        void this.employeeSearch.resetAndLoad(this._employeeSearchQuery()).then(() => {
            setTimeout(() => {
                trigger.updatePosition();
                trigger.openPanel();
            });
        });
    }

    onEmployeeAutocompleteOpened(auto: MatAutocomplete): void {
        this.employeeSearch.bindPanelScroll(auto);
    }

    onEmployeeAutocompleteClosed(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private _employeeSearchQuery(): string {
        const v = this.employeeFilter;
        return typeof v === 'string' ? v.trim() : '';
    }

    private async _scheduleEmployeeSearch(): Promise<void> {
        await this.employeeSearch.resetAndLoad(this._employeeSearchQuery());
    }

    private _selectedEmployeeId(): string | null {
        const v = this.employeeFilter;
        return v && typeof v === 'object' && 'id' in v ? (v as EmployeeListItem).id : null;
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        void this.loadAssets();
    }

    openCreateDialog(): void {
        this._matDialog
            .open(AssetFormDialogComponent, { width: '90vw', maxWidth: '640px' })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) {
                    void this._init();
                }
            });
    }

    openEditDialog(asset: Asset): void {
        this._matDialog
            .open(AssetFormDialogComponent, {
                width: '90vw',
                maxWidth: '640px',
                data: { id: asset.id },
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) {
                    void this._init();
                }
            });
    }

    deleteAsset(asset: Asset): void {
        if (asset.status === 'assigned') {
            this._toast.warning('Cannot delete an assigned asset. Please return it first.');
            return;
        }

        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: {
                    title: 'Delete Asset',
                    message: `Are you sure you want to delete the asset "${asset.name}" (${asset.serialNumber})? This action is irreversible.`,
                },
            })
            .afterClosed()
            .subscribe(async (confirmed) => {
                if (confirmed) {
                    this.pageLoader = true;
                    try {
                        await lastValueFrom(this._assetsService.deleteAsset(asset.id));
                        this._toast.success('Asset deleted successfully');
                        void this._init();
                    } catch (e: any) {
                        this._toast.error(e?.error?.message || 'Failed to delete asset');
                    } finally {
                        this.pageLoader = false;
                    }
                }
            });
    }

    getAssetTypeLabel(type: AssetType): string {
        return this.typeOptions.find((o) => o.value === type)?.label ?? type;
    }

    getAssetTypeIcon(type: AssetType): string {
        switch (type) {
            case 'cycle':
                return 'heroicons_outline:academic-cap'; // or any suitable icon
            case 'bike':
                return 'heroicons_outline:key';
            case 'sim_card':
                return 'heroicons_outline:device-phone-mobile';
            default:
                return 'heroicons_outline:tag';
        }
    }

    getAssetStatusLabel(status: AssetStatus): string {
        return this.statusOptions.find((o) => o.value === status)?.label ?? status;
    }

    getAssetStatusClass(status: AssetStatus): string {
        switch (status) {
            case 'available':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
            case 'assigned':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300';
            case 'under_maintenance':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
            case 'damaged':
            case 'lost':
                return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300';
            case 'retired':
                return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300';
            default:
                return 'bg-zinc-100 text-zinc-800';
        }
    }
}
