import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { hasModuleWrite } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import {
    InvoiceDetail,
    InvoiceDirection,
    InvoicesService,
    invoiceDirectionLabel,
    invoiceStatusChipClass,
    invoiceStatusLabel,
    isInvoiceVoid,
    paymentMethodLabel,
} from '../services/invoices.service';
import { InvoiceAttachmentsPanelComponent } from '../shared/invoice-attachments-panel.component';
import { InvoiceRecordPaymentDialogComponent } from './dialogs/invoice-record-payment-dialog.component';

@Component({
    selector: 'app-invoice-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTableModule,
        MatTooltipModule,
        DatePipe,
        CurrencyPipe,
        BackButtonComponent,
        OverlayLoaderDirective,
        InvoiceAttachmentsPanelComponent,
    ],
    templateUrl: './invoice-detail.component.html',
})
export class InvoiceDetailComponent implements OnInit {
    private _invoicesService = inject(InvoicesService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _toast = inject(ToastrService);
    private _matDialog = inject(MatDialog);
    private _auth = inject(AuthService);

    direction: InvoiceDirection = 'receivable';
    invoiceId: string | null = null;
    invoice: InvoiceDetail | null = null;
    pageLoader = false;

    lineColumns = ['description', 'quantity', 'unitPrice', 'taxRatePct', 'lineSubtotal', 'lineTax', 'lineTotal'];
    paymentColumns = ['paidDate', 'amount', 'method', 'reference', 'notes', 'ledger'];

    readonly invoiceStatusLabel = invoiceStatusLabel;
    readonly invoiceStatusChipClass = invoiceStatusChipClass;
    readonly paymentMethodLabel = paymentMethodLabel;

    get canWrite(): boolean {
        return hasModuleWrite(this._auth.profileData, 'invoice');
    }

    get entityLabel(): string {
        return invoiceDirectionLabel(this.direction);
    }

    get listBasePath(): string {
        return this.direction === 'payable' ? '/main/invoicing/bills' : '/main/invoicing/invoices';
    }

    get isVoid(): boolean {
        return isInvoiceVoid(this.invoice);
    }

    get canRecordPayment(): boolean {
        if (!this.invoice || this.isVoid) return false;
        return this.canWrite && Number(this.invoice.amountDue) > 0;
    }

    get canDelete(): boolean {
        if (!this.invoice || this.isVoid) return false;
        return this.canWrite && Number(this.invoice.amountPaid) === 0;
    }

    get canEdit(): boolean {
        return this.canWrite && !this.isVoid;
    }

    ngOnInit(): void {
        this.direction = (this._route.snapshot.data['direction'] as InvoiceDirection) ?? 'receivable';
        this.invoiceId = this._route.snapshot.paramMap.get('id');
        if (this.invoiceId) {
            void this.loadInvoice();
        } else {
            void this._router.navigate([this.listBasePath]);
        }
    }

    async loadInvoice(): Promise<void> {
        if (!this.invoiceId) return;
        this.pageLoader = true;
        try {
            this.invoice = await lastValueFrom(this._invoicesService.getInvoice(this.invoiceId));
            this.direction = this.invoice.direction;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load invoice');
            void this._router.navigate([this.listBasePath]);
        } finally {
            this.pageLoader = false;
        }
    }

    editInvoice(): void {
        if (!this.invoiceId) return;
        void this._router.navigate([this.listBasePath, this.invoiceId, 'edit']);
    }

    openRecordPayment(): void {
        if (!this.invoice) return;
        this._matDialog
            .open(InvoiceRecordPaymentDialogComponent, {
                data: { invoice: this.invoice },
                width: '96vw',
                maxWidth: '520px',
                disableClose: true,
            })
            .afterClosed()
            .subscribe((ok) => {
                if (ok) void this.loadInvoice();
            });
    }

    confirmVoid(): void {
        if (!this.invoice) return;
        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: {
                    title: `Void ${this.entityLabel.toLowerCase()}`,
                    message: `Void ${this.invoice.invoiceNumber}? This cannot be undone.`,
                    confirmLabel: 'Void',
                },
            })
            .afterClosed()
            .subscribe((confirmed) => {
                if (confirmed) void this._voidInvoice();
            });
    }

    confirmDelete(): void {
        if (!this.invoice) return;
        this._matDialog
            .open(ConfirmDeleteDialogComponent, {
                data: {
                    title: `Delete ${this.entityLabel.toLowerCase()}`,
                    message: `Delete ${this.invoice.invoiceNumber}?`,
                },
            })
            .afterClosed()
            .subscribe((confirmed) => {
                if (confirmed) void this._deleteInvoice();
            });
    }

    onAttachmentsChange(): void {
        void this.loadInvoice();
    }

    private async _voidInvoice(): Promise<void> {
        if (!this.invoiceId) return;
        try {
            await lastValueFrom(this._invoicesService.voidInvoice(this.invoiceId));
            this._toast.success(`${this.entityLabel} voided`);
            void this.loadInvoice();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Void failed');
        }
    }

    private async _deleteInvoice(): Promise<void> {
        if (!this.invoiceId) return;
        try {
            await lastValueFrom(this._invoicesService.deleteInvoice(this.invoiceId));
            this._toast.success(`${this.entityLabel} deleted`);
            void this._router.navigate([this.listBasePath]);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Delete failed');
        }
    }
}
