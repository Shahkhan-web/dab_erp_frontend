import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';
import { PayComponentFormDialogComponent } from './pay-component-form-dialog.component';
import { PayComponent, PayComponentsService } from './pay-components.service';

@Component({
    selector: 'app-pay-components-list',
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
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './pay-components-list.component.html',
})
export class PayComponentsListComponent implements OnInit {
    private readonly _allDisplayedColumns = ['name', 'type', 'isActive', 'createdAt', 'actions'] as const;
    displayedColumns: string[];
    items: PayComponent[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterName: string | null = null;
    filterType: string | null = null;
    filterIsActive: boolean | null = null;

    constructor(
        private _service: PayComponentsService,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        const write = hasModuleWrite(this._auth.profileData, 'payComponent');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'actions');
    }

    get canWritePayComponent(): boolean {
        return hasModuleWrite(this._auth.profileData, 'payComponent');
    }

    ngOnInit(): void {
        this.loadItems();
    }

    async loadItems(): Promise<void> {
        const showOverlay = this.items.length === 0;
        if (showOverlay) this.pageLoader = true;
        try {
            const resp = await lastValueFrom(
                this._service.getPayComponents(this.pageIndex + 1, this.pageSize, {
                    name: this.filterName,
                    type: this.filterType,
                    isActive: this.filterIsActive,
                })
            );
            this.items = resp.items ?? [];
            this.total = resp.count ?? this.items.length;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load pay components');
            this.items = [];
            this.total = 0;
        } finally {
            if (showOverlay) this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadItems();
    }

    private _suppressFilterApply = false;
    private readonly _filterApply = createDebouncedFilterApply(() => {
        if (this._suppressFilterApply) return;
        this.pageIndex = 0;
        this.loadItems();
    });

    applyFilters(): void {
        this._filterApply.now();
    }

    scheduleApplyFilters(): void {
        this._filterApply.schedule();
    }

    clearFilters(): void {
        this._suppressFilterApply = true;
        this.filterName = null;
        this.filterType = null;
        this.filterIsActive = null;
        this._suppressFilterApply = false;
        this._filterApply.now();
    }

    typeChipClass(type: string | undefined): Record<string, boolean> {
        const t = (type || '').toLowerCase();
        return {
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300': t === 'earning',
            'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300': t === 'deduction',
            'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300':
                t !== 'earning' && t !== 'deduction',
        };
    }

    openCreateDialog(): void {
        this._matDialog
            .open(PayComponentFormDialogComponent, {
                data: {},
                width: '96vw',
                maxWidth: '420px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) this.loadItems();
            });
    }

    openEditDialog(row: PayComponent): void {
        this._matDialog
            .open(PayComponentFormDialogComponent, {
                data: { id: row.id },
                width: '96vw',
                maxWidth: '420px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) this.loadItems();
            });
    }
}
