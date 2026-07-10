import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { COUNTRY_NAMES } from 'app/core/utils/countries';
import { Company, CompaniesService } from '../companies/companies.service';
import { EmployeeExtraDocument, EmployeesService } from './employees.service';

/** Queued file + label for step 7 before POST /extra-documents. */
interface PendingExtraDocItem {
    id: number;
    file: File;
    displayName: string;
    previewUrl: string | null;
}

@Component({
    selector: 'app-employee-form',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatStepperModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        OverlayLoaderDirective,
    ],
    templateUrl: './employee-form.component.html',
})
export class EmployeeFormComponent implements OnInit, OnDestroy {
    pageLoader = false;
    isEdit = false;
    employeeId: string | null = null;

    overviewForm: FormGroup;
    personalForm: FormGroup;
    contactForm: FormGroup;
    joiningForm: FormGroup;
    salaryForm: FormGroup;
    documentsForm: FormGroup;
    /** Empty group so the extra-documents step never blocks the stepper. */
    extraDocsStepForm: FormGroup;

    saving = {
        overview: false,
        personal: false,
        contact: false,
        joining: false,
        salary: false,
        documents: false,
    };

    /** Max 15MB per API; PDF + common images. */
    readonly extraDocMaxBytes = 15 * 1024 * 1024;
    /** Max files per multipart request (API). */
    readonly extraDocMaxFilesPerUpload = 30;
    readonly extraDocAcceptAttr = '.pdf,.jpg,.jpeg,.png,.webp,.gif';

    /** Profile picture: max 5MB; images only (API). */
    readonly profilePictureMaxBytes = 5 * 1024 * 1024;
    readonly profilePictureAcceptAttr = '.jpg,.jpeg,.png,.webp,.gif';

    profilePictureUrl: string | null = null;
    profileAvatarDragActive = false;
    private _profileAvatarDragDepth = 0;
    pendingProfileFile: File | null = null;
    pendingProfilePreviewUrl: string | null = null;
    uploadingProfilePicture = false;
    removingProfilePicture = false;

    extraDocuments: EmployeeExtraDocument[] = [];
    pendingExtraDocs: PendingExtraDocItem[] = [];
    private _nextPendingExtraId = 1;
    uploadDragActive = false;
    uploadingExtra = false;
    private _uploadDragDepth = 0;

    renamingDocId: string | null = null;
    renameDraft = '';
    deletingDocId: string | null = null;

    maritalStatusOptions = ['single', 'married', 'divorced', 'widow'] as const;
    bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
    countryOptions = COUNTRY_NAMES;

    /** API enum values for `occupation` */
    occupationOptions = [
        { value: 'bicyclist', label: 'Bicyclist' },
        { value: 'bike rider', label: 'Bike rider' },
        { value: 'staff', label: 'Staff' },
    ] as const;

    companies: Company[] = [];

    /** Occupation loaded from API — used to warn when edit changes occupation without updating employee ID. */
    private _initialOccupation: string | null = null;

    /**
     * Mat datepicker filter: on **create**, managers may pick only today.
     * On **edit**, posting date is read-only (backend value); filter is not applied.
     */
    postingDatePickerFilter = (d: Date | null): boolean => {
        if (!this.isManagerRole || this.isEdit) {
            return true;
        }
        if (!d) {
            return false;
        }
        return this._isSameCalendarDay(d, this._startOfLocalToday());
    };

    constructor(
        private _fb: FormBuilder,
        private _route: ActivatedRoute,
        private _router: Router,
        private _employeesService: EmployeesService,
        private _companiesService: CompaniesService,
        private _toast: ToastrService,
        private _auth: AuthService
    ) {
        this.overviewForm = this._fb.group({
            firstName: ['', Validators.required],
            middleName: [''],
            lastName: ['', Validators.required],
            employeeNameArabic: [''],
            personalNumber: [''],
            riderId: [''],
            workingStatus: ['active', Validators.required],
            occupation: ['', Validators.required],
            // dateOfJoining: [null as Date | null, Validators.required],
            postingDate: [null as Date | null, Validators.required],
            referenceEmployeeName: [''],
            companyId: ['', Validators.required],
            /** Human-readable code from API, e.g. `{employeeIdPrefix}-{index}` — read-only when editing. */
            employeeId: [{ value: '', disabled: true }],
            employeeIdIndex: [null as number | null],
        });

        this.personalForm = this._fb.group({
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

        this.contactForm = this._fb.group({
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

        this.joiningForm = this._fb.group({
            confirmationDate: [null as Date | null],
            noticeDays: [null as number | null],
            offerDate: [null as Date | null],
            contractEndDate: [null as Date | null],
            dateOfRetirement: [null as Date | null],
        });

        this.salaryForm = this._fb.group({
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

        this.documentsForm = this._fb.group({
            passportNumber: [''],
            passportPlaceOfIssue: [''],
            passportIssueDate: [null as Date | null],
            passportExpiryDate: [null as Date | null],
            passportStatus: [''],
            homeCountryAddress: [''],
            homeCountryIdCardNumber: [''],
            homeCountryIdCardExpDate: [null as Date | null],
        });

        this.extraDocsStepForm = this._fb.group({});
    }

    ngOnDestroy(): void {
        this._revokeAllPendingExtraPreviews();
        this._revokeProfilePreview();
    }

    ngOnInit(): void {
        this.employeeId = this._route.snapshot.paramMap.get('id');
        this.isEdit = !!this.employeeId;

        const idxCtrl = this.overviewForm.get('employeeIdIndex');
        if (!this.isEdit) {
            // Optional on create: backend assigns employee id when omitted. Min applies only when a value is entered.
            idxCtrl?.addValidators([Validators.min(1)]);
        }
        idxCtrl?.updateValueAndValidity({ emitEvent: false });

        this.overviewForm.get('companyId')?.valueChanges.subscribe((companyId: string) => {
            const ctrl = this.overviewForm.get('employeeIdIndex');
            if (!ctrl) return;
            if (companyId) {
                ctrl.enable({ emitEvent: false });
            } else {
                ctrl.disable({ emitEvent: false });
                ctrl.setValue(null, { emitEvent: false });
            }
        });
        if (!this.overviewForm.get('companyId')?.value) {
            idxCtrl?.disable({ emitEvent: false });
        }

        if (!this.isEdit && this.isManagerRole) {
            this.overviewForm.patchValue({ postingDate: this._startOfLocalToday() }, { emitEvent: false });
        }

        void (async () => {
            await this.loadCompanies();
            if (this.isEdit && this.employeeId) {
                await this.loadEmployee(this.employeeId);
            }
        })();
    }

    get isManagerRole(): boolean {
        return this._auth.profileData?.role === 'manager';
    }

    /** Min posting date for Material picker: manager **create** only (today). */
    get postingDateMin(): Date | null {
        if (!this.isManagerRole || this.isEdit) {
            return null;
        }
        return this._startOfLocalToday();
    }

    /** Max posting date for Material picker: manager **create** only (today). */
    get postingDateMax(): Date | null {
        if (!this.isManagerRole || this.isEdit) {
            return null;
        }
        return this._endOfLocalToday();
    }

    /** `employeeIdPrefix` from the company selected in overview (for Employee ID display). */
    get selectedEmployeeIdPrefix(): string {
        const id = this.overviewForm.get('companyId')?.value as string | undefined;
        if (!id) return '';
        return this.companies.find((c) => c.id === id)?.employeeIdPrefix?.trim() ?? '';
    }

    get isStaffOccupationSelected(): boolean {
        return String(this.overviewForm.get('occupation')?.value ?? '').trim().toLowerCase() === 'staff';
    }

    /** Prefix segment shown before the numeric index input (`DXB-` or `DXB-STAFF-`). */
    get selectedEmployeeIdInputPrefix(): string {
        const prefix = this.selectedEmployeeIdPrefix;
        if (!prefix) return '';
        return this.isStaffOccupationSelected ? `${prefix}-STAFF-` : `${prefix}-`;
    }

    /** Hint for auto-assigned employee ID format on create. */
    get employeeIdFormatHint(): string | null {
        const companySelected = !!this.overviewForm.get('companyId')?.value;
        if (!companySelected) {
            return 'Select a company to see the employee ID format';
        }
        const prefix = this.selectedEmployeeIdPrefix || 'DXB';
        if (this.isStaffOccupationSelected) {
            return `Employee ID will be assigned as ${prefix}-STAFF-01 (staff sequence; auto-assigned if empty)`;
        }
        return `Employee ID will be assigned as ${prefix}-01 (rider sequence; auto-assigned if empty)`;
    }

    /** Preview of the full code when a numeric index is entered. */
    get employeeIdIndexPreview(): string | null {
        const idx = this.overviewForm.get('employeeIdIndex')?.value as number | string | null | undefined;
        if (idx === null || idx === undefined || idx === '') return null;
        const n = Number(idx);
        if (!Number.isFinite(n) || n < 1) return null;
        const prefix = this.selectedEmployeeIdPrefix || 'DXB';
        const nn = String(Math.trunc(n)).padStart(2, '0');
        return this.isStaffOccupationSelected ? `${prefix}-STAFF-${nn}` : `${prefix}-${nn}`;
    }

    /** True when occupation was changed on edit — assigned ID is not auto-updated. */
    get showOccupationChangeWarning(): boolean {
        if (!this.isEdit || this._initialOccupation == null) return false;
        const current = String(this.overviewForm.get('occupation')?.value ?? '').trim();
        return current !== this._initialOccupation;
    }

    async loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load companies');
            this.companies = [];
        }
    }

    /**
     * Sets read-only `employeeId` (display code) and `employeeIdIndex` from GET /employee (or equivalent) payload.
     */
    private _syncOverviewAssignedEmployeeIdFromEmployee(emp: any): void {
        const companyId = emp.companyId ?? (this.overviewForm.get('companyId')?.value as string) ?? '';
        const prefix =
            this.companies.find((c) => c.id === companyId)?.employeeIdPrefix?.trim() ?? '';
        const displayCode = typeof emp.employeeId === 'string' ? emp.employeeId : '';
        const indexFromDisplay = this._indexFromEmployeeDisplayCode(displayCode, prefix);
        const indexFromField =
            emp.employeeIdIndex != null && emp.employeeIdIndex !== ''
                ? Number(emp.employeeIdIndex)
                : null;
        const resolvedIndex =
            indexFromDisplay != null && !Number.isNaN(indexFromDisplay)
                ? indexFromDisplay
                : indexFromField != null && !Number.isNaN(indexFromField)
                  ? indexFromField
                  : null;

        const empIdCtrl = this.overviewForm.get('employeeId');
        empIdCtrl?.enable({ emitEvent: false });
        try {
            this.overviewForm.patchValue(
                { employeeId: displayCode, employeeIdIndex: resolvedIndex },
                { emitEvent: false }
            );
        } finally {
            empIdCtrl?.disable({ emitEvent: false });
        }
        if (companyId) {
            this.overviewForm.get('employeeIdIndex')?.enable({ emitEvent: false });
        } else {
            this.overviewForm.get('employeeIdIndex')?.disable({ emitEvent: false });
        }
    }

    async loadEmployee(id: string): Promise<void> {
        this.pageLoader = true;
        try {
            const emp: any = await lastValueFrom(this._employeesService.getEmployee(id));
            const companyId = emp.companyId ?? '';

            this.overviewForm.patchValue(
                {
                    firstName: emp.firstName,
                    middleName: emp.middleName,
                    lastName: emp.lastName,
                    employeeNameArabic: emp.employeeNameArabic,
                    personalNumber: emp.personalNumber,
                    riderId: emp.riderId ?? '',
                    workingStatus: emp.workingStatus ?? 'active',
                    occupation: emp.occupation ?? '',
                    // dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining) : null,
                    postingDate: emp.postingDate ? new Date(emp.postingDate) : null,
                    referenceEmployeeName: emp.referenceEmployeeName,
                    companyId,
                },
                { emitEvent: false }
            );
            this._syncOverviewAssignedEmployeeIdFromEmployee(emp);
            this._initialOccupation = emp.occupation ?? '';

            const postingCtrl = this.overviewForm.get('postingDate');
            if (this.isManagerRole && this.isEdit) {
                postingCtrl?.disable({ emitEvent: false });
            } else {
                postingCtrl?.enable({ emitEvent: false });
            }

            this.personalForm.patchValue({
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
            this.contactForm.patchValue({
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
            this.joiningForm.patchValue({
                confirmationDate: emp.confirmationDate ? new Date(emp.confirmationDate) : null,
                noticeDays: emp.noticeDays ?? null,
                offerDate: emp.offerDate ? new Date(emp.offerDate) : null,
                contractEndDate: emp.contractEndDate ? new Date(emp.contractEndDate) : null,
                dateOfRetirement: emp.dateOfRetirement ? new Date(emp.dateOfRetirement) : null,
            });
            this.salaryForm.patchValue({
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
            this.documentsForm.patchValue({
                passportNumber: emp.passportNumber ?? '',
                passportPlaceOfIssue: emp.passportPlaceOfIssue ?? '',
                passportIssueDate: emp.passportIssueDate ? new Date(emp.passportIssueDate) : null,
                passportExpiryDate: emp.passportExpiryDate ? new Date(emp.passportExpiryDate) : null,
                passportStatus: emp.passportStatus ?? '',
                homeCountryAddress: emp.homeCountryAddress ?? '',
                homeCountryIdCardNumber: emp.homeCountryIdCardNumber ?? '',
                homeCountryIdCardExpDate: emp.homeCountryIdCardExpDate ? new Date(emp.homeCountryIdCardExpDate) : null,
            });
            this._applyExtraDocumentsFromEmployee(emp);
            this._applyProfilePictureFromEmployee(emp);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load employee');
        } finally {
            this.pageLoader = false;
        }
    }

    private _startOfLocalToday(): Date {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    private _endOfLocalToday(): Date {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }

    private _isSameCalendarDay(a: Date, b: Date): boolean {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    /**
     * Parses the numeric index from the stored employee display id
     * (`PREFIX-NN` for riders, `PREFIX-STAFF-NN` for staff).
     */
    private _indexFromEmployeeDisplayCode(displayId: unknown, prefix: string): number | null {
        if (typeof displayId !== 'string' || !displayId.trim() || !prefix?.trim()) {
            return null;
        }
        const id = displayId.trim();
        const p = prefix.trim();
        const staffPrefix = `${p}-STAFF-`;
        if (id.startsWith(staffPrefix)) {
            const tail = id.slice(staffPrefix.length);
            const n = Number(tail);
            return Number.isFinite(n) ? n : null;
        }
        const withHyphen = `${p}-`;
        if (id.startsWith(withHyphen)) {
            const tail = id.slice(withHyphen.length);
            if (tail.toUpperCase().startsWith('STAFF-')) {
                return null;
            }
            const n = Number(tail);
            return Number.isFinite(n) ? n : null;
        }
        if (id.startsWith(p) && id.length > p.length) {
            let tail = id.slice(p.length);
            if (tail.startsWith('-')) {
                tail = tail.slice(1);
            }
            if (tail.toUpperCase().startsWith('STAFF-')) {
                const staffTail = tail.slice('STAFF-'.length);
                if (staffTail.startsWith('-')) {
                    const n = Number(staffTail.slice(1));
                    return Number.isFinite(n) ? n : null;
                }
                return null;
            }
            const n = Number(tail);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }

    private _dateToYmd(value: unknown): string | null {
        if (!value) return null;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        if (typeof value === 'string') return value;
        return null;
    }

    private _requireEmployeeId(): string | null {
        if (!this.employeeId) {
            this._toast.info('Please create the employee first (Step 1).');
            return null;
        }
        return this.employeeId;
    }

    async saveOverview(): Promise<void> {
        if (this.overviewForm.invalid) {
            this.overviewForm.markAllAsTouched();
            return;
        }
        this.saving.overview = true;
        const raw = this.overviewForm.getRawValue();
        const payload: any = {
            firstName: raw.firstName,
            middleName: raw.middleName || undefined,
            lastName: raw.lastName,
            employeeNameArabic: raw.employeeNameArabic || undefined,
            personalNumber: raw.personalNumber || undefined,
            riderId: raw.riderId || undefined,
            workingStatus: raw.workingStatus,
            occupation: raw.occupation,
            // dateOfJoining: this._dateToYmd(raw.dateOfJoining),
            postingDate: this._dateToYmd(
                this.isManagerRole && !this.employeeId ? this._startOfLocalToday() : raw.postingDate
            ),
            referenceEmployeeName: raw.referenceEmployeeName || undefined,
            companyId: raw.companyId,
        };
        const idx = raw.employeeIdIndex as number | string | null | undefined;
        if (idx !== null && idx !== undefined && idx !== '') {
            const n = Number(idx);
            if (!Number.isNaN(n)) {
                payload.employeeIdIndex = n;
            }
        }
        try {
            if (!this.employeeId) {
                const resp: any = await lastValueFrom(this._employeesService.createEmployee(payload));
                const newId = resp?.id ?? resp?.employee?.id;
                if (!newId) throw new Error('Employee created but id was not returned');
                this.employeeId = String(newId);
                this.isEdit = true;
                this._initialOccupation = raw.occupation ?? '';
                this._toast.success('Employee created. You can continue to the next steps.');
                await this._router.navigate(['/main/employees', this.employeeId, 'edit'], { replaceUrl: true });
                return;
            }
            await lastValueFrom(this._employeesService.updateEmployeeOverview(this.employeeId, payload));
            const prevOccupation = this._initialOccupation;
            const nextOccupation = raw.occupation ?? '';
            const occupationCategoryChanged =
                (prevOccupation?.trim().toLowerCase() === 'staff') !==
                (String(nextOccupation).trim().toLowerCase() === 'staff');
            this._initialOccupation = nextOccupation;
            try {
                const refreshed: any = await lastValueFrom(
                    this._employeesService.getEmployee(this.employeeId)
                );
                this._syncOverviewAssignedEmployeeIdFromEmployee(refreshed);
                if (occupationCategoryChanged) {
                    this._toast.info(
                        'Occupation updated. The assigned employee ID was not changed automatically — set Employee ID index to assign a new code.'
                    );
                }
            } catch {
                // Assigned ID in the form may be stale; overview fields were still saved.
            }
            this._toast.success('Overview updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || e?.message || 'Failed to save overview');
        } finally {
            this.saving.overview = false;
        }
    }

    async savePersonal(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.saving.personal = true;
        try {
            await lastValueFrom(this._employeesService.updatePersonalDetails(id, this.personalForm.value));
            this._toast.success('Personal details updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update personal details');
        } finally {
            this.saving.personal = false;
        }
    }

    async saveContact(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.saving.contact = true;
        try {
            await lastValueFrom(this._employeesService.updateContactDetails(id, this.contactForm.value));
            this._toast.success('Contact & address details updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update contact details');
        } finally {
            this.saving.contact = false;
        }
    }

    async saveJoining(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.saving.joining = true;
        try {
            const raw = this.joiningForm.value;
            const payload: any = { ...raw };
            ['confirmationDate', 'offerDate', 'contractEndDate', 'dateOfRetirement'].forEach((f) => {
                payload[f] = this._dateToYmd(payload[f]);
            });
            await lastValueFrom(this._employeesService.updateJoiningDetails(id, payload));
            this._toast.success('Joining details updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update joining details');
        } finally {
            this.saving.joining = false;
        }
    }

    async saveSalary(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.saving.salary = true;
        try {
            await lastValueFrom(this._employeesService.updateSalaryDetails(id, this.salaryForm.value));
            this._toast.success('Salary & sponsorship details updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update salary details');
        } finally {
            this.saving.salary = false;
        }
    }

    async saveDocuments(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.saving.documents = true;
        try {
            const raw = this.documentsForm.value;
            const payload: any = { ...raw };
            ['passportIssueDate', 'passportExpiryDate', 'homeCountryIdCardExpDate'].forEach((f) => {
                payload[f] = this._dateToYmd(payload[f]);
            });
            await lastValueFrom(this._employeesService.updateDocumentsDetails(id, payload));
            this._toast.success('Passport & documents updated');
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to update documents');
        } finally {
            this.saving.documents = false;
        }
    }

    cancel(): void {
        this._router.navigate(['/main/employees']);
    }

    // —— Extra documents (step 7) ——

    private _applyProfilePictureFromEmployee(emp: Record<string, unknown>): void {
        const u =
            emp['profilePictureUrl'] ??
            emp['profilePicture'] ??
            emp['profileImageUrl'] ??
            emp['avatarUrl'] ??
            emp['avatar'];
        this.profilePictureUrl = typeof u === 'string' && u.trim() ? u.trim() : null;
    }

    private _applyExtraDocumentsFromEmployee(emp: Record<string, unknown>): void {
        const raw = emp['extraDocuments'] ?? emp['extra_documents'];
        if (!Array.isArray(raw)) {
            this.extraDocuments = [];
            return;
        }
        this.extraDocuments = raw
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

    private _revokeAllPendingExtraPreviews(): void {
        for (const p of this.pendingExtraDocs) {
            if (p.previewUrl) {
                URL.revokeObjectURL(p.previewUrl);
                p.previewUrl = null;
            }
        }
        this.pendingExtraDocs = [];
    }

    private _revokePendingItemPreview(item: PendingExtraDocItem): void {
        if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = null;
        }
    }

    private _revokeProfilePreview(): void {
        if (this.pendingProfilePreviewUrl) {
            URL.revokeObjectURL(this.pendingProfilePreviewUrl);
            this.pendingProfilePreviewUrl = null;
        }
    }

    private _validateProfilePictureFile(file: File): string | null {
        if (file.size > this.profilePictureMaxBytes) {
            return `Photo must be at most ${this.profilePictureMaxBytes / (1024 * 1024)} MB.`;
        }
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const okMime = !file.type || allowed.includes(file.type);
        const okExt = /\.(jpe?g|png|webp|gif)$/i.test(file.name);
        if (!okMime && !okExt) {
            return 'Use JPEG, PNG, WebP, or GIF.';
        }
        return null;
    }

    private _validateExtraDocFile(file: File): string | null {
        if (file.size > this.extraDocMaxBytes) {
            return `File must be at most ${Math.round(this.extraDocMaxBytes / (1024 * 1024))} MB.`;
        }
        const okMime =
            !file.type ||
            [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/gif',
            ].includes(file.type);
        const lower = file.name.toLowerCase();
        const okExt = /\.(pdf|jpe?g|png|webp|gif)$/i.test(lower);
        if (!okMime && !okExt) {
            return 'Allowed types: PDF, JPEG, PNG, WebP, GIF.';
        }
        return null;
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    onUploadDragEnter(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth++;
        this.uploadDragActive = true;
    }

    onUploadDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth = Math.max(0, this._uploadDragDepth - 1);
        if (this._uploadDragDepth === 0) this.uploadDragActive = false;
    }

    onUploadDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onUploadDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._uploadDragDepth = 0;
        this.uploadDragActive = false;
        const list = event.dataTransfer?.files;
        if (list?.length) this.addPendingExtraDocFiles(list);
    }

    onExtraDocFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const files = input.files;
        input.value = '';
        if (files?.length) this.addPendingExtraDocFiles(files);
    }

    trackByPendingExtraId(_index: number, item: PendingExtraDocItem): number {
        return item.id;
    }

    addPendingExtraDocFiles(files: FileList | File[]): void {
        const arr = Array.from(files);
        if (!arr.length) return;

        let stoppedByLimit = false;

        for (const file of arr) {
            if (this.pendingExtraDocs.length >= this.extraDocMaxFilesPerUpload) {
                stoppedByLimit = true;
                break;
            }
            const err = this._validateExtraDocFile(file);
            if (err) {
                this._toast.warning(`${file.name}: ${err}`);
                continue;
            }
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
            const defaultName = file.name.replace(/\.[^/.]+$/, '') || file.name;
            this.pendingExtraDocs.push({
                id: this._nextPendingExtraId++,
                file,
                displayName: defaultName,
                previewUrl,
            });
        }

        if (stoppedByLimit) {
            this._toast.warning(
                `At most ${this.extraDocMaxFilesPerUpload} files per upload. Upload or remove some, then add more.`
            );
        }
    }

    removePendingExtraDocItem(item: PendingExtraDocItem): void {
        this._revokePendingItemPreview(item);
        this.pendingExtraDocs = this.pendingExtraDocs.filter((p) => p.id !== item.id);
    }

    clearPendingExtraDocs(): void {
        this._revokeAllPendingExtraPreviews();
    }

    /** True when there is at least one pending file and every row has a non-empty display name. */
    pendingExtraUploadReady(): boolean {
        return (
            this.pendingExtraDocs.length > 0 &&
            this.pendingExtraDocs.every((p) => p.displayName.trim().length > 0)
        );
    }

    async refreshExtraDocuments(): Promise<void> {
        const id = this.employeeId;
        if (!id) return;
        try {
            const emp: any = await lastValueFrom(this._employeesService.getEmployee(id));
            this._applyExtraDocumentsFromEmployee(emp);
        } catch {
            /* keep existing list */
        }
    }

    async refreshProfilePicture(): Promise<void> {
        const id = this.employeeId;
        if (!id) return;
        try {
            const emp: any = await lastValueFrom(this._employeesService.getEmployee(id));
            this._applyProfilePictureFromEmployee(emp);
        } catch {
            /* keep URL */
        }
    }

    onProfileAvatarDragEnter(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._profileAvatarDragDepth++;
        this.profileAvatarDragActive = true;
    }

    onProfileAvatarDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._profileAvatarDragDepth = Math.max(0, this._profileAvatarDragDepth - 1);
        if (this._profileAvatarDragDepth === 0) this.profileAvatarDragActive = false;
    }

    onProfileAvatarDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onProfileAvatarDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this._profileAvatarDragDepth = 0;
        this.profileAvatarDragActive = false;
        const file = event.dataTransfer?.files?.[0];
        if (file) this.setPendingProfilePictureFile(file);
    }

    onProfilePictureFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file) this.setPendingProfilePictureFile(file);
    }

    setPendingProfilePictureFile(file: File): void {
        const err = this._validateProfilePictureFile(file);
        if (err) {
            this._toast.warning(err);
            return;
        }
        this._revokeProfilePreview();
        this.pendingProfileFile = file;
        this.pendingProfilePreviewUrl = URL.createObjectURL(file);
    }

    clearPendingProfilePicture(): void {
        this.pendingProfileFile = null;
        this._revokeProfilePreview();
    }

    async uploadProfilePicture(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id || !this.pendingProfileFile) return;
        this.uploadingProfilePicture = true;
        try {
            const resp: any = await lastValueFrom(
                this._employeesService.uploadProfilePicture(id, this.pendingProfileFile)
            );
            this._toast.success('Profile photo updated');
            this.clearPendingProfilePicture();
            const url =
                resp?.profilePictureUrl ??
                resp?.profilePicture ??
                resp?.url ??
                resp?.fileUrl;
            if (typeof url === 'string' && url.trim()) {
                this.profilePictureUrl = url.trim();
            } else {
                await this.refreshProfilePicture();
            }
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload photo');
        } finally {
            this.uploadingProfilePicture = false;
        }
    }

    async removeProfilePicture(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.removingProfilePicture = true;
        try {
            await lastValueFrom(this._employeesService.deleteProfilePicture(id));
            this._toast.success('Profile photo removed');
            this.profilePictureUrl = null;
            this.clearPendingProfilePicture();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to remove photo');
        } finally {
            this.removingProfilePicture = false;
        }
    }

    async uploadExtraDocuments(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id || !this.pendingExtraDocs.length) return;
        if (!this.pendingExtraUploadReady()) {
            this._toast.warning('Enter a display name for every file.');
            return;
        }
        const files = this.pendingExtraDocs.map((p) => p.file);
        const displayNames = this.pendingExtraDocs.map((p) => p.displayName.trim());
        this.uploadingExtra = true;
        try {
            const resp: any = await lastValueFrom(
                this._employeesService.uploadExtraDocuments(id, files, displayNames)
            );
            const n = files.length;
            this._toast.success(n === 1 ? 'Document uploaded' : `${n} documents uploaded`);
            this.clearPendingExtraDocs();

            const rawList = Array.isArray(resp)
                ? resp
                : resp?.documents ?? resp?.extraDocuments ?? resp?.data;
            if (Array.isArray(rawList) && rawList.length) {
                const mapped: EmployeeExtraDocument[] = rawList
                    .map((created: Record<string, unknown>) => {
                        const docId = created['id'] ?? created['_id'];
                        if (docId == null || docId === '') return null;
                        return {
                            ...created,
                            id: String(docId),
                            displayName: String(
                                created['displayName'] ?? created['name'] ?? created['fileName'] ?? 'Document'
                            ),
                            mimeType: created['mimeType'] as string | undefined,
                            url: (created['url'] ?? created['fileUrl'] ?? created['downloadUrl']) as
                                | string
                                | undefined,
                        } as EmployeeExtraDocument;
                    })
                    .filter((x): x is EmployeeExtraDocument => x !== null);
                if (mapped.length) {
                    this.extraDocuments = [...mapped, ...this.extraDocuments];
                    return;
                }
            }
            const single = resp?.document ?? resp?.extraDocument;
            if (single?.id) {
                this.extraDocuments = [
                    {
                        id: String(single.id),
                        displayName: String(single.displayName ?? displayNames[0]),
                        mimeType: single.mimeType,
                        url: single.url ?? single.fileUrl,
                        ...single,
                    },
                    ...this.extraDocuments,
                ];
                return;
            }
            await this.refreshExtraDocuments();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Upload failed');
        } finally {
            this.uploadingExtra = false;
        }
    }

    openExtraDoc(doc: EmployeeExtraDocument): void {
        const url = doc.url;
        if (url && typeof url === 'string') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    startRenameExtraDoc(doc: EmployeeExtraDocument): void {
        this.renamingDocId = doc.id;
        this.renameDraft = doc.displayName ?? '';
    }

    cancelRenameExtraDoc(): void {
        this.renamingDocId = null;
        this.renameDraft = '';
    }

    async saveRenameExtraDoc(): Promise<void> {
        const id = this._requireEmployeeId();
        const docId = this.renamingDocId;
        if (!id || !docId) return;
        const name = this.renameDraft.trim();
        if (!name) {
            this._toast.warning('Name cannot be empty.');
            return;
        }
        try {
            await lastValueFrom(this._employeesService.renameExtraDocument(id, docId, name));
            this._toast.success('Document renamed');
            const d = this.extraDocuments.find((x) => x.id === docId);
            if (d) d.displayName = name;
            this.cancelRenameExtraDoc();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Rename failed');
        }
    }

    async deleteExtraDoc(doc: EmployeeExtraDocument): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id) return;
        this.deletingDocId = doc.id;
        try {
            await lastValueFrom(this._employeesService.deleteExtraDocument(id, doc.id));
            this._toast.success('Document removed');
            this.extraDocuments = this.extraDocuments.filter((x) => x.id !== doc.id);
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Delete failed');
        } finally {
            this.deletingDocId = null;
        }
    }
}
