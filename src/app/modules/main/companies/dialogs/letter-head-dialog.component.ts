import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { Company, CompaniesService } from '../companies.service';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);
const MIN_W = 1200;
const MIN_H = 1700;
const MAX_W = 4000;
const MAX_H = 5000;

export interface LetterHeadDialogData {
    company: Company;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image'));
        };
        img.src = url;
    });
}

@Component({
    selector: 'app-letter-head-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './letter-head-dialog.component.html',
})
export class LetterHeadDialogComponent implements OnDestroy {
    @ViewChild('fileInput') private _fileInput?: ElementRef<HTMLInputElement>;

    selectedFile: File | null = null;
    previewUrl: string | null = null;
    loading = false;
    fileError: string | null = null;
    uploadDragActive = false;
    private _uploadDragDepth = 0;

    constructor(
        private _dialogRef: MatDialogRef<LetterHeadDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: LetterHeadDialogData,
        private _companiesService: CompaniesService,
        private _toast: ToastrService
    ) {}

    ngOnDestroy(): void {
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        const file = event.dataTransfer?.files?.[0];
        if (file) void this.processFile(file, null);
    }

    onFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        if (file) void this.processFile(file, input);
        else input.value = '';
    }

    clearPending(): void {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
        this.selectedFile = null;
        this.fileError = null;
        const el = this._fileInput?.nativeElement;
        if (el) el.value = '';
    }

    private async processFile(file: File, input: HTMLInputElement | null): Promise<void> {
        this.fileError = null;
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
        this.selectedFile = null;
        if (input) input.value = '';

        if (!ALLOWED_TYPES.has(file.type)) {
            this.fileError = 'Use JPEG or PNG only.';
            return;
        }
        if (file.size > MAX_BYTES) {
            this.fileError = 'File must be 5MB or smaller.';
            return;
        }

        try {
            const { width, height } = await readImageDimensions(file);
            if (width < MIN_W || height < MIN_H || width > MAX_W || height > MAX_H) {
                this.fileError = `Image must be between ${MIN_W}×${MIN_H} and ${MAX_W}×${MAX_H} pixels (got ${width}×${height}).`;
                return;
            }
            this.selectedFile = file;
            this.previewUrl = URL.createObjectURL(file);
        } catch {
            this.fileError = 'Could not read image dimensions.';
        }
    }

    cancel(): void {
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this._dialogRef.close(false);
    }

    async upload(): Promise<void> {
        const file = this.selectedFile;
        if (!file || !this.data?.company?.id) return;
        this.loading = true;
        try {
            await lastValueFrom(this._companiesService.uploadLetterHead(this.data.company.id, file));
            this._toast.success('Letter head updated');
            if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Upload failed');
        } finally {
            this.loading = false;
        }
    }
}
