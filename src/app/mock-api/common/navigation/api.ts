import { Injectable } from '@angular/core';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class NavigationMockApi {
    private readonly _mainNavigation: FuseNavigationItem[] = [
        {
            id: 'dashboard',
            title: 'Dashboard',
            type: 'basic',
            icon: 'heroicons_outline:squares-2x2',
            link: '/main/dashboard',
        },
        {
            id: 'users',
            title: 'Users',
            type: 'basic',
            icon: 'heroicons_outline:users',
            link: '/main/users',
        },
        {
            id: 'companies',
            title: 'Companies',
            type: 'basic',
            icon: 'heroicons_outline:building-office-2',
            link: '/main/companies',
        },
        {
            id: 'employees',
            title: 'Employees',
            type: 'basic',
            icon: 'heroicons_outline:user-group',
            link: '/main/employees',
        },
        {
            id: 'loans',
            title: 'Loans',
            type: 'basic',
            icon: 'heroicons_outline:banknotes',
            link: '/main/loans',
        },
        {
            id: 'pay-components',
            title: 'Pay components',
            type: 'basic',
            icon: 'heroicons_outline:rectangle-stack',
            link: '/main/pay-components',
        },
        {
            id: 'salary-slips',
            title: 'Salary slips',
            type: 'basic',
            icon: 'heroicons_outline:document-text',
            link: '/main/salary-slips',
        },
        {
            id: 'invoice',
            title: 'Invoicing',
            type: 'basic',
            icon: 'heroicons_outline:receipt-percent',
            link: '/main/invoicing',
        },
        {
            id: 'talabat-occupation-rates',
            title: 'Talabat Occupation Rates',
            type: 'basic',
            icon: 'heroicons_outline:currency-dollar',
            link: '/main/talabat-occupation-rates',
        },
        {
            id: 'assets',
            title: 'Fleet & Assets',
            type: 'basic',
            icon: 'heroicons_outline:truck',
            link: '/main/assets',
        },
    ];
    private readonly _compactNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _defaultNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _futuristicNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _horizontalNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _accountingNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _adminNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _settingsNavigations: FuseNavigationItem[] = this._mainNavigation;
    private readonly _inventoryNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _purchasesNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _salesNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _manufacturingNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _hrNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _logisticsNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _gateNavigation: FuseNavigationItem[] = this._mainNavigation;
    private readonly _posNavigation: FuseNavigationItem[] = this._mainNavigation;
    /**
     * Constructor
     */
    constructor(private _fuseMockApiService: FuseMockApiService) {
        // Register Mock API handlers
        this.registerHandlers();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register Mock API handlers
     */
    registerHandlers(): void {
        // -----------------------------------------------------------------------------------------------------
        // @ Navigation - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService.onGet('api/common/navigation').reply(() => {
            // Return the response
            return [
                200,
                {
                    compact: cloneDeep(this._compactNavigation),
                    default: cloneDeep(this._defaultNavigation),
                    futuristic: cloneDeep(this._futuristicNavigation),
                    horizontal: cloneDeep(this._horizontalNavigation),
                    accounting: cloneDeep(this._accountingNavigation),
                    admin: cloneDeep(this._adminNavigation),
                    settings: cloneDeep(this._settingsNavigations),
                    inventory: cloneDeep(this._inventoryNavigation),
                    purchases: cloneDeep(this._purchasesNavigation),
                    sales: cloneDeep(this._salesNavigation),
                    manufacturing: cloneDeep(this._manufacturingNavigation),
                    hr: cloneDeep(this._hrNavigation),
                    logistics: cloneDeep(this._logisticsNavigation),
                    gate: cloneDeep(this._gateNavigation),
                    pos: cloneDeep(this._posNavigation),
                },
            ];
        });
    }
}
