import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { EmployeesService, EmployeeExtraDocument } from '../employees.service';

export interface EmployeeDocumentsViewDialogData {
    employeeId: string;
    /** Shown in the subtitle when provided */
    employeeName?: string;
}

@Component({
    selector: 'app-employee-documents-view-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
    ],
    templateUrl: './employee-documents-view-dialog.component.html',
    styleUrls: ['./employee-documents-view-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeeDocumentsViewDialogComponent implements OnInit {
    loading = false;
    extraDocuments: EmployeeExtraDocument[] = [];

    constructor(
        private _dialogRef: MatDialogRef<EmployeeDocumentsViewDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeDocumentsViewDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {}

    ngOnInit(): void {
        this.loadDocuments();
    }

    async loadDocuments(): Promise<void> {
        this.loading = true;
        try {
            const emp = await lastValueFrom(this._employeesService.getEmployee(this.data.employeeId));
            this.extraDocuments = this._parseExtraDocuments(emp as Record<string, unknown>);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load documents');
            this.extraDocuments = [];
        } finally {
            this.loading = false;
        }
    }

    private _parseExtraDocuments(emp: Record<string, unknown>): EmployeeExtraDocument[] {
        const raw = emp['extraDocuments'] ?? emp['extra_documents'];
        if (!Array.isArray(raw)) return [];
        return raw
            .map((d: unknown) => {
                const o = d as Record<string, unknown>;
                const id = o['id'] ?? o['_id'];
                if (id == null || id === '') return null;
                return {
                    ...o,
                    id: String(id),
                    displayName: String(o['displayName'] ?? o['name'] ?? o['fileName'] ?? 'Document'),
                    mimeType: o['mimeType'] as string | undefined,
                    url: (o['url'] ?? o['fileUrl'] ?? o['downloadUrl']) as string | undefined,
                    createdAt: o['createdAt'] as string | undefined,
                } as EmployeeExtraDocument;
            })
            .filter((x): x is EmployeeExtraDocument => x !== null);
    }

    isImageExtraDoc(doc: EmployeeExtraDocument): boolean {
        const m = (doc.mimeType ?? '').toLowerCase();
        if (m.startsWith('image/')) return true;
        const n = String(doc.displayName ?? '').toLowerCase();
        return /\.(jpe?g|png|webp|gif)$/i.test(n);
    }

    extraDocIconSvg(doc: EmployeeExtraDocument): string {
        const m = (doc.mimeType ?? '').toLowerCase();
        if (m === 'application/pdf' || String(doc.displayName ?? '').toLowerCase().endsWith('.pdf')) {
            return 'heroicons_outline:document-text';
        }
        if (this.isImageExtraDoc(doc)) return 'heroicons_outline:photo';
        return 'heroicons_outline:document-arrow-up';
    }

    openExtraDoc(doc: EmployeeExtraDocument): void {
        const url = doc.url;
        if (url && typeof url === 'string') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    close(): void {
        this._dialogRef.close();
    }
}
