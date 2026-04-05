import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
    FormsModule,
    NgForm,
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
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { FuseCardComponent } from '@fuse/components/card';
import { AuthService } from 'app/core/auth/auth.service';
import { CodeGenerator, CustomValidators } from 'app/core/helpers';
import { ToastrService } from 'ngx-toastr';
import { GlobalService } from 'app/core/global.service';
import { lastValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { OverlayLoaderDirective } from 'app/core/directives/overlay-loader.directive';

@Component({
    selector: 'auth-sign-up',
    templateUrl: './sign-up.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        RouterLink,
        CommonModule,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        FuseCardComponent,
        MatSelectModule,
        OverlayLoaderDirective
    ],
})
export class AuthSignUpComponent implements OnInit {
    @ViewChild('signUpNgForm') signUpNgForm: NgForm;
    states: any[] = [];
    cities: any[] = [];
    cityByState: any[] = [];
    companyTypes: any[] = [];
    companyLogoPreview: string | null = null;
    signUpForm: UntypedFormGroup;
    showAlert: boolean = false;
    timeZone: string;
    usernameAvailable: boolean = false;
    loader: boolean = false;
    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    constructor(
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _router: Router,
        private toast: ToastrService,
        private _globalService: GlobalService
    ) { }

    ngOnInit() {
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.states = this._authService.PAKISTAN_STATES;
        this.cities = this._authService.CITIES;
        this.initForm();
        this.getCompanyTypes();
    }

    initForm() {
        this.signUpForm = this._formBuilder.group({
            companyName: ['', Validators.required],
            CompanyTypeId: ['', Validators.required],
            companyCode: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(50)]],
            companyEmail: ['', [Validators.required,Validators.email]],
            firstName:[''],
            lastName: [''],
            email:[''],
            username: ['', Validators.required],
            phone: ['', [Validators.maxLength(13)]],
            website: [''],
            country: ['PK'],
            state: [''],
            city: [''],
            address: ['', [Validators.required]],
            timezone: [{ value: this.timeZone, disabled: true }],
            password: ['', Validators.required],
            agreements: ['', Validators.requiredTrue],
            isSuperAdmin:[true],
            logo: ['']
        });
    }

    getCompanyTypes(){
        lastValueFrom(this._globalService.getCompanyTypes()).then((resp: any) => {
            if(resp.success){
                this.companyTypes = resp.data;
            }
        }).catch((err: HttpErrorResponse) => {

        })
    }

    onLogoChange(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        this.signUpForm.patchValue({ company_logo: file });
        const reader = new FileReader();
        reader.onload = () => (this.companyLogoPreview = reader.result as string);
        reader.readAsDataURL(file);
        lastValueFrom(this._globalService.uploadFile(file, {name: 'signup'})).then((resp: any) => {
            console.log(resp)
            if(resp.success){
                this.signUpForm.get('logo')?.setValue(resp.data.fileUrl);
            }else{
                this.signUpForm.get('logo')?.setValue(null);
            }
        }).catch((err: HttpErrorResponse) => {

        })
    }

    generateCode() {
        if(this.signUpForm.get('companyName')?.value){
            const code = CodeGenerator.generate('CMP');
            this.signUpForm.get('companyCode')?.setValue(code);
        }else{
            this.signUpForm.get('companyCode')?.setValue(null);
        }
    }

    getCities(){
        const value = this.signUpForm.get('state')?.value;
        const result = this.cities.filter(c => c.province_id === value);
        this.cityByState = result;
    }

    checkUserName(){
        console.log(this.signUpForm.get('username')?.value)
        this.usernameAvailable = false;
    this.signUpForm.get('username')?.setErrors(null);

        const payload = {
            username: this.signUpForm.get('username')?.value
        }
        lastValueFrom(this._authService.checkAvailableUserName(payload)).then((resp: any) => {
            if(resp.data){
                this.usernameAvailable = true;
            }else{
            this.signUpForm.get('username').setErrors({ notAvailable: true });
            }
        }).catch((err: HttpErrorResponse) => {
            this.signUpForm.get('username').setErrors({ serverError: true });
        })
    }


    signUp(): void {
        if (this.signUpForm.invalid) {
            return;
        }
        this.loader = true;
        lastValueFrom(this._authService.signUp(this.signUpForm.getRawValue())).then((resp: any) => {
            if(resp.success){
                this.toast.success(resp?.message || 'Company registered succesfully');
                this._router.navigateByUrl('/sign-in');
            }
            this.loader = false;
        }).catch((err: HttpErrorResponse) => {
                this.loader = false;
                this.toast.error(err.error?.title || 'something went wrong');
        })
    }
}
