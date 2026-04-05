import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { ActivityLog, LogsService } from 'app/core/services/logs.service';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-main-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatIconModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatDatepickerModule,
        MatNativeDateModule,
        DatePipe,
        OverlayLoaderDirective,
    ],
    templateUrl: './main-dashboard.component.html',
    styleUrls: ['./main-dashboard.component.scss'],
})
export class MainDashboardComponent implements OnInit {
    displayedColumns: string[] = ['userEmail', 'action', 'resource', 'resourceId', 'ipAddress', 'createdAt'];
    logs: ActivityLog[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    logsLoader = false;

    filterUserId: string | null = null;
    filterAction: string | null = null;
    filterStartDate: Date | null = null;
    filterEndDate: Date | null = null;

    readonly actionOptions = [
        { value: null, label: 'All' },
        { value: 'CREATE', label: 'Create' },
        { value: 'UPDATE', label: 'Update' },
        { value: 'DELETE', label: 'Delete' },
    ];

    constructor(
        private _logsService: LogsService,
        private _auth: AuthService,
        private _toast: ToastrService
    ) {}

    get isAdmin(): boolean {
        return this._auth.profileData?.role === 'admin';
    }

    ngOnInit(): void {
        this.loadLogs();
    }

    /** Convert Date to ISO 8601 for API (start of day / end of day) */
    private dateToIso8601(value: Date | null, endOfDay: boolean): string | undefined {
        if (!value) return undefined;
        const d = new Date(value);
        if (endOfDay) {
            d.setHours(23, 59, 59, 999);
        } else {
            d.setHours(0, 0, 0, 0);
        }
        return d.toISOString();
    }

    async loadLogs(): Promise<void> {
        this.logsLoader = true;
        try {
            const resp = await lastValueFrom(
                this._logsService.getLogs(this.pageIndex + 1, this.pageSize, {
                    userId: this.filterUserId || undefined,
                    action: this.filterAction || undefined,
                    startDate: this.dateToIso8601(this.filterStartDate, false),
                    endDate: this.dateToIso8601(this.filterEndDate, true),
                })
            );
            this.logs = resp.logs ?? [];
            this.total = resp.count ?? this.logs.length;
        } catch (e: unknown) {
            const err = e as { error?: { message?: string } };
            this._toast.error(err?.error?.message || 'Failed to load activity logs');
            this.logs = [];
            this.total = 0;
        } finally {
            this.logsLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadLogs();
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.loadLogs();
    }

    clearFilters(): void {
        this.filterUserId = null;
        this.filterAction = null;
        this.filterStartDate = null;
        this.filterEndDate = null;
        this.applyFilters();
    }
}
