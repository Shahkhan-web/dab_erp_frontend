import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { TalabatOccupationRateFormDialogComponent } from './talabat-occupation-rate-form-dialog.component';
import { TalabatOccupationRate, TalabatOccupationRatesService } from './talabat-occupation-rates.service';

@Component({
    selector: 'app-talabat-occupation-rates-list',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTableModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './talabat-occupation-rates-list.component.html',
})
export class TalabatOccupationRatesListComponent implements OnInit {
    private readonly _allDisplayedColumns = [
        'occupation',
        'pickupRateAed',
        'dropoffRateAed',
        'deliveriesReturnLcRateAed',
        'updatedAt',
        'actions',
    ] as const;

    displayedColumns: string[];
    items: TalabatOccupationRate[] = [];
    pageLoader = false;

    constructor(
        private _service: TalabatOccupationRatesService,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {
        const write = hasModuleWrite(this._auth.profileData, 'talabatOccupationRate');
        this.displayedColumns = write
            ? [...this._allDisplayedColumns]
            : this._allDisplayedColumns.filter((c) => c !== 'actions');
    }

    ngOnInit(): void {
        this.loadItems();
    }

    async loadItems(): Promise<void> {
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(this._service.getRates());
            this.items = resp.items ?? [];
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load occupation rates');
            this.items = [];
        } finally {
            this.pageLoader = false;
        }
    }

    occupationLabel(value: string): string {
        switch (value) {
            case 'bike_rider': return 'Bike Rider';
            case 'bicyclist': return 'Bicyclist';
            default: return value;
        }
    }

    openEditDialog(row: TalabatOccupationRate): void {
        this._matDialog
            .open(TalabatOccupationRateFormDialogComponent, {
                data: { rate: row },
                width: '96vw',
                maxWidth: '460px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((saved) => {
                if (saved) this.loadItems();
            });
    }
}
