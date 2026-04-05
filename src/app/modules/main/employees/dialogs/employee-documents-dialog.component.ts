import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { EmployeesService } from '../employees.service';

export interface EmployeeDocumentsDialogData {
    employeeId: string;
}

@Component({
    selector: 'app-employee-documents-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
    ],
    templateUrl: './employee-documents-dialog.component.html',
    styleUrls: ['./employee-documents-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeeDocumentsDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<EmployeeDocumentsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeDocumentsDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.form = this._fb.group({
            passportNumber: [''],
            passportPlaceOfIssue: [''],
            passportIssueDate: [null as Date | null],
            passportExpiryDate: [null as Date | null],
            passportStatus: [''],
            homeCountryAddress: [''],
            homeCountryIdCardNumber: [''],
            homeCountryIdCardExpDate: [null as Date | null],
        });
    }

    ngOnInit(): void {
        this.loadEmployee();
    }

    async loadEmployee(): Promise<void> {
        this.loading = true;
        try {
            const emp: any = await lastValueFrom(this._employeesService.getEmployee(this.data.employeeId));
            this.form.patchValue({
                passportNumber: emp.passportNumber ?? '',
                passportPlaceOfIssue: emp.passportPlaceOfIssue ?? '',
                passportIssueDate: emp.passportIssueDate ? new Date(emp.passportIssueDate) : null,
                passportExpiryDate: emp.passportExpiryDate ? new Date(emp.passportExpiryDate) : null,
                passportStatus: emp.passportStatus ?? '',
                homeCountryAddress: emp.homeCountryAddress ?? '',
                homeCountryIdCardNumber: emp.homeCountryIdCardNumber ?? '',
                homeCountryIdCardExpDate: emp.homeCountryIdCardExpDate ? new Date(emp.homeCountryIdCardExpDate) : null,
            });
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load employee');
        } finally {
            this.loading = false;
        }
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    async save(): Promise<void> {
        this.loading = true;
        try {
            const raw = this.form.value;
            const payload: any = { ...raw };
            ['passportIssueDate', 'passportExpiryDate', 'homeCountryIdCardExpDate'].forEach((f) => {
                if (payload[f] instanceof Date) payload[f] = payload[f].toISOString().split('T')[0];
            });
            await lastValueFrom(this._employeesService.updateDocumentsDetails(this.data.employeeId, payload));
            this._toast.success('Passport & home country ID details updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update');
        } finally {
            this.loading = false;
        }
    }
}
