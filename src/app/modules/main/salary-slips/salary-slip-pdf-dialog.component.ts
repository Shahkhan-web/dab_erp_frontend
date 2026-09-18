import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface SalarySlipPdfDialogData {
    /**
     * Self-contained HTML for the document (from the backend). Rendered in an iframe and printed with
     * the browser's own print dialog ("Save as PDF") — the backend no longer renders a PDF itself,
     * since server-side Puppeteer rendering was prone to hanging under load.
     */
    html: string;
    /** Base filename (no extension) used if the user saves the raw HTML, e.g. "loan-3F9A2C1B". */
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
        this._objectUrl = URL.createObjectURL(new Blob([data.html], { type: 'text/html' }));
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

    /** Opens the browser print dialog for the document ("Save as PDF" produces the PDF). */
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
}
