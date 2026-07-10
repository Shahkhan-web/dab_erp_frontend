import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { hasModuleRead, UserFormModuleKey } from 'app/core/auth/module-access.util';
import { of, switchMap } from 'rxjs';

/** Blocks module routes when the user lacks `read` on that module (admins always allowed). */
export function moduleReadGuard(moduleKey: UserFormModuleKey, fallbackUrl: string): CanActivateFn {
    return () => {
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
                if (hasModuleRead(profile, moduleKey)) {
                    return of(true);
                }
                return of(router.parseUrl(fallbackUrl));
            })
        );
    };
}
