import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Inject, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { UsersService, UserListItem } from '../users.service';

export interface UserProfilePictureDialogData {
    user: UserListItem;
}

@Component({
    selector: 'app-user-profile-picture-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './user-profile-picture-dialog.component.html',
})
export class UserProfilePictureDialogComponent {
    private readonly _destroyRef = inject(DestroyRef);

    readonly profilePictureMaxBytes = 5 * 1024 * 1024;
    readonly profilePictureAcceptAttr = '.jpg,.jpeg,.png,.webp,.gif';

    profilePictureUrl: string | null = null;
    profileAvatarDragActive = false;
    private _profileAvatarDragDepth = 0;
    pendingProfileFile: File | null = null;
    pendingProfilePreviewUrl: string | null = null;
    uploadingProfilePicture = false;
    removingProfilePicture = false;

    /** True after a successful upload or remove; passed to `afterClosed` when the dialog is dismissed. */
    hasChanges = false;

    readonly userId: string;
    readonly displayLabel: string;

    constructor(
        private _dialogRef: MatDialogRef<UserProfilePictureDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: UserProfilePictureDialogData,
        private _usersService: UsersService,
        private _toast: ToastrService
    ) {
        this.userId = data.user.id;
        const u = data.user.profilePictureUrl;
        this.profilePictureUrl = typeof u === 'string' && u.trim() ? u.trim() : null;
        this.displayLabel = data.user.displayName || data.user.email || this.userId;

        this._destroyRef.onDestroy(() => this._revokeProfilePreview());
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

    async uploadProfilePicture(): Promise<void> {
        if (!this.pendingProfileFile) return;
        this.uploadingProfilePicture = true;
        try {
            const resp: any = await lastValueFrom(
                this._usersService.uploadProfilePicture(this.userId, this.pendingProfileFile)
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
            }
            this.hasChanges = true;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to upload photo');
        } finally {
            this.uploadingProfilePicture = false;
        }
    }

    async removeProfilePicture(): Promise<void> {
        this.removingProfilePicture = true;
        try {
            await lastValueFrom(this._usersService.deleteProfilePicture(this.userId));
            this._toast.success('Profile photo removed');
            this.profilePictureUrl = null;
            this.clearPendingProfilePicture();
            this.hasChanges = true;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to remove photo');
        } finally {
            this.removingProfilePicture = false;
        }
    }

    close(): void {
        this._dialogRef.close(this.hasChanges);
    }
}
