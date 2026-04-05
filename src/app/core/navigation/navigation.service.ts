import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from 'app/core/auth/auth.service';
import { getModuleAccessFromProfile, NAV_ID_TO_MODULE_KEY } from 'app/core/auth/module-access.util';
import { Navigation } from 'app/core/navigation/navigation.types';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { Observable, ReplaySubject, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _httpClient = inject(HttpClient);
    private _authService = inject(AuthService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for navigation
     */
    get navigation$(): Observable<Navigation> {
        return this._navigation.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Admins see the full menu (including Users). Managers only see items allowed by
     * auth/me `access.*.read` (or legacy `moduleAccess`); Users and Companies are admin-only.
     */
    private filterNavigationByRole(navigation: Navigation, profile: any): Navigation {
        const role = profile?.role;
        if (role === 'admin') {
            return navigation;
        }
        if (role !== 'manager') {
            return navigation;
        }
        const access = getModuleAccessFromProfile(profile);
        const filter = (items: FuseNavigationItem[]): FuseNavigationItem[] =>
            (items || []).filter((item) => {
                if (item.id === 'dashboard') return true;
                if (item.id === 'companies') return false;
                if (item.id === 'users') return false;
                const modKey = NAV_ID_TO_MODULE_KEY[item.id];
                if (!modKey) return false;
                return access?.[modKey]?.read === true;
            });
        return {
            compact: filter(navigation.compact),
            default: filter(navigation.default),
            futuristic: filter(navigation.futuristic),
            horizontal: filter(navigation.horizontal),
            accounting: filter(navigation.accounting),
            inventory: filter(navigation.inventory),
            sales: filter(navigation.sales),
            purchases: filter(navigation.purchases),
            admin: filter(navigation.admin),
            manufacturing: filter(navigation.manufacturing),
            hr: filter(navigation.hr),
            settings: filter(navigation.settings),
            logistics: filter(navigation.logistics),
            gate: filter(navigation.gate),
            pos: filter(navigation.pos),
        };
    }

    /**
     * Get all navigation data (filtered by current user role).
     */
    get(): Observable<Navigation> {
        const profile$ = this._authService.profileData
            ? of(this._authService.profileData)
            : this._authService.getProfile().pipe(
                  map((resp: any) => resp?.data ?? resp),
                  tap((profile) => {
                      if (profile) this._authService.profileData = profile;
                  })
              );

        return this._httpClient.get<Navigation>('api/common/navigation').pipe(
            switchMap((navigation) =>
                profile$.pipe(
                    map((profile: any) => this.filterNavigationByRole(navigation, profile))
                )
            ),
            tap((navigation) => this._navigation.next(navigation))
        );
    }
}
