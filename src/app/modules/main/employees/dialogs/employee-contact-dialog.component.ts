import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { EmployeesService } from '../employees.service';

export interface EmployeeContactDialogData {
    employeeId: string;
}

@Component({
    selector: 'app-employee-contact-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './employee-contact-dialog.component.html',
    styleUrls: ['./employee-contact-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeeContactDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<EmployeeContactDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeContactDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.form = this._fb.group({
            mobileNumber: [''],
            personalEmail: [''],
            contactEmail: [''],
            companyEmail: [''],
            uaeAddress: [''],
            currentAddress: [''],
            permanentAddress: [''],
            emergencyContact: [''],
            emergencyContactRelation: [''],
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
                mobileNumber: emp.mobileNumber ?? '',
                personalEmail: emp.personalEmail ?? '',
                contactEmail: emp.contactEmail ?? '',
                companyEmail: emp.companyEmail ?? '',
                uaeAddress: emp.uaeAddress ?? '',
                currentAddress: emp.currentAddress ?? '',
                permanentAddress: emp.permanentAddress ?? '',
                emergencyContact: emp.emergencyContact ?? '',
                emergencyContactRelation: emp.emergencyContactRelation ?? '',
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
            await lastValueFrom(this._employeesService.updateContactDetails(this.data.employeeId, this.form.value));
            this._toast.success('Contact & address details updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update');
        } finally {
            this.loading = false;
        }
    }
}
