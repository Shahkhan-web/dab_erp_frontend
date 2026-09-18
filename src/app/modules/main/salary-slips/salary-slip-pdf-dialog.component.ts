import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface SalarySlipPdfDialogData {
    blob: Blob;
    filename: string;
    /** Shown under the title when provided */
    subtitle?: string | null;
    /** Dialog heading; defaults to "Salary slip PDF". Lets other modules reuse this viewer. */
    title?: string | null;
}

@Component({
    selector: 'app-salary-slip-pdf-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './salary-slip-pdf-dialog.component.html',
    styleUrl: './salary-slip-pdf-dialog.component.scss',
})
export class SalarySlipPdfDialogComponent implements OnDestroy {
    @ViewChild('pdfFrame') private _pdfFrame?: ElementRef<HTMLIFrameElement>;

    readonly pdfSrc: SafeResourceUrl;
    private readonly _objectUrl: string;

    constructor(
        private _dialogRef: MatDialogRef<SalarySlipPdfDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: SalarySlipPdfDialogData,
        sanitizer: DomSanitizer
    ) {
        this._objectUrl = URL.createObjectURL(data.blob);
        this.pdfSrc = sanitizer.bypassSecurityTrustResourceUrl(this._objectUrl);
    }

    ngOnDestroy(): void {
        URL.revokeObjectURL(this._objectUrl);
    }

    close(): void {
        this._dialogRef.close();
    }

    get title(): string {
        return this.data.title?.trim() || 'Salary slip PDF';
    }

    /** Opens the browser print dialog for the embedded PDF (falls back to a new tab if the viewer blocks it). */
    print(): void {
        try {
            const win = this._pdfFrame?.nativeElement.contentWindow;
            if (!win) throw new Error('no frame');
            win.focus();
            win.print();
        } catch {
            window.open(this._objectUrl, '_blank');
        }
    }

    download(): void {
        const url = URL.createObjectURL(this.data.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.data.filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
