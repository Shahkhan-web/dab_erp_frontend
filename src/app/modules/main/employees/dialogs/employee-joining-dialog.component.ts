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

export interface EmployeeJoiningDialogData {
    employeeId: string;
}

@Component({
    selector: 'app-employee-joining-dialog',
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
    templateUrl: './employee-joining-dialog.component.html',
    styleUrls: ['./employee-joining-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class EmployeeJoiningDialogComponent implements OnInit {
    form: FormGroup;
    loading = false;

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<EmployeeJoiningDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeJoiningDialogData,
        private _employeesService: EmployeesService,
        private _toast: ToastrService
    ) {
        this.form = this._fb.group({
            joiningDate: [null as Date | null],
            confirmationDate: [null as Date | null],
            noticeDays: [null as number | null],
            offerDate: [null as Date | null],
            contractEndDate: [null as Date | null],
            dateOfRetirement: [null as Date | null],
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
                joiningDate: emp.joiningDate ? new Date(emp.joiningDate) : null,
                confirmationDate: emp.confirmationDate ? new Date(emp.confirmationDate) : null,
                noticeDays: emp.noticeDays ?? null,
                offerDate: emp.offerDate ? new Date(emp.offerDate) : null,
                contractEndDate: emp.contractEndDate ? new Date(emp.contractEndDate) : null,
                dateOfRetirement: emp.dateOfRetirement ? new Date(emp.dateOfRetirement) : null,
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
            ['joiningDate', 'confirmationDate', 'offerDate', 'contractEndDate', 'dateOfRetirement'].forEach((f) => {
                if (payload[f] instanceof Date) payload[f] = payload[f].toISOString().split('T')[0];
            });
            await lastValueFrom(this._employeesService.updateJoiningDetails(this.data.employeeId, payload));
            this._toast.success('Joining details updated');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update');
        } finally {
            this.loading = false;
        }
    }
}
