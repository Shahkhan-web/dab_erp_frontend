import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from 'app/core/auth/auth.service';
import {
    defaultModuleAccess,
    getUserFormVisibleModuleKeys,
    isAdminProfile,
    mergeModuleAccess,
    ModuleAccess,
    USER_FORM_MODULE_KEYS,
    USER_FORM_MODULE_LABELS,
    UserFormModuleKey,
} from 'app/core/auth/module-access.util';
import { ToastrService } from 'ngx-toastr';
import { catchError, lastValueFrom, of } from 'rxjs';
import { UsersService, UserListItem, UserCreateUpdatePayload } from '../users.service';

export interface UserFormDialogData {
    user?: UserListItem | null;
}

@Component({
    selector: 'app-user-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent implements OnInit {
    private readonly _destroyRef = inject(DestroyRef);

    form: FormGroup;
    loading = false;
    isEdit = false;
    hidePassword = true;

    readonly profilePictureMaxBytes = 5 * 1024 * 1024;
    readonly profilePictureAcceptAttr = '.jpg,.jpeg,.png,.webp,.gif';

    profilePictureUrl: string | null = null;
    profileAvatarDragActive = false;
    private _profileAvatarDragDepth = 0;
    pendingProfileFile: File | null = null;
    pendingProfilePreviewUrl: string | null = null;
    removingProfilePicture = false;

    designations: string[] = [];
    /** Suggestions for autocomplete (subset of designations by current input). */
    filteredDesignations: string[] = [];
    designationsLoading = false;

    readonly isAdmin: boolean;
    readonly visibleModuleKeys: UserFormModuleKey[];
    readonly moduleLabels = USER_FORM_MODULE_LABELS;

    roleOptions: { value: 'admin' | 'manager'; label: string }[] = [
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Manager' },
    ];

    constructor(
        private _fb: FormBuilder,
        private _dialogRef: MatDialogRef<UserFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
        private _usersService: UsersService,
        private _toast: ToastrService,
        private _auth: AuthService
    ) {
        const profile = this._auth.profileData;
        this.isAdmin = isAdminProfile(profile);
        this.visibleModuleKeys = getUserFormVisibleModuleKeys(profile);

        if (!this.isAdmin) {
            this.roleOptions = [{ value: 'manager', label: 'Manager' }];
        }

        this.isEdit = !!data?.user;

        const moduleAccessGroup = this._fb.group(
            Object.fromEntries(
                USER_FORM_MODULE_KEYS.map((k) => [k, this._fb.group({ read: [false], write: [false] })])
            ) as Record<UserFormModuleKey, FormGroup>
        );

        this.form = this._fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: [''],
            role: ['manager' as 'admin' | 'manager', Validators.required],
            displayName: ['', Validators.required],
            designation: [''],
            moduleAccess: moduleAccessGroup,
        });

        if (this.isEdit && data.user) {
            this.form.patchValue({
                email: data.user.email ?? '',
                role: data.user.role ?? 'manager',
                displayName: data.user.displayName ?? '',
                designation: data.user.designation ?? '',
            });
            const merged = mergeModuleAccess(data.user.access ?? data.user.moduleAccess);
            for (const k of USER_FORM_MODULE_KEYS) {
                moduleAccessGroup.get(k)?.patchValue(merged[k] ?? { read: false, write: false });
            }
            this.form.get('password')?.setValidators([]);
        } else {
            this.form.get('password')?.setValidators([Validators.required]);
            const defaults = defaultModuleAccess();
            for (const k of USER_FORM_MODULE_KEYS) {
                moduleAccessGroup.get(k)?.patchValue(defaults[k] ?? { read: false, write: false });
            }
        }

        const designationCtrl = this.form.get('designation');
        designationCtrl?.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => this._refreshFilteredDesignations());
        this._refreshFilteredDesignations();

        if (this.isEdit && data.user) {
            const u = data.user.profilePictureUrl;
            this.profilePictureUrl = typeof u === 'string' && u.trim() ? u.trim() : null;
        }

        this._destroyRef.onDestroy(() => this._revokeProfilePreview());
    }

    ngOnInit(): void {
        this.loadDesignations();
    }

    private _refreshFilteredDesignations(): void {
        const raw = this.form.get('designation')?.value;
        const query = typeof raw === 'string' ? raw : '';
        const q = query.trim().toLowerCase();
        if (!q) {
            this.filteredDesignations = [...this.designations];
            return;
        }
        this.filteredDesignations = this.designations.filter((d) => d.toLowerCase().includes(q));
    }

    private loadDesignations(): void {
        this.designationsLoading = true;
        this._usersService
            .getDesignations()
            .pipe(catchError(() => of([] as string[])))
            .subscribe((list) => {
                const merged = [...list];
                const current = this.data?.user?.designation?.trim();
                if (current && !merged.includes(current)) {
                    merged.push(current);
                }
                merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                this.designations = merged;
                this.designationsLoading = false;
                this._refreshFilteredDesignations();
            });
    }

    moduleGroup(key: UserFormModuleKey): FormGroup {
        return this.form.get('moduleAccess')?.get(key) as FormGroup;
    }

    onModuleReadChange(key: UserFormModuleKey, checked: boolean): void {
        if (!checked) {
            this.moduleGroup(key).get('write')?.setValue(false);
        }
    }

    onModuleWriteChange(key: UserFormModuleKey, checked: boolean): void {
        if (checked) {
            this.moduleGroup(key).get('read')?.setValue(true);
        }
    }

    cancel(): void {
        this._dialogRef.close(false);
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

    async removeProfilePicture(): Promise<void> {
        const id = this.data?.user?.id;
        if (!id) return;
        this.removingProfilePicture = true;
        try {
            await lastValueFrom(this._usersService.deleteProfilePicture(id));
            this._toast.success('Profile photo removed');
            this.profilePictureUrl = null;
            this.clearPendingProfilePicture();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to remove photo');
        } finally {
            this.removingProfilePicture = false;
        }
    }

    private buildModuleAccessPayload(): ModuleAccess {
        const visible = new Set(this.visibleModuleKeys);
        const formMa = this.form.get('moduleAccess')?.value as Record<string, { read?: boolean; write?: boolean }>;
        const full: ModuleAccess = {};
        const existing = (this.data?.user?.access ?? this.data?.user?.moduleAccess) as
            | ModuleAccess
            | undefined;

        for (const k of USER_FORM_MODULE_KEYS) {
            if (visible.has(k)) {
                const row = formMa?.[k];
                full[k] = { read: !!row?.read, write: !!row?.write };
            } else if (this.isEdit && existing?.[k]) {
                const row = existing[k];
                full[k] = { read: !!row?.read, write: !!row?.write };
            } else {
                full[k] = { read: false, write: false };
            }
        }
        return full;
    }

    getPayload(): UserCreateUpdatePayload {
        const v = this.form.value;
        const designation = typeof v.designation === 'string' ? v.designation.trim() : '';
        const payload: UserCreateUpdatePayload = {
            email: v.email,
            role: v.role,
            displayName: v.displayName,
            moduleAccess: this.buildModuleAccessPayload(),
        };
        if (designation) payload.designation = designation;
        if (!this.isEdit && v.password) payload.password = v.password;
        return payload;
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.loading = true;
        try {
            const payload = this.getPayload();
            let userId: string;

            if (this.isEdit && this.data?.user?.id) {
                const resp = await lastValueFrom(this._usersService.update(this.data.user.id, payload));
                userId = (resp as UserListItem)?.id ?? this.data.user.id;
                this._toast.success('User updated');
            } else {
                const resp = await lastValueFrom(this._usersService.create(payload));
                const created = resp as UserListItem;
                userId = created?.id ?? '';
                if (!userId) {
                    this._toast.error('User was saved but no user ID was returned.');
                    this._dialogRef.close(true);
                    return;
                }
                this._toast.success('User created');
            }

            if (this.pendingProfileFile && userId) {
                try {
                    const resp: any = await lastValueFrom(
                        this._usersService.uploadProfilePicture(userId, this.pendingProfileFile)
                    );
                    this.clearPendingProfilePicture();
                    const url =
                        resp?.profilePictureUrl ??
                        resp?.profilePicture ??
                        resp?.url ??
                        resp?.fileUrl;
                    if (typeof url === 'string' && url.trim()) {
                        this.profilePictureUrl = url.trim();
                    }
                    this._toast.success('Profile photo saved');
                } catch (e: any) {
                    this._toast.error(e?.error?.message || 'Failed to upload profile photo');
                }
            }

            this._dialogRef.close(true);
        } catch (e: any) {
            this._toast.error(e?.error?.message || (this.isEdit ? 'Failed to update user' : 'Failed to create user'));
        } finally {
            this.loading = false;
        }
    }
}
