import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleRead, isAdminProfile } from 'app/core/auth/module-access.util';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { Company, CompaniesService } from 'app/modules/main/companies/companies.service';
import { Subject, lastValueFrom, takeUntil } from 'rxjs';
import {
    ApexChartOptions,
    buildBarChart,
    buildDonutChart,
    buildHorizontalBarChart,
    buildLineChart,
    formatChangePct,
} from './dashboard-chart.util';
import { DashboardChartComponent } from './dashboard-chart.component';
import {
    DASHBOARD_RANGES,
    DashboardActivityResponse,
    DashboardLoansResponse,
    DashboardMetric,
    DashboardOverview,
    DashboardPayrollResponse,
    DashboardPerformanceResponse,
    DashboardQueryParams,
    DashboardRange,
    DashboardService,
    DashboardWorkforceResponse,
} from './dashboard.service';

type DashboardTab = 'payroll' | 'workforce' | 'loans' | 'performance' | 'activity';

/**
 * Shown when the selected range contains no payroll but payroll exists elsewhere,
 * so an empty window can't be mistaken for an empty system.
 */
interface PayrollElsewhereNotice {
    /** Human label of the most recent period with payroll, e.g. "July 2026". */
    latestLabel: string;
    /** Smallest preset range that would include that period, or null when none reaches it. */
    jumpRange: DashboardRange | null;
    jumpLabel: string | null;
}

interface KpiCard {
    label: string;
    section: string;
    icon: string;
    metric?: DashboardMetric;
    plainValue?: number;
    format: 'number' | 'money' | 'distance';
}

@Component({
    selector: 'app-main-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatIconModule,
        MatCardModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatSelectModule,
        MatTooltipModule,
        MatTabsModule,
        MatTableModule,
        DecimalPipe,
        OverlayLoaderDirective,
        DashboardChartComponent,
    ],
    templateUrl: './main-dashboard.component.html',
    styleUrls: ['./main-dashboard.component.scss'],
})
export class MainDashboardComponent implements OnInit, OnDestroy {
    readonly rangeOptions = DASHBOARD_RANGES;
    readonly formatChangePct = formatChangePct;

    selectedRange: DashboardRange = 'monthly';
    companyId: string | null = null;
    companies: Company[] = [];

    overview: DashboardOverview | null = null;
    payrollElsewhere: PayrollElsewhereNotice | null = null;
    overviewLoader = false;
    kpiCards: KpiCard[] = [];

    activeTabIndex = 0;
    readonly tabForbidden: Partial<Record<DashboardTab, boolean>> = {};
    readonly tabLoading: Partial<Record<DashboardTab, boolean>> = {};

    payrollData: DashboardPayrollResponse | null = null;
    workforceData: DashboardWorkforceResponse | null = null;
    loansData: DashboardLoansResponse | null = null;
    performanceData: DashboardPerformanceResponse | null = null;
    activityData: DashboardActivityResponse | null = null;

    payrollNetChart: ApexChartOptions | null = null;
    payrollDeductionChart: ApexChartOptions | null = null;
    payrollStatusChart: ApexChartOptions | null = null;
    workforceStatusChart: ApexChartOptions | null = null;
    workforceOccupationChart: ApexChartOptions | null = null;
    workforceJoinersChart: ApexChartOptions | null = null;
    loansPipelineChart: ApexChartOptions | null = null;
    loansSeriesChart: ApexChartOptions | null = null;
    performanceDeliveriesChart: ApexChartOptions | null = null;
    activitySeriesChart: ApexChartOptions | null = null;
    activityActionChart: ApexChartOptions | null = null;
    activityResourceChart: ApexChartOptions | null = null;

    topPayColumns = ['name', 'amount'];
    topPerformerColumns = ['name', 'occupation', 'deliveries'];
    topUserColumns = ['email', 'count'];

    private _destroy$ = new Subject<void>();
    private _loadedTabs = new Set<DashboardTab>();

    constructor(
        private _dashboard: DashboardService,
        private _companies: CompaniesService,
        private _auth: AuthService,
        private _route: ActivatedRoute,
        private _router: Router
    ) {}

    get isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    get canReadEmployee(): boolean {
        return hasModuleRead(this._auth.profileData, 'employee');
    }

    get canReadSalarySlip(): boolean {
        return hasModuleRead(this._auth.profileData, 'salarySlip');
    }

    get canReadLoan(): boolean {
        return hasModuleRead(this._auth.profileData, 'loan');
    }

    get visibleTabs(): { id: DashboardTab; label: string }[] {
        const tabs: { id: DashboardTab; label: string }[] = [];
        if (this.canReadSalarySlip) tabs.push({ id: 'payroll', label: 'Payroll' });
        if (this.canReadEmployee) tabs.push({ id: 'workforce', label: 'Workforce' });
        if (this.canReadLoan) tabs.push({ id: 'loans', label: 'Loans' });
        if (this.canReadSalarySlip) tabs.push({ id: 'performance', label: 'Performance' });
        tabs.push({ id: 'activity', label: 'Activity' });
        return tabs;
    }

    get activeTab(): DashboardTab | null {
        return this.visibleTabs[this.activeTabIndex]?.id ?? null;
    }

    ngOnInit(): void {
        if (this.isAdmin) {
            this.loadCompanies();
        }
        this._route.queryParamMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
            this.selectedRange = this.parseRange(params.get('range'));
            this.companyId = params.get('companyId');
            this.onFiltersChanged();
        });
        if (!this._route.snapshot.queryParamMap.get('range')) {
            this.updateQueryParams();
        }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    onRangeChange(range: DashboardRange): void {
        if (range === this.selectedRange) return;
        this.selectedRange = range;
        this.updateQueryParams();
    }

    onCompanyChange(companyId: string | null): void {
        this.companyId = companyId;
        this.updateQueryParams();
    }

    onTabIndexChange(index: number): void {
        this.activeTabIndex = index;
        const tab = this.activeTab;
        if (tab) {
            this.loadTabData(tab);
        }
    }

    formatValue(card: KpiCard): string {
        const value = card.metric?.value ?? card.plainValue ?? 0;
        if (card.format === 'money') {
            return `AED ${this.formatNumber(value)}`;
        }
        if (card.format === 'distance') {
            return `${this.formatNumber(value)} km`;
        }
        return this.formatNumber(value);
    }

    formatPrevious(card: KpiCard): string {
        if (card.metric == null) return '—';
        const prev = card.metric.previous;
        if (card.format === 'money') return `AED ${this.formatNumber(prev)}`;
        if (card.format === 'distance') return `${this.formatNumber(prev)} km`;
        return this.formatNumber(prev);
    }

    changeDirection(changePct: number | null | undefined): 'up' | 'down' | 'flat' | 'none' {
        if (changePct == null) return 'none';
        if (changePct > 0) return 'up';
        if (changePct < 0) return 'down';
        return 'flat';
    }

    /** Jump the dashboard to the range that reveals the payroll the current window missed. */
    jumpToLatestPayroll(): void {
        const jumpRange = this.payrollElsewhere?.jumpRange;
        if (jumpRange) {
            this.onRangeChange(jumpRange);
        }
    }

    /**
     * An all-zero payroll section is ambiguous: it looks identical whether payroll was
     * never run or simply falls outside the selected window. The backend reports the
     * latest slip period regardless of range, so the two can be told apart here.
     */
    private buildPayrollElsewhereNotice(overview: DashboardOverview): PayrollElsewhereNotice | null {
        const payroll = overview.payroll;
        const latest = payroll?.latestPeriodMonth;
        if (!payroll || !latest || payroll.slips.value > 0) return null;

        // A slip's period_month is stored as the 1st of the month and the backend filters
        // it as a plain date, so compare the same way. Comparing month prefixes instead
        // would wrongly treat 2026-08 as inside a window starting 2026-08-20.
        const { fromDate, toDate } = overview.meta;
        const latestDate = `${latest}-01`;
        if (latestDate >= fromDate && latestDate <= toDate) return null;

        return {
            latestLabel: this.formatPeriodMonth(latest),
            ...this.jumpTarget(latest),
        };
    }

    /** Smallest preset range whose window would reach back to `periodMonth`. */
    private jumpTarget(periodMonth: string): { jumpRange: DashboardRange | null; jumpLabel: string | null } {
        const now = new Date();
        const [year, month] = periodMonth.split('-').map(Number);
        const monthsAgo =
            (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);

        // A future period is covered by any range that includes the current month.
        const range: DashboardRange | null =
            monthsAgo < 0 ? null : monthsAgo <= 5 ? 'last_6_months' : monthsAgo <= 11 ? 'yearly' : null;
        if (!range) return { jumpRange: null, jumpLabel: null };

        return {
            jumpRange: range,
            jumpLabel: DASHBOARD_RANGES.find((r) => r.value === range)?.label ?? null,
        };
    }

    private formatPeriodMonth(periodMonth: string): string {
        const [year, month] = periodMonth.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    }

    private parseRange(value: string | null): DashboardRange {
        const valid = DASHBOARD_RANGES.map((r) => r.value);
        return valid.includes(value as DashboardRange) ? (value as DashboardRange) : 'monthly';
    }

    private queryParams(): DashboardQueryParams {
        return {
            range: this.selectedRange,
            companyId: this.companyId,
        };
    }

    private updateQueryParams(): void {
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: {
                range: this.selectedRange,
                companyId: this.companyId || null,
            },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    private onFiltersChanged(): void {
        this._loadedTabs.clear();
        this.payrollData = null;
        this.workforceData = null;
        this.loansData = null;
        this.performanceData = null;
        this.activityData = null;
        this.clearCharts();
        this.loadOverview();
        const tab = this.activeTab;
        if (tab) {
            this.loadTabData(tab);
        }
    }

    private clearCharts(): void {
        this.payrollNetChart = null;
        this.payrollDeductionChart = null;
        this.payrollStatusChart = null;
        this.workforceStatusChart = null;
        this.workforceOccupationChart = null;
        this.workforceJoinersChart = null;
        this.loansPipelineChart = null;
        this.loansSeriesChart = null;
        this.performanceDeliveriesChart = null;
        this.activitySeriesChart = null;
        this.activityActionChart = null;
        this.activityResourceChart = null;
    }

    private async loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companies.getList());
        } catch {
            this.companies = [];
        }
    }

    private async loadOverview(): Promise<void> {
        this.overviewLoader = true;
        try {
            this.overview = await lastValueFrom(this._dashboard.getOverview(this.queryParams()));
            this.kpiCards = this.buildKpiCards(this.overview);
            this.payrollElsewhere = this.buildPayrollElsewhereNotice(this.overview);
        } catch {
            this.overview = null;
            this.kpiCards = [];
            this.payrollElsewhere = null;
        } finally {
            this.overviewLoader = false;
        }
    }

    private async loadTabData(tab: DashboardTab): Promise<void> {
        if (this._loadedTabs.has(tab) || this.tabForbidden[tab]) return;
        this.tabLoading[tab] = true;
        try {
            switch (tab) {
                case 'payroll':
                    await this.loadPayroll();
                    break;
                case 'workforce':
                    await this.loadWorkforce();
                    break;
                case 'loans':
                    await this.loadLoans();
                    break;
                case 'performance':
                    await this.loadPerformance();
                    break;
                case 'activity':
                    await this.loadActivity();
                    break;
            }
            this._loadedTabs.add(tab);
        } catch (e: unknown) {
            const err = e as { status?: number };
            if (err?.status === 403) {
                this.tabForbidden[tab] = true;
            }
        } finally {
            this.tabLoading[tab] = false;
        }
    }

    private async loadPayroll(): Promise<void> {
        const data = await lastValueFrom(this._dashboard.getPayroll(this.queryParams()));
        this.payrollData = data;
        this.payrollNetChart = buildLineChart(
            data.series,
            [
                { key: 'grossPayment', name: 'Gross' },
                { key: 'totalDeduction', name: 'Deductions' },
                { key: 'netPayment', name: 'Net' },
            ],
            data.meta,
            { yFormatter: (v) => `AED ${this.formatNumber(v)}` }
        );
        this.payrollDeductionChart = buildDonutChart(data.deductionComposition, 'amount');
        this.payrollStatusChart = buildDonutChart(data.byStatus, 'count');
    }

    private async loadWorkforce(): Promise<void> {
        const data = await lastValueFrom(this._dashboard.getWorkforce(this.queryParams()));
        this.workforceData = data;
        this.workforceStatusChart = buildDonutChart(data.byWorkingStatus, 'count');
        this.workforceOccupationChart = buildDonutChart(data.byOccupation, 'count');
        this.workforceJoinersChart = buildBarChart(
            data.joinersSeries.map((p) => ({
                ...p,
                joiners: Number(p.joiners ?? p.count ?? 0),
            })),
            [{ key: 'joiners', name: 'New joiners' }],
            data.meta
        );
    }

    private async loadLoans(): Promise<void> {
        const data = await lastValueFrom(this._dashboard.getLoans(this.queryParams()));
        this.loansData = data;
        this.loansPipelineChart = buildHorizontalBarChart(data.byStatus, 'loanAmount', 'status');
        this.loansSeriesChart = buildBarChart(
            data.series,
            [
                { key: 'issuedAmount', name: 'Issued' },
                { key: 'recoveredAmount', name: 'Recovered' },
            ],
            data.meta,
            { yFormatter: (v) => `AED ${this.formatNumber(v)}` }
        );
    }

    private async loadPerformance(): Promise<void> {
        const data = await lastValueFrom(this._dashboard.getPerformance(this.queryParams()));
        this.performanceData = data;
        this.performanceDeliveriesChart = buildLineChart(
            data.series,
            [
                { key: 'deliveries', name: 'Deliveries' },
                { key: 'pickups', name: 'Pickups' },
                { key: 'dropoffs', name: 'Dropoffs' },
            ],
            data.meta
        );
    }

    private async loadActivity(): Promise<void> {
        const data = await lastValueFrom(this._dashboard.getActivity(this.queryParams()));
        this.activityData = data;
        this.activitySeriesChart = buildBarChart(
            data.series.map((p) => ({
                bucket: p.bucket,
                actions: Number(p.actions ?? p.totalActions ?? p.count ?? 0),
            })),
            [{ key: 'actions', name: 'Actions' }],
            data.meta
        );
        this.activityActionChart = buildDonutChart(data.byAction, 'count');
        this.activityResourceChart = buildDonutChart(data.byResource, 'count');
    }

    private buildKpiCards(overview: DashboardOverview): KpiCard[] {
        const cards: KpiCard[] = [];

        if (overview.workforce) {
            const w = overview.workforce;
            cards.push(
                { section: 'Workforce', label: 'Active employees', metric: w.activeEmployees, format: 'number', icon: 'heroicons_outline:users' },
                { section: 'Workforce', label: 'Total employees', metric: w.totalEmployees, format: 'number', icon: 'heroicons_outline:user-group' },
                { section: 'Workforce', label: 'New joiners', metric: w.newJoiners, format: 'number', icon: 'heroicons_outline:user-plus' }
            );
        }

        if (overview.payroll) {
            const p = overview.payroll;
            cards.push(
                { section: 'Payroll', label: 'Salary slips', metric: p.slips, format: 'number', icon: 'heroicons_outline:document-text' },
                { section: 'Payroll', label: 'Gross payment', metric: p.grossPayment, format: 'money', icon: 'heroicons_outline:banknotes' },
                { section: 'Payroll', label: 'Total deduction', metric: p.totalDeduction, format: 'money', icon: 'heroicons_outline:minus-circle' },
                { section: 'Payroll', label: 'Net payment', metric: p.netPayment, format: 'money', icon: 'heroicons_outline:currency-dollar' },
                { section: 'Payroll', label: 'Pending net payment', plainValue: p.pendingNetPayment, format: 'money', icon: 'heroicons_outline:clock' }
            );
        }

        if (overview.loans) {
            const l = overview.loans;
            cards.push(
                { section: 'Loans', label: 'Issued amount', metric: l.issuedAmount, format: 'money', icon: 'heroicons_outline:arrow-trending-up' },
                { section: 'Loans', label: 'Loans issued', metric: l.issuedCount, format: 'number', icon: 'heroicons_outline:document-plus' },
                { section: 'Loans', label: 'Outstanding amount', plainValue: l.outstandingAmount, format: 'money', icon: 'heroicons_outline:scale' },
                { section: 'Loans', label: 'Recovered in range', plainValue: l.recoveredInRange, format: 'money', icon: 'heroicons_outline:arrow-path' }
            );
        }

        if (overview.salaryDebt) {
            const d = overview.salaryDebt;
            cards.push(
                { section: 'Salary debt', label: 'Outstanding debt', plainValue: d.outstandingAmount, format: 'money', icon: 'heroicons_outline:exclamation-triangle' },
                { section: 'Salary debt', label: 'Employees with debt', plainValue: d.employeesWithDebt, format: 'number', icon: 'heroicons_outline:users' },
                { section: 'Salary debt', label: 'New debt', metric: d.newDebt, format: 'money', icon: 'heroicons_outline:plus-circle' }
            );
        }

        if (overview.performance) {
            const perf = overview.performance;
            cards.push(
                { section: 'Performance', label: 'Deliveries', metric: perf.deliveries, format: 'number', icon: 'heroicons_outline:truck' },
                { section: 'Performance', label: 'Distance', metric: perf.distanceKm, format: 'distance', icon: 'heroicons_outline:map' },
                { section: 'Performance', label: 'Pickups', metric: perf.pickups, format: 'number', icon: 'heroicons_outline:arrow-up-tray' },
                { section: 'Performance', label: 'Dropoffs', metric: perf.dropoffs, format: 'number', icon: 'heroicons_outline:arrow-down-tray' }
            );
        }

        return cards;
    }

    private formatNumber(value: number): string {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value ?? 0);
    }
}
