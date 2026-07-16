import { CommonModule, DatePipe } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import {
    INVOICE_ATTACHMENT_ACCEPT_ATTR,
    INVOICE_ATTACHMENT_MAX_BYTES,
    INVOICE_ATTACHMENT_MAX_FILES_PER_UPLOAD,
    InvoiceAttachment,
    InvoicesService,
} from '../services/invoices.service';
import {
    defaultAttachmentDisplayName,
    validateInvoiceAttachmentFile,
} from './invoice-attachment.util';

interface PendingAttachmentItem {
    id: number;
    file: File;
    displayName: string;
    previewUrl: string | null;
}

@Component({
    selector: 'app-invoice-attachments-panel',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        DatePipe,
    ],
    templateUrl: './invoice-attachments-panel.component.html',
})
export class InvoiceAttachmentsPanelComponent implements OnDestroy {
    @Input({ required: true }) invoiceId!: string;
    @Input() attachments: InvoiceAttachment[] = [];
    @Input() canWrite = true;
    @Input() compact = false;

    @Output() attachmentsChange = new EventEmitter<void>();

    readonly maxBytes = INVOICE_ATTACHMENT_MAX_BYTES;
    readonly maxFilesPerUpload = INVOICE_ATTACHMENT_MAX_FILES_PER_UPLOAD;
    readonly acceptAttr = INVOICE_ATTACHMENT_ACCEPT_ATTR;

    pendingItems: PendingAttachmentItem[] = [];
    uploadDragActive = false;
    uploading = false;
    deletingId: string | null = null;

    private _nextPendingId = 1;
    private _uploadDragDepth = 0;

    constructor(
        private _invoicesService: InvoicesService,
        private _toast: ToastrService
    ) {}

    ngOnDestroy(): void {
        this._revokeAllPendingPreviews();
    }

    get canUpload(): boolean {
        return this.canWrite;
    }

    trackByAttachmentId(_index: number, item: InvoiceAttachment): string {
        return item.id;
    }

    trackByPendingId(_index: number, item: PendingAttachmentItem): number {
        return item.id;
    }

    formatFileSize(bytes: number | undefined): string {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n < 0) return '—';
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    openAttachment(att: InvoiceAttachment): void {
        if (!att.downloadUrl) return;
        window.open(att.downloadUrl, '_blank', 'noopener,noreferrer');
    }

    onUploadDragEnter(event: DragEvent): void {
        if (!this.canUpload) return;
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth++;
        this.uploadDragActive = true;
    }

    onUploadDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth = Math.max(0, this._uploadDragDepth - 1);
        if (this._uploadDragDepth === 0) this.uploadDragActive = false;
    }

    onUploadDragOver(event: DragEvent): void {
        if (!this.canUpload) return;
        event.preventDefault();
        event.stopPropagation();
    }

    onUploadDrop(event: DragEvent): void {
        if (!this.canUpload) return;
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth = 0;
        this.uploadDragActive = false;
        const list = event.dataTransfer?.files;
        if (list?.length) this.addPendingFiles(list);
    }

    onFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        // Copy before clearing — FileList is live and empties when value is reset.
        const files = input.files ? Array.from(input.files) : [];
        input.value = '';
        if (files.length) this.addPendingFiles(files);
    }

    addPendingFiles(files: FileList | File[]): void {
        if (!this.canUpload) return;
        for (const file of Array.from(files)) {
            if (this.pendingItems.length >= this.maxFilesPerUpload) {
                this._toast.warning(`At most ${this.maxFilesPerUpload} files per upload.`);
                break;
            }
            const err = this._validateFile(file);
            if (err) {
                this._toast.warning(`${file.name}: ${err}`);
                continue;
            }
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
            this.pendingItems.push({
                id: this._nextPendingId++,
                file,
                displayName: defaultAttachmentDisplayName(file),
                previewUrl,
            });
        }
    }

    removePendingItem(item: PendingAttachmentItem): void {
        this._revokePendingPreview(item);
        this.pendingItems = this.pendingItems.filter((p) => p.id !== item.id);
    }

    clearPending(): void {
        this._revokeAllPendingPreviews();
    }

    pendingUploadReady(): boolean {
        return this.pendingItems.length > 0 && this.pendingItems.every((p) => p.displayName.trim());
    }

    async uploadPending(): Promise<void> {
        if (!this.pendingUploadReady() || !this.invoiceId) return;
        this.uploading = true;
        try {
            await lastValueFrom(
                this._invoicesService.uploadAttachments(
                    this.invoiceId,
                    this.pendingItems.map((p) => p.file),
                    this.pendingItems.map((p) => p.displayName.trim())
                )
            );
            this._toast.success('Attachments uploaded');
            this.clearPending();
            this.attachmentsChange.emit();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Upload failed');
        } finally {
            this.uploading = false;
        }
    }

    async deleteAttachment(att: InvoiceAttachment): Promise<void> {
        if (!this.canWrite || !this.invoiceId) return;
        this.deletingId = att.id;
        try {
            await lastValueFrom(this._invoicesService.deleteAttachment(this.invoiceId, att.id));
            this._toast.success('Attachment removed');
            this.attachmentsChange.emit();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Delete failed');
        } finally {
            this.deletingId = null;
        }
    }

    private _validateFile(file: File): string | null {
        return validateInvoiceAttachmentFile(file);
    }

    private _revokePendingPreview(item: PendingAttachmentItem): void {
        if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = null;
        }
    }

    private _revokeAllPendingPreviews(): void {
        for (const p of this.pendingItems) this._revokePendingPreview(p);
        this.pendingItems = [];
    }
}
