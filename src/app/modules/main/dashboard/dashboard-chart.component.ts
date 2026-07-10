import { Component, Input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ApexChartOptions } from './dashboard-chart.util';

@Component({
    selector: 'app-dashboard-chart',
    standalone: true,
    imports: [NgApexchartsModule],
    template: `
        @if (options) {
            <apx-chart
                [series]="options.series"
                [chart]="options.chart"
                [labels]="options.labels"
                [xaxis]="options.xaxis"
                [yaxis]="options.yaxis"
                [stroke]="options.stroke"
                [dataLabels]="options.dataLabels"
                [legend]="options.legend"
                [tooltip]="options.tooltip"
                [plotOptions]="options.plotOptions"
                [colors]="options.colors"
                [grid]="options.grid"
            ></apx-chart>
        } @else {
            <div class="flex h-48 items-center justify-center text-sm text-secondary">No data</div>
        }
    `,
})
export class DashboardChartComponent {
    @Input() options: ApexChartOptions | null = null;
}
