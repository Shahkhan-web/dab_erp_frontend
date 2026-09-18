import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { CompaniesService } from '../companies/companies.service';
import {
    LetterheadChoiceDialogData,
    SalarySlipLetterheadChoiceDialogComponent,
} from '../salary-slips/salary-slip-letterhead-choice-dialog.component';
import {
    SalarySlipPdfDialogComponent,
    SalarySlipPdfDialogData,
} from '../salary-slips/salary-slip-pdf-dialog.component';
import { LoanListItem, LoansService } from './loans.service';

/**
 * Opens the printable loan form (PDF) for any loan status: asks about letterhead when the
 * employee's company has one, fetches the PDF and shows it in the shared PDF viewer.
 */
@Injectable({ providedIn: 'root' })
export class LoanPdfService {
    constructor(
        private _loansService: LoansService,
        private _companiesService: CompaniesService,
        private _matDialog: MatDialog,
        private _toast: ToastrService
    ) {}

    /** Resolves when the viewer has opened (or the user cancelled / loading failed). */
    async open(
        loan: Pick<LoanListItem, 'id' | 'employeeId' | 'loanName' | 'employeeName' | 'employeeCode' | 'employeeCompanyId'>
    ): Promise<void> {
        if (!loan?.employeeId || !loan?.id) {
            this._toast.error('Missing employee or loan id for PDF');
            return;
        }

        const letterheadAvailable = await lastValueFrom(
            this._companiesService.letterheadEnabledForCompany(loan.employeeCompanyId ?? null)
        );
        let letterhead = false;
        if (letterheadAvailable) {
            const ref = this._matDialog.open<
                SalarySlipLetterheadChoiceDialogComponent,
                LetterheadChoiceDialogData,
                boolean | undefined
            >(SalarySlipLetterheadChoiceDialogComponent, {
                data: { title: 'Loan form PDF' },
                width: 'min(96vw, 420px)',
                autoFocus: 'first-tabbable',
            });
            const choice = await firstValueFrom(ref.afterClosed());
            if (choice === undefined) {
                return;
            }
            letterhead = choice;
        }

        let html: string;
        try {
            html = await lastValueFrom(this._loansService.getLoanPdf(loan.employeeId, loan.id, letterhead));
        } catch (e: unknown) {
            this._toast.error(await errorMessage(e, 'Loan PDF could not be generated'));
            return;
        }

        const who = loan.employeeName?.trim() || loan.employeeCode || '';
        const data: SalarySlipPdfDialogData = {
            html,
            title: 'Loan form PDF',
            filename: `loan-${loan.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
            subtitle: [loan.loanName, who].filter(Boolean).join(' · '),
        };
        this._matDialog.open(SalarySlipPdfDialogComponent, {
            data,
            maxWidth: '960px',
            width: 'min(96vw, 960px)',
            height: 'calc(100dvh - 16px)',
            maxHeight: 'calc(100dvh - 16px)',
            autoFocus: 'first-tabbable',
            panelClass: 'salary-slip-pdf-dialog-panel',
        });
    }
}

/**
 * With responseType 'text', API error bodies arrive as a raw string (Angular doesn't parse them as
 * JSON for a text request) — parse out the message ourselves. Older 'blob' responses are handled too
 * for safety.
 */
async function errorMessage(e: unknown, fallback: string): Promise<string> {
    const err = (e as HttpErrorResponse)?.error;
    const raw = err instanceof Blob ? await err.text() : typeof err === 'string' ? err : null;
    if (raw != null) {
        try {
            const msg = JSON.parse(raw)?.message;
            return (Array.isArray(msg) ? msg.join(', ') : msg) || fallback;
        } catch {
            return fallback;
        }
    }
    return err?.message || fallback;
}
