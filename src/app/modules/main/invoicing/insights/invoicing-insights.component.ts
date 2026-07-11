import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { Subject, lastValueFrom, takeUntil } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { CompaniesService, Company } from '../../companies/companies.service';
import {
    DASHBOARD_RANGES,
    DashboardMetric,
    DashboardRange,
} from '../../dashboard/dashboard.service';
import {
    ApexChartOptions,
    buildDonutChart,
    buildEarningsExpensesChart,
    formatChangePct,
} from '../../dashboard/dashboard-chart.util';
import { DashboardChartComponent } from '../../dashboard/dashboard-chart.component';
import { LedgerInsightsResponse, LedgerService, ledgerCategoryLabel } from '../services/ledger.service';

interface KpiCard {
    label: string;
    section: string;
    icon: string;
    metric?: DashboardMetric;
    plainValue?: number;
    format: 'number' | 'money';
}

@Component({
    selector: 'app-invoicing-insights',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatSelectModule,
        MatIconModule,
        MatTooltipModule,
        OverlayLoaderDirective,
        DashboardChartComponent,
    ],
    templateUrl: './invoicing-insights.component.html',
})
export class InvoicingInsightsComponent implements OnInit, OnDestroy {
    private _ledgerService = inject(LedgerService);
    private _companiesService = inject(CompaniesService);
    private _auth = inject(AuthService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);

    readonly rangeOptions = DASHBOARD_RANGES;
    readonly formatChangePct = formatChangePct;
    readonly ledgerCategoryLabel = ledgerCategoryLabel;

    selectedRange: DashboardRange = 'monthly';
    companyId: string | null = null;
    companies: Company[] = [];
    insights: LedgerInsightsResponse | null = null;
    pageLoader = false;
    kpiCards: KpiCard[] = [];
    earningsExpensesChart: ApexChartOptions | null = null;
    expensesCategoryChart: ApexChartOptions | null = null;

    private _destroy$ = new Subject<void>();

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    ngOnInit(): void {
        if (this.isAdmin) void this._loadCompanies();
        this._route.queryParamMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
            this.selectedRange = this._parseRange(params.get('range'));
            this.companyId = params.get('companyId');
            void this.loadInsights();
        });
        if (!this._route.snapshot.queryParamMap.get('range')) {
            this._updateQueryParams();
        }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    onRangeChange(range: DashboardRange): void {
        if (range === this.selectedRange) return;
        this.selectedRange = range;
        this._updateQueryParams();
    }

    onCompanyChange(companyId: string | null): void {
        this.companyId = companyId;
        this._updateQueryParams();
    }

    formatValue(card: KpiCard): string {
        const value = card.metric?.value ?? card.plainValue ?? 0;
        if (card.format === 'money') return `AED ${this._formatNumber(value)}`;
        return this._formatNumber(value);
    }

    formatPrevious(card: KpiCard): string {
        if (!card.metric) return '—';
        if (card.format === 'money') return `AED ${this._formatNumber(card.metric.previous)}`;
        return this._formatNumber(card.metric.previous);
    }

    changeDirection(changePct: number | null | undefined): 'up' | 'down' | 'flat' | 'none' {
        if (changePct == null) return 'none';
        if (changePct > 0) return 'up';
        if (changePct < 0) return 'down';
        return 'flat';
    }

    private async _loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch {
            this.companies = [];
        }
    }

    private async loadInsights(): Promise<void> {
        this.pageLoader = true;
        try {
            this.insights = await lastValueFrom(
                this._ledgerService.getInsights(this.selectedRange, this.companyId)
            );
            this._buildKpiCards();
            this._buildCharts();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load insights');
            this.insights = null;
            this.kpiCards = [];
            this.earningsExpensesChart = null;
            this.expensesCategoryChart = null;
        } finally {
            this.pageLoader = false;
        }
    }

    private _buildKpiCards(): void {
        const i = this.insights;
        if (!i) {
            this.kpiCards = [];
            return;
        }
        this.kpiCards = [
            { section: 'Finance', label: 'Total earnings', metric: i.totalEarnings, format: 'money', icon: 'heroicons_outline:arrow-trending-up' },
            { section: 'Finance', label: 'Total expenses', metric: i.totalExpenses, format: 'money', icon: 'heroicons_outline:arrow-trending-down' },
            { section: 'Finance', label: 'Salaries this month', plainValue: i.salariesThisMonth, format: 'money', icon: 'heroicons_outline:users' },
            { section: 'Finance', label: 'Net profit', metric: i.netProfit, format: 'money', icon: 'heroicons_outline:banknotes' },
            { section: 'Outstanding', label: 'Receivable', plainValue: i.outstandingReceivable, format: 'money', icon: 'heroicons_outline:document-text' },
            { section: 'Outstanding', label: 'Payable', plainValue: i.outstandingPayable, format: 'money', icon: 'heroicons_outline:document-currency-dollar' },
        ];
    }

    private _buildCharts(): void {
        const i = this.insights;
        if (!i) {
            this.earningsExpensesChart = null;
            this.expensesCategoryChart = null;
            return;
        }
        this.earningsExpensesChart = buildEarningsExpensesChart(i.series, i.meta, {
            yFormatter: (v) => `AED ${this._formatNumber(v)}`,
        });
        const categoryItems = (i.expensesByCategory ?? []).map((row) => ({
            label: ledgerCategoryLabel(row.category),
            amount: row.amount,
            count: row.amount,
        }));
        this.expensesCategoryChart = buildDonutChart(categoryItems, 'amount');
    }

    private _parseRange(value: string | null): DashboardRange {
        const valid = DASHBOARD_RANGES.map((r) => r.value);
        return valid.includes(value as DashboardRange) ? (value as DashboardRange) : 'monthly';
    }

    private _updateQueryParams(): void {
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: {
                range: this.selectedRange,
                companyId: this.companyId || null,
            },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    private _formatNumber(value: number): string {
        return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(value ?? 0);
    }
}
