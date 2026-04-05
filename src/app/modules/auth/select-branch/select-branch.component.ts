import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';

interface Branch {
    id: string;
    code: string;
    name: string;
}

@Component({
    selector: 'auth-select-branch',
    templateUrl: './select-branch.component.html',
    styleUrls: ['./select-branch.component.scss'],
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        CommonModule,
        FuseAlertComponent,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        OverlayLoaderDirective
    ],
})
export class AuthSelectBranchComponent implements OnInit {
    loader: boolean = false;
    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    showAlert: boolean = false;
    availableBranches: Branch[] = [];
    selectedBranchId: string | null = null;

    constructor(
        private _authService: AuthService,
        private _router: Router,
        private _toast: ToastrService
    ) {}

    ngOnInit(): void {
        // Get available branches from sessionStorage (stored during login)
        const loginResponse = this.getLoginResponseFromStorage();
        // Handle response structure - check both root level and data wrapper
        const responseData = loginResponse?.data || loginResponse;
        if (responseData?.availableBranches && Array.isArray(responseData.availableBranches)) {
            this.availableBranches = responseData.availableBranches;
        } else {
            // If no branches found, redirect back to login
            this._toast.error('No branches available. Please login again.');
            this._router.navigate(['/sign-in']);
        }
    }

    selectBranch(branch: Branch): void {
        this.selectedBranchId = branch.id;
    }

    confirmSelection(): void {
        if (!this.selectedBranchId) {
            this.showAlert = true;
            this.alert = {
                type: 'error',
                message: 'Please select a branch to continue',
            };
            return;
        }

        this.loader = true;
        this.showAlert = false;

        lastValueFrom(this._authService.selectBranch(this.selectedBranchId))
            .then((resp: any) => {
                this.loader = false;
                if (resp.success) {
                    this._toast.success(resp?.message || 'Branch selected successfully');
                    // Clear login response from storage
                    this.clearLoginResponseFromStorage();
                    // Navigate to dashboard
                    this._router.navigateByUrl('/accounting/dashboard');
                }
            })
            .catch((err: HttpErrorResponse) => {
                this.loader = false;
                this.showAlert = true;
                this.alert = {
                    type: 'error',
                    message: err?.error?.message || 'Failed to select branch. Please try again.',
                };
            });
    }

    private getLoginResponseFromStorage(): any {
        const loginResponse = sessionStorage.getItem('loginResponse');
        return loginResponse ? JSON.parse(loginResponse) : null;
    }

    private clearLoginResponseFromStorage(): void {
        sessionStorage.removeItem('loginResponse');
    }
}
