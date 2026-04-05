import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { of, switchMap } from 'rxjs';

/**
 * Guard that allows access only for users with admin role.
 * Relies on the profile data returned from auth/me.
 */
export const AdminGuard: CanActivateFn | CanActivateChildFn = (route, state) => {
    const router: Router = inject(Router);
    const authService = inject(AuthService);

    const ensureProfile$ = authService.profileData
        ? of(authService.profileData)
        : authService.getProfile().pipe(
              switchMap((resp: any) => {
                  const profileData = resp?.data || resp;
                  authService.profileData = profileData;
                  return of(profileData);
              })
          );

    return ensureProfile$.pipe(
        switchMap((profile: any) => {
            const role = profile?.role;
            if (role === 'admin') {
                return of(true);
            }

            // Non-admins are redirected to main dashboard
            return of(router.parseUrl('/main/dashboard'));
        })
    );
};

