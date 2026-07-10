import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import {
    InvoiceDetail,
    InvoicesService,
    PAYMENT_METHODS,
    PaymentMethod,
    PaymentPreview,
    paymentMethodLabel,
} from '../../services/invoices.service';

export interface InvoiceRecordPaymentDialogData {
    invoice: InvoiceDetail;
}

@Component({
    selector: 'app-invoice-record-payment-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        CurrencyPipe,
    ],
    templateUrl: './invoice-record-payment-dialog.component.html',
})
export class InvoiceRecordPaymentDialogComponent implements OnInit {
    form: FormGroup;
    postToLedger = true;
    preview: PaymentPreview | null = null;
    previewLoading = false;
    saving = false;

    readonly paymentMethods = PAYMENT_METHODS;
    readonly paymentMethodLabel = paymentMethodLabel;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<InvoiceRecordPaymentDialogComponent, boolean>,
        private _invoicesService: InvoicesService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: InvoiceRecordPaymentDialogData
    ) {
        const amountDue = Number(data.invoice.amountDue) || 0;
        this.form = this._fb.group({
            amount: [amountDue, [Validators.required, Validators.min(0.01), Validators.max(amountDue)]],
            paidDate: [new Date(), Validators.required],
            method: ['bank_transfer' as PaymentMethod, Validators.required],
            reference: [''],
            notes: [''],
        });
    }

    get invoice(): InvoiceDetail {
        return this.data.invoice;
    }

    get maxAmount(): number {
        return Number(this.invoice.amountDue) || 0;
    }

    ngOnInit(): void {
        void this.loadPreview();
        this.form.get('amount')?.valueChanges.subscribe(() => {
            void this.loadPreview();
        });
    }

    async loadPreview(): Promise<void> {
        const amount = Number(this.form.get('amount')?.value);
        if (!Number.isFinite(amount) || amount <= 0 || amount > this.maxAmount) {
            this.preview = null;
            return;
        }
        this.previewLoading = true;
        try {
            this.preview = await lastValueFrom(
                this._invoicesService.getPaymentPreview(this.invoice.id, amount)
            );
        } catch (e: any) {
            this.preview = null;
            this._toast.error(e?.error?.message || 'Failed to load payment preview');
        } finally {
            this.previewLoading = false;
        }
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    async confirm(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const amount = Number(raw.amount);
        if (amount > this.maxAmount) {
            this._toast.error('Amount cannot exceed amount due');
            return;
        }
        this.saving = true;
        try {
            await lastValueFrom(
                this._invoicesService.recordPayment(this.invoice.id, {
                    amount,
                    paidDate: this._formatDate(raw.paidDate)!,
                    method: raw.method,
                    reference: raw.reference?.trim() || null,
                    notes: raw.notes?.trim() || null,
                    postToLedger: this.postToLedger,
                })
            );
            this._toast.success('Payment recorded');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to record payment');
        } finally {
            this.saving = false;
        }
    }

    private _formatDate(d: Date | string | null): string | null {
        if (!d) return null;
        const date = d instanceof Date ? d : new Date(d);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
