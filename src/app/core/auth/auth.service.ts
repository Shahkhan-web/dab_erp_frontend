import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { environment } from 'environments/environment';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
    profileData: any;
    private _authenticated: boolean = false;
    private _branchSelectionPending: boolean = false;
    private _pendingBranches: any[] = [];
    private _httpClient = inject(HttpClient);
    private _userService = inject(UserService);
    public PAKISTAN_STATES = [
        { "id": 1, "name": "Punjab", "code": "PB" },
        { "id": 2, "name": "Sindh", "code": "SD" },
        { "id": 3, "name": "Khyber Pakhtunkhwa", "code": "KP" },
        { "id": 4, "name": "Balochistan", "code": "BL" },
        { "id": 5, "name": "Islamabad Capital Territory", "code": "ICT" },
        { "id": 7, "name": "Azad Jammu and Kashmir", "code": "AJK" }
    ];
    public CITIES = [
        /* ===================== SINDH ===================== */
        { "id": 1, "province_id": 2, "name": "Karachi" },
        { "id": 2, "province_id": 2, "name": "Hyderabad" },
        { "id": 3, "province_id": 2, "name": "Sukkur" },
        { "id": 4, "province_id": 2, "name": "Larkana" },
        { "id": 5, "province_id": 2, "name": "Mirpur Khas" },
        { "id": 6, "province_id": 2, "name": "Nawabshah" },
        { "id": 7, "province_id": 2, "name": "Jacobabad" },
        { "id": 8, "province_id": 2, "name": "Khairpur" },
        { "id": 9, "province_id": 2, "name": "Shikarpur" },
        { "id": 10, "province_id": 2, "name": "Badin" },
        { "id": 11, "province_id": 2, "name": "Dadu" },
        { "id": 12, "province_id": 2, "name": "Tando Adam" },
        { "id": 13, "province_id": 2, "name": "Tando Allahyar" },
        { "id": 14, "province_id": 2, "name": "Tando Muhammad Khan" },
        { "id": 15, "province_id": 2, "name": "Ghotki" },
        { "id": 16, "province_id": 2, "name": "Umerkot" },
        { "id": 17, "province_id": 2, "name": "Kamber Ali Khan" },
        { "id": 18, "province_id": 2, "name": "Shahdadkot" },
        { "id": 19, "province_id": 2, "name": "Shahdadpur" },
        { "id": 20, "province_id": 2, "name": "Kotri" },
        { "id": 21, "province_id": 2, "name": "Moro" },
        { "id": 22, "province_id": 2, "name": "Bholari" },

        /* ===================== PUNJAB ===================== */
        { "id": 101, "province_id": 1, "name": "Lahore" },
        { "id": 102, "province_id": 1, "name": "Faisalabad" },
        { "id": 103, "province_id": 1, "name": "Rawalpindi" },
        { "id": 104, "province_id": 1, "name": "Gujranwala" },
        { "id": 105, "province_id": 1, "name": "Multan" },
        { "id": 106, "province_id": 1, "name": "Sargodha" },
        { "id": 107, "province_id": 1, "name": "Sialkot" },
        { "id": 108, "province_id": 1, "name": "Bahawalpur" },
        { "id": 109, "province_id": 1, "name": "Sheikhupura" },
        { "id": 110, "province_id": 1, "name": "Rahim Yar Khan" },
        { "id": 111, "province_id": 1, "name": "Kasur" },
        { "id": 112, "province_id": 1, "name": "Dera Ghazi Khan" },
        { "id": 113, "province_id": 1, "name": "Sahiwal" },
        { "id": 114, "province_id": 1, "name": "Okara" },
        { "id": 115, "province_id": 1, "name": "Jhang" },
        { "id": 116, "province_id": 1, "name": "Gujrat" },
        { "id": 117, "province_id": 1, "name": "Vehari" },
        { "id": 118, "province_id": 1, "name": "Chiniot" },
        { "id": 119, "province_id": 1, "name": "Hafizabad" },
        { "id": 120, "province_id": 1, "name": "Jhelum" },
        { "id": 121, "province_id": 1, "name": "Mianwali" },
        { "id": 122, "province_id": 1, "name": "Bhakkar" },
        { "id": 123, "province_id": 1, "name": "Attock" },
        { "id": 124, "province_id": 1, "name": "Pakpattan" },
        { "id": 125, "province_id": 1, "name": "Bahawalnagar" },
        { "id": 126, "province_id": 1, "name": "Lodhran" },
        { "id": 127, "province_id": 1, "name": "Khanewal" },

        /* ===================== KP ===================== */
        { "id": 201, "province_id": 3, "name": "Peshawar" },
        { "id": 202, "province_id": 3, "name": "Mardan" },
        { "id": 203, "province_id": 3, "name": "Mingora" },
        { "id": 204, "province_id": 3, "name": "Abbottabad" },
        { "id": 205, "province_id": 3, "name": "Kohat" },
        { "id": 206, "province_id": 3, "name": "Dera Ismail Khan" },
        { "id": 207, "province_id": 3, "name": "Mansehra" },
        { "id": 208, "province_id": 3, "name": "Nowshera" },
        { "id": 209, "province_id": 3, "name": "Charsadda" },
        { "id": 210, "province_id": 3, "name": "Swabi" },

        /* ===================== BALOCHISTAN ===================== */
        { "id": 301, "province_id": 4, "name": "Quetta" },
        { "id": 302, "province_id": 4, "name": "Gwadar" },
        { "id": 303, "province_id": 4, "name": "Turbat" },
        { "id": 304, "province_id": 4, "name": "Khuzdar" },
        { "id": 305, "province_id": 4, "name": "Chaman" },
        { "id": 306, "province_id": 4, "name": "Hub" },
        { "id": 307, "province_id": 4, "name": "Panjgur" },
        { "id": 308, "province_id": 4, "name": "Pishin" },

        /* ===================== ICT ===================== */
        { "id": 401, "province_id": 5, "name": "Islamabad" },

        /* ===================== AJK ===================== */
        { "id": 501, "province_id": 7, "name": "Muzaffarabad" },
        { "id": 502, "province_id": 7, "name": "Mirpur" }
    ]
    set accessToken(token: string) {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string {
        return localStorage.getItem('accessToken') ?? '';
    }

    set refreshToken(token: string) {
        localStorage.setItem('refreshToken', token);
    }

    get refreshToken(): string {
        return localStorage.getItem('refreshToken') ?? '';
    }

    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post('api/auth/forgot-password', email);
    }

    resetPassword(password: string): Observable<any> {
        return this._httpClient.post('api/auth/reset-password', password);
    }

    // signIn(credentials: { email: string; password: string }): Observable<any> {
    //     if (this._authenticated) {
    //         return throwError('User is already logged in.');
    //     }
    //     return this._httpClient.post(`${environment.apiUrl}Auth/login`, credentials).pipe(
    //         switchMap((response: any) => {
    //             this.accessToken = response.data.token;
    //             this._authenticated = true;
    //             this._userService.user = response.data.user;
    //             return of(response);
    //         })
    //     );
    // }

    signIn(credentials: { email: string; password: string }): Observable<any> {
        if (this._authenticated) {
            return throwError(() => 'User is already logged in.');
        }

        return this._httpClient
            .post(`${environment.apiUrl}auth/login`, credentials)
            .pipe(
                tap((response: any) => {
                    // Handle response structure - check both root level and data wrapper
                    const responseData = response.data || response;
                    // Store the initial token from login response
                    const accessToken = responseData?.accessToken ?? responseData?.token;
                    if (accessToken) {
                        this.accessToken = accessToken;
                    }
                    const refreshToken = responseData?.refreshToken;
                    if (refreshToken) {
                        this.refreshToken = refreshToken;
                    }
                    // Check if branch selection is required
                    const requiresBranchSelection = responseData?.requiresBranchSelection === true || responseData?.requiresBranchSelection === 'true';
                    if (requiresBranchSelection) {
                        // Set flag that branch selection is pending and store branches for selection
                        this._branchSelectionPending = true;
                        this._authenticated = false; // Not fully authenticated until branch is selected
                        this._pendingBranches = responseData?.branches ?? responseData?.data?.branches ?? [];
                    } else {
                        // Branch selection not required, user is authenticated
                        this._authenticated = true;
                        this._branchSelectionPending = false;
                    }
                })
            );
    }

    /**
     * Select a branch and complete the login flow
     * @param branchId The ID of the selected branch
     */
    selectBranch(branchId: string): Observable<any> {
        return this._httpClient
            .post(`${environment.apiUrl}Auth/select-branch`, { branchId })
            .pipe(
                switchMap((response: any) => {
                    // Handle response structure - check both root level and data wrapper
                    const responseData = response.data || response;
                    // Replace stored token with the new token from response
                    const accessToken = responseData?.accessToken ?? responseData?.token;
                    if (accessToken) {
                        this.accessToken = accessToken;
                    }
                    const refreshToken = responseData?.refreshToken;
                    if (refreshToken) {
                        this.refreshToken = refreshToken;
                    }
                    // Save selected branch to localStorage
                    if (responseData?.branch) {
                        this.setSelectedBranch(responseData.branch);
                    }
                    // Clear branch selection pending flag and mark as authenticated
                    this._branchSelectionPending = false;
                    this._authenticated = true;
                    // Call profile API after branch selection
                    return this.getProfile();
                }),
                tap((profileResp: any) => {
                    const profileData = profileResp.data || profileResp;
                    this.profileData = profileData;
                    this._userService.user = profileData;
                })
            );
    }

    /**
     * Complete login flow by calling profile API
     * Used when branch selection is not required
     */
    completeLogin(): Observable<any> {
        return this.getProfile().pipe(
            tap((profileResp: any) => {
                const profileData = profileResp.data || profileResp;
                this.profileData = profileData;
                this._userService.user = profileData;
            })
        );
    }

    /**
     * Save selected branch to localStorage
     */
    setSelectedBranch(branch: any): void {
        localStorage.setItem('selectedBranch', JSON.stringify(branch));
    }

    /**
     * Get selected branch from localStorage
     */
    getSelectedBranch(): any {
        const branch = localStorage.getItem('selectedBranch');
        return branch ? JSON.parse(branch) : null;
    }

    /**
     * Clear selected branch from localStorage
     */
    clearSelectedBranch(): void {
        localStorage.removeItem('selectedBranch');
    }

    profile() {
        if (this.profileData) {
            return this.profileData;
        } else {

        }
    }


    signInUsingToken(): Observable<any> {
        return this._httpClient
            .post('api/auth/sign-in-with-token', {
                accessToken: this.accessToken,
            })
            .pipe(
                catchError(() =>
                    // Return false
                    of(false)
                ),
                switchMap((response: any) => {
                    // Replace the access token with the new one if it's available on
                    // the response object.
                    //
                    // This is an added optional step for better security. Once you sign
                    // in using the token, you should generate a new one on the server
                    // side and attach it to the response object. Then the following
                    // piece of code can replace the token with the refreshed one.
                    if (response.accessToken) {
                        this.accessToken = response.accessToken;
                    }

                    // Set the authenticated flag to true
                    this._authenticated = true;

                    // Store the user on the user service
                    this._userService.user = response.user;

                    // Return true
                    return of(true);
                })
            );
    }

    signOut(): Observable<any> {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        this.clearSelectedBranch();
        this._authenticated = false;
        this._branchSelectionPending = false;
        this._pendingBranches = [];
        return of(true);
    }

    signUp(body: any): Observable<any> {
        return this._httpClient.post(`${environment.apiUrl}Auth/company-signup`, body);
    }

    unlockSession(credentials: {
        email: string;
        password: string;
    }): Observable<any> {
        return this._httpClient.post('api/auth/unlock-session', credentials);
    }

    checkAvailableUserName(body: any) {
        let params: any = {};
        params.username = body.username
        return this._httpClient.get(`${environment.apiUrl}Auth/check-username`, { params });
    }

    check(): Observable<boolean> {
        // If already authenticated, return true
        if (this._authenticated) {
            return of(true);
        }

        // If branch selection is pending, don't check profile - return false (not fully authenticated)
        if (this._branchSelectionPending) {
            return of(false);
        }

        // If no token or token expired, return false
        if (!this.accessToken || AuthUtils.isTokenExpired(this.accessToken)) {
            return of(false);
        }

        // Only call profile API if branch selection is not pending
        return this.getProfile().pipe(
            tap((resp: any) => {
                const profileData = resp.data || resp;
                this._authenticated = true;
                this.profileData = profileData;
                this._userService.user = profileData;
            }),
            map(() => true),
            catchError(() => of(false))
        );
    }

    /**
     * Check if branch selection is pending
     */
    isBranchSelectionPending(): boolean {
        return this._branchSelectionPending;
    }

    getPendingBranches(): any[] {
        return this._pendingBranches;
    }

    getProfile() {
        return this._httpClient.get(`${environment.apiUrl}auth/me`);
    }

    getInbox() {
        return this._httpClient.get(`${environment.apiUrl}TransactionApproval/${this.profileData.company?.id}/pending-for-user`);
    }

    initializeChartOfAccounts() {
        return this._httpClient.get(`${environment.apiUrl}ChartOfAccount/initialize`);
    }
}
