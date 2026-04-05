import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { COUNTRY_NAMES } from 'app/core/utils/countries';
import { EmployeesService } from '../employees.service';

export interface EmployeePersonalDialogData {
    employeeId: string;
}

@Component({
    selector: 'app-employee-personal-dialog',
    standalone: true,
    imports: [
        CommonModule,
        TitleCasePipe,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './employee-personal-dialog.component.html',
    styleUrls: ['./employee-personal-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeePersonalDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;

    maritalStatusOptions = ['single', 'married', 'divorced', 'widow'] as const;
    bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
    countryOptions = COUNTRY_NAMES;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<EmployeePersonalDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeePersonalDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.form = this._fb.group({
            fatherNumber: [''],
            birthplace: [''],
            nationality: [''],
            homeCountry: [''],
            maritalStatus: [''],
            bloodGroup: [''],
            familyBackground: [''],
            healthDetails: [''],
            healthInsuranceProvider: [''],
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
                fatherNumber: emp.fatherNumber ?? '',
                birthplace: emp.birthplace ?? '',
                nationality: emp.nationality ?? '',
                homeCountry: emp.homeCountry ?? '',
                maritalStatus: emp.maritalStatus ?? '',
                bloodGroup: emp.bloodGroup ?? '',
                familyBackground: emp.familyBackground ?? '',
                healthDetails: emp.healthDetails ?? '',
                healthInsuranceProvider: emp.healthInsuranceProvider ?? '',
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
            const payload = this.form.value;
            await lastValueFrom(this._employeesService.updatePersonalDetails(this.data.employeeId, payload));
            this._toast.success('Personal details updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update');
        } finally {
            this.loading = false;
        }
    }
}
