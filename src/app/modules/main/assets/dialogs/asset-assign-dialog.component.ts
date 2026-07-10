import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule, MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AssetsService, AcquisitionType } from '../assets.service';
import { EmployeesService, EmployeeListItem } from '../../employees/employees.service';
import { EmployeeAutocompleteSearch } from '../../employees/employee-autocomplete-search';
import { createDebouncedFilterApply } from 'app/core/utils/filter-debounce.util';

export interface AssetAssignDialogData {
    assetId: string;
    companyId?: string | null;
    companyName?: string | null;
    acquisitionType?: AcquisitionType;
    monthlyCost?: number;
}

@Component({
    selector: 'app-asset-assign-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatAutocompleteModule,
    ],
    templateUrl: './asset-assign-dialog.component.html',
})
export class AssetAssignDialogComponent implements OnInit, OnDestroy {
    form: FormGroup;
    saving = false;

    readonly employeeSearch: EmployeeAutocompleteSearch;
    private _suppressNextEmployeePanelOpen = false;

    private readonly _employeeSearchApply = createDebouncedFilterApply(() => {
        void this._scheduleEmployeeSearch();
    });

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<AssetAssignDialogComponent, boolean>,
        private _assetsService: AssetsService,
        private _employeesService: EmployeesService,
        private _toast: ToastrService,
        @Inject(MAT_DIALOG_DATA) public data: AssetAssignDialogData
    ) {
        this.employeeSearch = new EmployeeAutocompleteSearch(this._employeesService);

        this.form = this._fb.group({
            employee: [null as EmployeeListItem | string | null, Validators.required],
            assignedAt: [''],
            deductFromSalary: [true],
            assignmentNotes: [''],
        });
    }

    ngOnInit(): void {
        this.employeeSearch.setCompanyId(this.data.companyId);
        void this.employeeSearch.resetAndLoad();
    }

    ngOnDestroy(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    employeeLabel(e: EmployeeListItem): string {
        const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Employee';
        const code = e.employeeId ? `${e.employeeId} · ` : '';
        return `${code}${name}`;
    }

    displayEmployee = (value: EmployeeListItem | string | null): string => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return this.employeeLabel(value);
    };

    onEmployeeChange(value: EmployeeListItem | string | null): void {
        if (value && typeof value === 'object' && value.id) {
            this.employeeSearch.ensureInList(value);
            return;
        }
        this._employeeSearchApply.schedule();
    }

    onEmployeeOptionSelected(): void {
        this._suppressNextEmployeePanelOpen = true;
    }

    openEmployeePanel(trigger: MatAutocompleteTrigger): void {
        if (this._suppressNextEmployeePanelOpen) {
            this._suppressNextEmployeePanelOpen = false;
            return;
        }
        void this.employeeSearch.resetAndLoad(this._employeeSearchQuery()).then(() => {
            setTimeout(() => {
                trigger.updatePosition();
                trigger.openPanel();
            });
        });
    }

    onEmployeeAutocompleteOpened(auto: MatAutocomplete): void {
        this.employeeSearch.bindPanelScroll(auto);
    }

    onEmployeeAutocompleteClosed(): void {
        this.employeeSearch.unbindPanelScroll();
    }

    private _employeeSearchQuery(): string {
        const v = this.form.get('employee')?.value;
        return typeof v === 'string' ? v.trim() : '';
    }

    private async _scheduleEmployeeSearch(): Promise<void> {
        await this.employeeSearch.resetAndLoad(this._employeeSearchQuery());
    }

    cancel(): void {
        this._dialogRef.close(false);
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const employee = raw.employee as EmployeeListItem;
        if (!employee || !employee.id) {
            this._toast.error('Please select a valid employee from the autocomplete list');
            return;
        }
        if (this.data.companyId && employee.companyId && employee.companyId !== this.data.companyId) {
            this._toast.error('Selected employee does not belong to this asset company');
            return;
        }

        const payload = {
            employeeId: employee.id,
            assignedAt: raw.assignedAt ? raw.assignedAt : undefined,
            deductFromSalary: !!raw.deductFromSalary,
            assignmentNotes: raw.assignmentNotes ? String(raw.assignmentNotes).trim() : undefined,
        };

        this.saving = true;
        try {
            await lastValueFrom(this._assetsService.assignAsset(this.data.assetId, payload));
            this._toast.success('Asset assigned successfully');
            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to assign asset');
        } finally {
            this.saving = false;
        }
    }
}
