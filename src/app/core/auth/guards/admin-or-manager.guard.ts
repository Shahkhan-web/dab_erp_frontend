import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { of, switchMap } from 'rxjs';

/**
 * Guard that allows access for users with admin or manager role.
 * Used for routes that both admins and managers can access (e.g. employees).
 */
export const AdminOrManagerGuard: CanActivateFn | CanActivateChildFn = (route, state) => {
    const router = inject(Router);
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
            if (role === 'admin' || role === 'manager') {
                return of(true);
            }
            return of(router.parseUrl('/main/dashboard'));
        })
    );
};
