import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import {
    INVOICE_ATTACHMENT_ACCEPT_ATTR,
    INVOICE_ATTACHMENT_MAX_FILES_PER_UPLOAD,
} from '../services/invoices.service';
import {
    defaultAttachmentDisplayName,
    validateInvoiceAttachmentFile,
} from './invoice-attachment.util';

export interface PendingAttachmentItem {
    id: number;
    file: File;
    displayName: string;
    previewUrl: string | null;
}

@Component({
    selector: 'app-invoice-attachment-picker',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
    ],
    templateUrl: './invoice-attachment-picker.component.html',
})
export class InvoiceAttachmentPickerComponent implements OnDestroy {
    readonly acceptAttr = INVOICE_ATTACHMENT_ACCEPT_ATTR;
    readonly maxFilesPerUpload = INVOICE_ATTACHMENT_MAX_FILES_PER_UPLOAD;

    pendingItems: PendingAttachmentItem[] = [];
    uploadDragActive = false;

    private _nextPendingId = 1;
    private _uploadDragDepth = 0;

    constructor(private _toast: ToastrService) {}

    ngOnDestroy(): void {
        this.clearPending();
    }

    get hasPending(): boolean {
        return this.pendingItems.length > 0;
    }

    pendingReady(): boolean {
        return this.pendingItems.length > 0 && this.pendingItems.every((p) => p.displayName.trim());
    }

    getFiles(): File[] {
        return this.pendingItems.map((p) => p.file);
    }

    getDisplayNames(): string[] {
        return this.pendingItems.map((p) => p.displayName.trim());
    }

    trackByPendingId(_index: number, item: PendingAttachmentItem): number {
        return item.id;
    }

    onUploadDragEnter(event: DragEvent): void {
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
        event.preventDefault();
        event.stopPropagation();
    }

    onUploadDrop(event: DragEvent): void {
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
        for (const file of Array.from(files)) {
            if (this.pendingItems.length >= this.maxFilesPerUpload) {
                this._toast.warning(`At most ${this.maxFilesPerUpload} files per upload.`);
                break;
            }
            const err = validateInvoiceAttachmentFile(file);
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
        for (const p of this.pendingItems) this._revokePendingPreview(p);
        this.pendingItems = [];
    }

    private _revokePendingPreview(item: PendingAttachmentItem): void {
        if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = null;
        }
    }
}
