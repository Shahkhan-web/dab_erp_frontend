import { DateTime } from 'luxon';
import {
    ApexAxisChartSeries,
    ApexChart,
    ApexDataLabels,
    ApexGrid,
    ApexLegend,
    ApexNonAxisChartSeries,
    ApexPlotOptions,
    ApexStroke,
    ApexTooltip,
    ApexXAxis,
    ApexYAxis,
    ChartType,
} from 'ng-apexcharts';
import {
    DashboardBreakdownItem,
    DashboardBucket,
    DashboardMeta,
    DashboardSeriesPoint,
} from './dashboard.service';

export type ApexChartOptions = {
    series: ApexAxisChartSeries | ApexNonAxisChartSeries;
    chart: ApexChart;
    labels?: string[];
    xaxis?: ApexXAxis;
    yaxis?: ApexYAxis | ApexYAxis[];
    stroke?: ApexStroke;
    dataLabels?: ApexDataLabels;
    legend?: ApexLegend;
    tooltip?: ApexTooltip;
    plotOptions?: ApexPlotOptions;
    colors?: string[];
    grid?: ApexGrid;
};

const CHART_COLORS = [
    '#6366f1',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
];

export function formatBucketLabel(bucket: string, metaBucket: DashboardBucket): string {
    if (metaBucket === 'day') {
        const d = DateTime.fromISO(bucket, { zone: 'utc' });
        return d.isValid ? d.toFormat('dd LLL') : bucket;
    }
    const d = DateTime.fromISO(`${bucket}-01`, { zone: 'utc' });
    return d.isValid ? d.toFormat('LLL yyyy') : bucket;
}

export function formatChangePct(changePct: number | null | undefined): string {
    if (changePct == null) return '—';
    const sign = changePct > 0 ? '+' : '';
    return `${sign}${changePct.toFixed(1)}%`;
}

export function breakdownLabel(item: DashboardBreakdownItem): string {
    return (
        item.label ??
        item.status ??
        item.frequency ??
        item.type ??
        item.name ??
        item.key ??
        'Unknown'
    );
}

function baseChart(type: ChartType, height = 280): ApexChart {
    return {
        type,
        height,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
    };
}

function baseGrid(): ApexGrid {
    return {
        borderColor: 'var(--mat-divider-color)',
        strokeDashArray: 4,
    };
}

function baseDataLabels(enabled = false): ApexDataLabels {
    return { enabled };
}

function baseLegend(): ApexLegend {
    return {
        position: 'bottom',
        fontSize: '12px',
    };
}

export function buildLineChart(
    series: DashboardSeriesPoint[],
    metrics: { key: string; name: string }[],
    meta: DashboardMeta,
    options?: { colors?: string[]; yFormatter?: (v: number) => string }
): ApexChartOptions {
    const categories = series.map((p) => formatBucketLabel(p.bucket, meta.bucket));
    const chartSeries: ApexAxisChartSeries = metrics.map((m) => ({
        name: m.name,
        data: series.map((p) => Number(p[m.key] ?? 0)),
    }));

    return {
        series: chartSeries,
        chart: baseChart('line'),
        colors: options?.colors ?? CHART_COLORS,
        stroke: { curve: 'smooth', width: 2 },
        dataLabels: baseDataLabels(),
        legend: baseLegend(),
        grid: baseGrid(),
        xaxis: {
            categories,
            labels: { style: { fontSize: '11px' } },
        },
        yaxis: {
            labels: {
                formatter: (v) =>
                    options?.yFormatter ? options.yFormatter(Number(v)) : String(Math.round(Number(v))),
            },
        },
        tooltip: {
            y: {
                formatter: (v) =>
                    options?.yFormatter ? options.yFormatter(Number(v)) : String(v),
            },
        },
    };
}

export function buildBarChart(
    series: DashboardSeriesPoint[],
    metrics: { key: string; name: string }[],
    meta: DashboardMeta,
    options?: { stacked?: boolean; colors?: string[]; yFormatter?: (v: number) => string }
): ApexChartOptions {
    const categories = series.map((p) => formatBucketLabel(p.bucket, meta.bucket));
    const chartSeries: ApexAxisChartSeries = metrics.map((m) => ({
        name: m.name,
        data: series.map((p) => Number(p[m.key] ?? 0)),
    }));

    return {
        series: chartSeries,
        chart: baseChart('bar'),
        colors: options?.colors ?? CHART_COLORS,
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        dataLabels: baseDataLabels(),
        legend: baseLegend(),
        grid: baseGrid(),
        xaxis: {
            categories,
            labels: { style: { fontSize: '11px' } },
        },
        yaxis: {
            labels: {
                formatter: (v) =>
                    options?.yFormatter ? options.yFormatter(Number(v)) : String(Math.round(Number(v))),
            },
        },
        tooltip: {
            y: {
                formatter: (v) =>
                    options?.yFormatter ? options.yFormatter(Number(v)) : String(v),
            },
        },
    };
}

/** Ledger insights: earnings vs expenses time series. */
export function buildEarningsExpensesChart(
    series: Array<{ bucket: string; earnings?: number; expenses?: number }>,
    meta: DashboardMeta,
    options?: { colors?: string[]; yFormatter?: (v: number) => string }
): ApexChartOptions | null {
    if (!series?.length) return null;
    const asSeries: DashboardSeriesPoint[] = series.map((p) => ({
        bucket: p.bucket,
        earnings: p.earnings ?? 0,
        expenses: p.expenses ?? 0,
    }));
    return buildLineChart(
        asSeries,
        [
            { key: 'earnings', name: 'Earnings' },
            { key: 'expenses', name: 'Expenses' },
        ],
        meta,
        options
    );
}

export function buildDonutChart(
    items: DashboardBreakdownItem[],
    valueKey: 'count' | 'amount' | 'value' = 'count'
): ApexChartOptions | null {
    if (!items?.length) return null;
    const labels = items.map((i) => breakdownLabel(i));
    const data = items.map((i) => Number(i[valueKey] ?? i.count ?? 0));

    return {
        series: data,
        chart: baseChart('donut', 260),
        labels,
        colors: CHART_COLORS,
        dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
        legend: baseLegend(),
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                },
            },
        },
    };
}

export function buildHorizontalBarChart(
    items: DashboardBreakdownItem[],
    valueKey: 'count' | 'amount' | 'value' | 'loanAmount' | 'remaining' = 'count',
    labelKey?: 'label' | 'status' | 'name'
): ApexChartOptions | null {
    if (!items?.length) return null;
    const labels = items.map((i) => {
        if (labelKey === 'status') return i.status ?? breakdownLabel(i);
        if (labelKey === 'name') return i.name ?? breakdownLabel(i);
        return breakdownLabel(i);
    });
    const data = items.map((i) => Number(i[valueKey] ?? i.count ?? 0));

    return {
        series: [{ data }],
        chart: baseChart('bar', 260),
        colors: [CHART_COLORS[0]],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '70%',
            },
        },
        dataLabels: baseDataLabels(),
        grid: baseGrid(),
        xaxis: {
            categories: labels,
        },
    };
}
