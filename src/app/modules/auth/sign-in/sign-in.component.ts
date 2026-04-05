import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.scss'],
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        CommonModule,
        RouterLink,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        OverlayLoaderDirective
    ],
})
export class AuthSignInComponent implements OnInit {
    loader: boolean = false;
    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _router: Router,
        private _toast: ToastrService
    ) { }

    ngOnInit(): void {
        this.signInForm = this._formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', Validators.required],
        });
    }

    signIn(): void {
        if (this.signInForm.invalid) {
            return;
        }
        this.loader = true;
        this.showAlert = false;
        lastValueFrom(this._authService.signIn(this.signInForm.value)).then((resp: any) => {
            this.loader = false;
            
            // Handle response structure - check both root level and data wrapper
            // The response might be: { data: { ... } } or directly { ... }
            const responseData = resp?.data || resp;
            
            // Debug logging to understand response structure
            console.log('Full login response:', JSON.stringify(resp, null, 2));
            console.log('Response data extracted:', responseData);
            console.log('requiresBranchSelection value:', responseData?.requiresBranchSelection);
            console.log('Type of requiresBranchSelection:', typeof responseData?.requiresBranchSelection);
            
            // Check if branch selection is required (explicitly check for true)
            const requiresBranchSelection = responseData?.requiresBranchSelection;
            if (requiresBranchSelection === true || requiresBranchSelection === 'true') {
                // Store login response in sessionStorage for branch selection component
                sessionStorage.setItem('loginResponse', JSON.stringify(resp));
                // Navigate to branch selection page
                console.log('Branch selection required - Navigating to /select-branch');
                this._router.navigate(['/select-branch']).then(() => {
                    console.log('Navigation to select-branch completed');
                }).catch((navErr) => {
                    console.error('Navigation error:', navErr);
                });
                return; // Important: return early to prevent further execution
            }
            
            // Branch selection not required, complete login flow
            console.log('Branch selection not required - Completing login');
            this._toast.success(resp?.message || responseData?.message || 'Login successfully');
            lastValueFrom(this._authService.completeLogin()).then((profileResp: any) => {
                const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';
                this._router.navigateByUrl(redirectURL ? redirectURL : '/accounting/dashboard');
            }).catch((err: HttpErrorResponse) => {
                this.showAlert = true;
                this.alert = {type: 'error', message: err?.error?.message || 'Failed to load profile'};
            });
        }).catch((err: HttpErrorResponse) => {
            this.loader = false;
            this.showAlert = true;
            this.alert = {type: 'error', message: err?.error?.message || 'server error, please try again later'};
        })
    }

        initChartOfAccounts(){
        lastValueFrom(this._authService.initializeChartOfAccounts()).then((resp: any) => {
            if(resp.success){
                this._toast.success(resp?.message);
            }
        }).catch((err: HttpErrorResponse) => {
            this._toast.error(err?.error?.message || 'chart of accounts not initialized')
        })
    }
}
