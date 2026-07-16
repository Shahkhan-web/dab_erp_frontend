import { CommonModule, DatePipe } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
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
    attachmentsForLoanStep,
    LOAN_ATTACHMENT_ACCEPT_ATTR,
    LOAN_ATTACHMENT_MAX_BYTES,
    LOAN_ATTACHMENT_MAX_FILES_PER_UPLOAD,
    LOAN_ATTACHMENT_TIMELINE_STEPS,
    LoanAttachment,
    loanAllowsAttachmentUpload,
    LoansService,
    loanStatusChipClass,
    loanStatusLabel,
    LoanStatus,
} from './loans.service';

interface PendingLoanAttachmentItem {
    id: number;
    file: File;
    displayName: string;
    previewUrl: string | null;
}

@Component({
    selector: 'app-loan-attachments-panel',
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
    templateUrl: './loan-attachments-panel.component.html',
})
export class LoanAttachmentsPanelComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) employeeId!: string;
    @Input({ required: true }) loanId!: string;
    @Input() loanStatus = 'open';
    @Input() attachments: LoanAttachment[] = [];
    @Input() canWrite = true;
    /** When false, only the step-grouped timeline is shown (no uploader). */
    @Input() showUploader = true;
    /** Compact layout for dialogs (smaller drop zone). */
    @Input() compact = false;

    @Output() attachmentsChange = new EventEmitter<LoanAttachment[]>();

    readonly timelineSteps = LOAN_ATTACHMENT_TIMELINE_STEPS;
    readonly maxBytes = LOAN_ATTACHMENT_MAX_BYTES;
    readonly maxFilesPerUpload = LOAN_ATTACHMENT_MAX_FILES_PER_UPLOAD;
    readonly acceptAttr = LOAN_ATTACHMENT_ACCEPT_ATTR;
    readonly statusLabel = loanStatusLabel;
    readonly statusChipClass = loanStatusChipClass;
    readonly allowsAttachmentUpload = loanAllowsAttachmentUpload;

    pendingItems: PendingLoanAttachmentItem[] = [];
    uploadDragActive = false;
    uploading = false;
    deletingId: string | null = null;
    private _nextPendingId = 1;
    private _uploadDragDepth = 0;

    constructor(
        private _loansService: LoansService,
        private _toast: ToastrService
    ) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['loanStatus'] && !this.canUpload) {
            this.clearPending();
        }
    }

    ngOnDestroy(): void {
        this._revokeAllPendingPreviews();
    }

    get canUpload(): boolean {
        return this.canWrite && this.showUploader && loanAllowsAttachmentUpload(this.loanStatus);
    }

    attachmentsForStep(step: LoanStatus): LoanAttachment[] {
        return attachmentsForLoanStep(this.attachments, step);
    }

    trackByPendingId(_index: number, item: PendingLoanAttachmentItem): number {
        return item.id;
    }

    trackByAttachmentId(_index: number, item: LoanAttachment): string {
        return item.id;
    }

    formatFileSize(bytes: number | undefined): string {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n < 0) return '—';
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    isImageAttachment(att: LoanAttachment): boolean {
        const m = (att.contentType ?? '').toLowerCase();
        if (m.startsWith('image/')) return true;
        const n = String(att.displayName ?? '').toLowerCase();
        return /\.(jpe?g|png|webp|gif)$/i.test(n);
    }

    attachmentIconSvg(att: LoanAttachment): string {
        const m = (att.contentType ?? '').toLowerCase();
        if (m === 'application/pdf' || String(att.displayName ?? '').toLowerCase().endsWith('.pdf')) {
            return 'heroicons_outline:document-text';
        }
        if (this.isImageAttachment(att)) return 'heroicons_outline:photo';
        return 'heroicons_outline:document-arrow-up';
    }

    openAttachment(att: LoanAttachment): void {
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
        const arr = Array.from(files);
        if (!arr.length) return;

        let stoppedByLimit = false;
        for (const file of arr) {
            if (this.pendingItems.length >= this.maxFilesPerUpload) {
                stoppedByLimit = true;
                break;
            }
            const err = this._validateFile(file);
            if (err) {
                this._toast.warning(`${file.name}: ${err}`);
                continue;
            }
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
            const defaultName = file.name.replace(/\.[^/.]+$/, '') || file.name;
            this.pendingItems.push({
                id: this._nextPendingId++,
                file,
                displayName: defaultName,
                previewUrl,
            });
        }

        if (stoppedByLimit) {
            this._toast.warning(
                `At most ${this.maxFilesPerUpload} files per upload. Upload or remove some, then add more.`
            );
        }
    }

    removePendingItem(item: PendingLoanAttachmentItem): void {
        this._revokePendingPreview(item);
        this.pendingItems = this.pendingItems.filter((p) => p.id !== item.id);
    }

    clearPending(): void {
        this._revokeAllPendingPreviews();
    }

    pendingUploadReady(): boolean {
        return (
            this.pendingItems.length > 0 &&
            this.pendingItems.every((p) => p.displayName.trim().length > 0)
        );
    }

    /** Pending files for external upload (e.g. status dialog uploads after PATCH). */
    getPendingUploadBatch(): { files: File[]; displayNames: string[] } | null {
        if (!this.pendingUploadReady()) return null;
        return {
            files: this.pendingItems.map((p) => p.file),
            displayNames: this.pendingItems.map((p) => p.displayName.trim()),
        };
    }

    async uploadPending(): Promise<boolean> {
        const batch = this.getPendingUploadBatch();
        if (!batch || !this.employeeId || !this.loanId) return false;
        this.uploading = true;
        try {
            const resp: unknown = await lastValueFrom(
                this._loansService.uploadLoanAttachments(
                    this.employeeId,
                    this.loanId,
                    batch.files,
                    batch.displayNames
                )
            );
            const n = batch.files.length;
            this._toast.success(n === 1 ? 'Document uploaded' : `${n} documents uploaded`);
            const created = this._parseUploadedAttachments(resp);
            if (created.length) {
                this._emitAttachments([...created, ...this.attachments]);
            } else {
                await this.refreshAttachments();
            }
            this.clearPending();
            return true;
        } catch (e: unknown) {
            const err = e as { error?: { message?: string } };
            this._toast.error(err?.error?.message || 'Upload failed');
            return false;
        } finally {
            this.uploading = false;
        }
    }

    async deleteAttachment(att: LoanAttachment): Promise<void> {
        if (!this.canWrite || !loanAllowsAttachmentUpload(this.loanStatus)) return;
        if (!this.employeeId || !this.loanId || !att?.id) return;
        this.deletingId = att.id;
        try {
            await lastValueFrom(
                this._loansService.deleteLoanAttachment(this.employeeId, this.loanId, att.id)
            );
            this._toast.success('Document removed');
            this._emitAttachments(this.attachments.filter((a) => a.id !== att.id));
        } catch (e: unknown) {
            const err = e as { error?: { message?: string } };
            this._toast.error(err?.error?.message || 'Delete failed');
        } finally {
            this.deletingId = null;
        }
    }

    async refreshAttachments(): Promise<void> {
        if (!this.employeeId || !this.loanId) return;
        try {
            const list = await lastValueFrom(
                this._loansService.getLoanAttachments(this.employeeId, this.loanId)
            );
            this._emitAttachments(Array.isArray(list) ? list : []);
        } catch {
            /* keep existing list */
        }
    }

    private _emitAttachments(list: LoanAttachment[]): void {
        this.attachments = list;
        this.attachmentsChange.emit(list);
    }

    private _parseUploadedAttachments(resp: unknown): LoanAttachment[] {
        const r = resp as Record<string, unknown>;
        const raw =
            (Array.isArray(resp) ? resp : null) ??
            (Array.isArray(r?.['attachments']) ? r['attachments'] : null) ??
            (Array.isArray(r?.['data']) ? r['data'] : null);
        if (!Array.isArray(raw)) {
            const single = r?.['attachment'] ?? r?.['data'];
            if (single && typeof single === 'object' && (single as LoanAttachment).id) {
                return [single as LoanAttachment];
            }
            return [];
        }
        return raw
            .map((item) => this._normalizeAttachment(item))
            .filter((a): a is LoanAttachment => !!a?.id);
    }

    private _normalizeAttachment(raw: unknown): LoanAttachment | null {
        if (!raw || typeof raw !== 'object') return null;
        const o = raw as Record<string, unknown>;
        const id = o['id'] ?? o['_id'];
        if (!id) return null;
        return {
            id: String(id),
            step: String(o['step'] ?? 'open'),
            displayName: String(o['displayName'] ?? o['name'] ?? 'Document'),
            contentType: o['contentType'] != null ? String(o['contentType']) : undefined,
            fileSize: o['fileSize'] != null ? Number(o['fileSize']) : undefined,
            downloadUrl:
                o['downloadUrl'] != null
                    ? String(o['downloadUrl'])
                    : o['url'] != null
                      ? String(o['url'])
                      : undefined,
            uploadedByUserId:
                o['uploadedByUserId'] != null ? String(o['uploadedByUserId']) : undefined,
            uploadedByName: o['uploadedByName'] != null ? String(o['uploadedByName']) : undefined,
            createdAt: o['createdAt'] != null ? String(o['createdAt']) : undefined,
        };
    }

    private _validateFile(file: File): string | null {
        if (file.size > this.maxBytes) {
            return `File must be at most ${Math.round(this.maxBytes / (1024 * 1024))} MB.`;
        }
        const okMime =
            !file.type ||
            ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
                file.type
            );
        const lower = file.name.toLowerCase();
        const okExt = /\.(pdf|jpe?g|png|webp|gif)$/i.test(lower);
        if (!okMime && !okExt) {
            return 'Allowed types: PDF, JPEG, PNG, WebP, GIF.';
        }
        return null;
    }

    private _revokePendingPreview(item: PendingLoanAttachmentItem): void {
        if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = null;
        }
    }

    private _revokeAllPendingPreviews(): void {
        for (const p of this.pendingItems) {
            this._revokePendingPreview(p);
        }
        this.pendingItems = [];
    }
}
