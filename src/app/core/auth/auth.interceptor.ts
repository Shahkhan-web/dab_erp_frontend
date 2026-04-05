import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthUtils } from 'app/core/auth/auth.utils';

const EXCLUDED_URLS = [
    '/Auth/login',
    '/Auth/company-signup',
];

const UPLOAD_URLS = [
    '/FileUpload/single',
    '/FileUpload/multiple',
];

export const authInterceptor = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
    const authService = inject(AuthService);
    const isExcluded = EXCLUDED_URLS.some(url => req.url.includes(url));
    const isUpload = UPLOAD_URLS.some(url => req.url.includes(url));
    let newReq = req;
    if (
        !isExcluded &&
        !isUpload &&
        authService.accessToken &&
        !AuthUtils.isTokenExpired(authService.accessToken)
    ) {
        newReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${authService.accessToken}`,
            },
        });
    }

    return next(newReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                const isAuthRequest = EXCLUDED_URLS.some(url =>
                    req.url.includes(url)
                );
                if (isAuthRequest) {
                    return throwError(() => error);
                }
                authService.signOut();
            }

            return throwError(() => error);
        })
    );
};
