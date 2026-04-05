import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { Company, CompaniesService, resolveLetterHeadUrl } from './companies.service';
import { CompanyFormDialogComponent } from './dialogs/company-form-dialog.component';
import { LetterHeadDialogComponent } from './dialogs/letter-head-dialog.component';

@Component({
    selector: 'app-companies-list',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './companies-list.component.html',
})
export class CompaniesListComponent implements OnInit {
    displayedColumns: string[] = ['name', 'employeeIdPrefix', 'letterHead', 'createdAt', 'actions'];
    companies: Company[] = [];
    pageLoader = false;

    constructor(
        private _companiesService: CompaniesService,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {}

    ngOnInit(): void {
        this.load();
    }

    isAdmin(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    letterHeadLink(c: Company): string | null {
        return resolveLetterHeadUrl(c.letterHeadUrl);
    }

    async load(): Promise<void> {
        this.pageLoader = true;
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load companies');
            this.companies = [];
        } finally {
            this.pageLoader = false;
        }
    }

    openCreateDialog(): void {
        this._matDialog
            .open(CompanyFormDialogComponent, { width: '90vw', maxWidth: '520px' })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) this.load();
            });
    }

    openLetterHeadDialog(company: Company): void {
        this._matDialog
            .open(LetterHeadDialogComponent, {
                data: { company },
                width: '90vw',
                maxWidth: '640px',
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) this.load();
            });
    }

    openLetterHeadUrl(url: string): void {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
