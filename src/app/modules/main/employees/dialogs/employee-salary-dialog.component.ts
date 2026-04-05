import { CommonModule } from '@angular/common';
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
import { EmployeesService } from '../employees.service';

export interface EmployeeSalaryDialogData {
    employeeId: string;
}

@Component({
    selector: 'app-employee-salary-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './employee-salary-dialog.component.html',
    styleUrls: ['./employee-salary-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeeSalaryDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<EmployeeSalaryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeSalaryDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.form = this._fb.group({
            costToCompany: [null as number | null],
            basicSalary: [null as number | null],
            mobileAllowance: [null as number | null],
            foodAllowance: [null as number | null],
            transportationAllowance: [null as number | null],
            otherAllowance: [null as number | null],
            salaryCurrency: ['AED'],
            salaryMode: ['bank'],
            costCenter: [''],
            sponsorshipType: ['org_visa'],
            sponsorshipOrgName: [''],
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
                costToCompany: emp.costToCompany ?? null,
                basicSalary: emp.basicSalary ?? null,
                mobileAllowance: emp.mobileAllowance ?? null,
                foodAllowance: emp.foodAllowance ?? null,
                transportationAllowance: emp.transportationAllowance ?? null,
                otherAllowance: emp.otherAllowance ?? null,
                salaryCurrency: emp.salaryCurrency ?? 'AED',
                salaryMode: emp.salaryMode ?? 'bank',
                costCenter: emp.costCenter ?? '',
                sponsorshipType: emp.sponsorshipType ?? 'org_visa',
                sponsorshipOrgName: emp.sponsorshipOrgName ?? '',
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
            await lastValueFrom(this._employeesService.updateSalaryDetails(this.data.employeeId, this.form.value));
            this._toast.success('Salary & sponsorship details updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update');
        } finally {
            this.loading = false;
        }
    }
}
