import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { of, switchMap } from 'rxjs';

export const NoAuthGuard: CanActivateFn | CanActivateChildFn = (
    route,
    state
) => {
    const router: Router = inject(Router);
    const authService = inject(AuthService);

    // Allow access to select-branch even if user has token but branch selection is pending
    if (state.url.includes('/select-branch')) {
        // If branch selection is pending, allow access
        if (authService.isBranchSelectionPending()) {
            return of(true);
        }
        // If user is fully authenticated, redirect away from select-branch
        return authService.check().pipe(
            switchMap((authenticated) => {
                if (authenticated) {
                    return of(router.parseUrl(''));
                }
                return of(true);
            })
        );
    }

    // Check the authentication status for other routes
    return authService.check().pipe(
        switchMap((authenticated) => {
            // If the user is authenticated...
            if (authenticated) {
                return of(router.parseUrl(''));
            }

            // Allow the access
            return of(true);
        })
    );
};
