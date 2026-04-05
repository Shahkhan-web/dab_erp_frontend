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
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { COUNTRY_NAMES } from 'app/core/utils/countries';
import { Company, CompaniesService } from '../companies/companies.service';
import { EmployeeExtraDocument, EmployeesService } from './employees.service';

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
    pendingFile: File | null = null;
    pendingPreviewUrl: string | null = null;
    uploadDisplayName = '';
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

    constructor(
        private _fb: FormBuilder,
        private _route: ActivatedRoute,
        private _router: Router,
        private _employeesService: EmployeesService,
        private _companiesService: CompaniesService,
        private _toast: ToastrService
    ) {
        this.overviewForm = this._fb.group({
            firstName: ['', Validators.required],
            middleName: [''],
            lastName: ['', Validators.required],
            employeeNameArabic: [''],
            personalNumber: [''],
            workingStatus: ['active', Validators.required],
            occupation: ['', Validators.required],
            // dateOfJoining: [null as Date | null, Validators.required],
            postingDate: [null as Date | null, Validators.required],
            referenceEmployeeName: [''],
            companyId: ['', Validators.required],
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
        this._revokePendingPreview();
        this._revokeProfilePreview();
    }

    ngOnInit(): void {
        this.employeeId = this._route.snapshot.paramMap.get('id');
        this.isEdit = !!this.employeeId;
        void this.loadCompanies();
        if (this.isEdit && this.employeeId) {
            this.loadEmployee(this.employeeId);
        }
    }

    async loadCompanies(): Promise<void> {
        try {
            this.companies = await lastValueFrom(this._companiesService.getList());
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load companies');
            this.companies = [];
        }
    }

    async loadEmployee(id: string): Promise<void> {
        this.pageLoader = true;
        try {
            const emp: any = await lastValueFrom(this._employeesService.getEmployee(id));
            this.overviewForm.patchValue({
                firstName: emp.firstName,
                middleName: emp.middleName,
                lastName: emp.lastName,
                employeeNameArabic: emp.employeeNameArabic,
                personalNumber: emp.personalNumber,
                workingStatus: emp.workingStatus ?? 'active',
                occupation: emp.occupation ?? '',
                // dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining) : null,
                postingDate: emp.postingDate ? new Date(emp.postingDate) : null,
                referenceEmployeeName: emp.referenceEmployeeName,
                companyId: emp.companyId ?? '',
            });
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
        const raw = this.overviewForm.value;
        const payload: any = {
            firstName: raw.firstName,
            middleName: raw.middleName || undefined,
            lastName: raw.lastName,
            employeeNameArabic: raw.employeeNameArabic || undefined,
            personalNumber: raw.personalNumber || undefined,
            workingStatus: raw.workingStatus,
            occupation: raw.occupation,
            // dateOfJoining: this._dateToYmd(raw.dateOfJoining),
            postingDate: this._dateToYmd(raw.postingDate),
            referenceEmployeeName: raw.referenceEmployeeName || undefined,
            companyId: raw.companyId,
        };
        try {
            if (!this.employeeId) {
                const resp: any = await lastValueFrom(this._employeesService.createEmployee(payload));
                const newId = resp?.id ?? resp?.employee?.id;
                if (!newId) throw new Error('Employee created but id was not returned');
                this.employeeId = String(newId);
                this.isEdit = true;
                this._toast.success('Employee created. You can continue to the next steps.');
                await this._router.navigate(['/main/employees', this.employeeId, 'edit'], { replaceUrl: true });
                return;
            }
            await lastValueFrom(this._employeesService.updateEmployeeOverview(this.employeeId, payload));
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

    private _revokePendingPreview(): void {
        if (this.pendingPreviewUrl) {
            URL.revokeObjectURL(this.pendingPreviewUrl);
            this.pendingPreviewUrl = null;
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
        const file = event.dataTransfer?.files?.[0];
        if (file) this.setPendingExtraDocFile(file);
    }

    onExtraDocFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file) this.setPendingExtraDocFile(file);
    }

    setPendingExtraDocFile(file: File): void {
        const err = this._validateExtraDocFile(file);
        if (err) {
            this._toast.warning(err);
            return;
        }
        this._revokePendingPreview();
        this.pendingFile = file;
        if (file.type.startsWith('image/')) {
            this.pendingPreviewUrl = URL.createObjectURL(file);
        }
        if (!this.uploadDisplayName.trim()) {
            this.uploadDisplayName = file.name.replace(/\.[^/.]+$/, '') || file.name;
        }
    }

    clearPendingExtraDoc(): void {
        this.pendingFile = null;
        this.uploadDisplayName = '';
        this._revokePendingPreview();
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

    async uploadExtraDocument(): Promise<void> {
        const id = this._requireEmployeeId();
        if (!id || !this.pendingFile) return;
        const name = this.uploadDisplayName.trim();
        if (!name) {
            this._toast.warning('Please enter a display name for the document.');
            return;
        }
        this.uploadingExtra = true;
        try {
            const resp: any = await lastValueFrom(
                this._employeesService.uploadExtraDocument(id, this.pendingFile, name)
            );
            this._toast.success('Document uploaded');
            this.clearPendingExtraDoc();
            const created = resp?.document ?? resp?.extraDocument ?? resp;
            if (created?.id) {
                this.extraDocuments = [
                    {
                        id: String(created.id),
                        displayName: String(created.displayName ?? name),
                        mimeType: created.mimeType,
                        url: created.url ?? created.fileUrl,
                        ...created,
                    },
                    ...this.extraDocuments,
                ];
            } else {
                await this.refreshExtraDocuments();
            }
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
