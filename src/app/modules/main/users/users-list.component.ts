import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { isAdminProfile } from 'app/core/auth/module-access.util';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';
import { ConfirmDialogComponent } from 'app/core/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDeleteDialogComponent } from 'app/core/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { UsersService, UserListItem, UsersListParams } from './users.service';
import { UserFormDialogComponent } from './dialogs/user-form-dialog.component';
import { UserProfilePictureDialogComponent } from './dialogs/user-profile-picture-dialog.component';

@Component({
    selector: 'app-users-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        DatePipe,
        BackButtonComponent,
        OverlayLoaderDirective,
    ],
    templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
    displayedColumns: string[] = ['avatar', 'displayName', 'email', 'role', 'status', 'createdAt', 'actions'];
    users: UserListItem[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    pageLoader = false;

    filterId: string | null = null;
    filterDisplayName: string | null = null;
    filterEmail: string | null = null;
    filterRole: string | null = null;
    filterIsSuspended: boolean | null = null;

    roleOptions = [
        { value: null as string | null, label: 'All' },
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Manager' },
    ];
    suspendedOptions = [
        { value: null as boolean | null, label: 'All' },
        { value: false, label: 'Active only' },
        { value: true, label: 'Suspended only' },
    ];

    constructor(
        private _usersService: UsersService,
        private _toast: ToastrService,
        private _matDialog: MatDialog,
        private _auth: AuthService
    ) {}

    /** Users area is admin-only (route guard enforces; this hides actions if profile is missing). */
    canUseUsersSection(): boolean {
        return isAdminProfile(this._auth.profileData);
    }

    /** Managers must not change admin accounts. */
    canModifyUser(user: UserListItem): boolean {
        const p = this._auth.profileData;
        if (isAdminProfile(p)) return true;
        return user.role !== 'admin';
    }

    ngOnInit(): void {
        this.load();
    }

    getParams(): UsersListParams {
        const params: UsersListParams = {
            page: this.pageIndex + 1,
            limit: this.pageSize,
        };
        if (this.filterId) params.id = this.filterId;
        if (this.filterDisplayName) params.displayName = this.filterDisplayName;
        if (this.filterEmail) params.email = this.filterEmail;
        if (this.filterRole) params.role = this.filterRole;
        if (this.filterIsSuspended !== null && this.filterIsSuspended !== undefined)
            params.isSuspended = this.filterIsSuspended;
        return params;
    }

    async load(): Promise<void> {
        this.pageLoader = true;
        try {
            const resp = await lastValueFrom(this._usersService.getList(this.getParams()));
            this.users = resp.users ?? [];
            this.total = resp.count ?? 0;
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to load users');
            this.users = [];
            this.total = 0;
        } finally {
            this.pageLoader = false;
        }
    }

    handlePageEvent(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.load();
    }

    applyFilters(): void {
        this.pageIndex = 0;
        this.load();
    }

    clearFilters(): void {
        this.filterId = null;
        this.filterDisplayName = null;
        this.filterEmail = null;
        this.filterRole = null;
        this.filterIsSuspended = null;
        this.applyFilters();
    }

    isSuspended(user: UserListItem): boolean {
        return !!user.suspendedAt && user.suspendedAt !== null && String(user.suspendedAt) !== '';
    }

    openAddDialog(): void {
        this._matDialog
            .open(UserFormDialogComponent, { data: {}, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.load();
            });
    }

    openEditDialog(user: UserListItem): void {
        this._matDialog
            .open(UserFormDialogComponent, { data: { user }, width: '90vw', maxWidth: '1020px' })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.load();
            });
    }

    openProfilePictureDialog(user: UserListItem): void {
        this._matDialog
            .open(UserProfilePictureDialogComponent, {
                data: { user },
                width: '90vw',
                maxWidth: '640px',
            })
            .afterClosed()
            .subscribe((refreshed) => {
                if (refreshed) this.load();
            });
    }

    async deleteUser(user: UserListItem): Promise<void> {
        const confirmed = await lastValueFrom(
            this._matDialog
                .open(ConfirmDeleteDialogComponent, {
                    data: { message: `Delete user "${user.displayName}" (${user.email})? This is a soft delete.` },
                    width: '420px',
                })
                .afterClosed()
        );
        if (!confirmed) return;
        try {
            await lastValueFrom(this._usersService.delete(user.id));
            this._toast.success('User deleted');
            this.load();
        } catch (e: any) {
            this._toast.error(e?.error?.message || 'Failed to delete user');
        }
    }

    async toggleSuspend(user: UserListItem): Promise<void> {
        const suspended = this.isSuspended(user);
        const action = suspended ? 'unsuspend' : 'suspend';
        const result = await lastValueFrom(
            this._matDialog
                .open(ConfirmDialogComponent, {
                    data: {
                        action: `${action} user "${user.displayName}" (${user.email})`,
                        confirmText: suspended ? 'Unsuspend' : 'Suspend',
                    },
                    width: '420px',
                })
                .afterClosed()
        );
        if (!result?.confirmed) return;
        try {
            await lastValueFrom(this._usersService.setSuspended(user.id, !suspended));
            this._toast.success(suspended ? 'User unsuspended' : 'User suspended');
            this.load();
        } catch (e: any) {
            this._toast.error(e?.error?.message || `Failed to ${action.toLowerCase()} user`);
        }
    }
}
