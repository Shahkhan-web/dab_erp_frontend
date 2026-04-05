import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationItem,
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { MessagesComponent } from 'app/layout/common/messages/messages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { QuickChatComponent } from 'app/layout/common/quick-chat/quick-chat.component';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { ShortcutsComponent } from 'app/layout/common/shortcuts/shortcuts.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { filter, lastValueFrom, Subject, takeUntil } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { FuseConfig, FuseConfigService, Scheme } from '@fuse/services/config';
import { AuthService } from 'app/core/auth/auth.service';
import { MatBadgeModule } from '@angular/material/badge';
@Component({
    selector: 'classy-layout',
    templateUrl: './classy.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
        CommonModule,
        // FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        // NotificationsComponent,
        UserComponent,
        MatIconModule,
        MatButtonModule,
        // LanguagesComponent,
        FuseFullscreenComponent,
        RouterModule,
        // SearchComponent,
        // ShortcutsComponent,
        // MessagesComponent,
        RouterOutlet,
        MatBadgeModule,
        MatTabsModule
        // QuickChatComponent,
    ],
    styles: [`
        .active-module {
    background-color: rgba(59, 130, 246, 0.15) !important;
    border-color: #3b82f6 !important;
    font-weight: 600 !important;
}`]
})
export class ClassyLayoutComponent implements OnInit, OnDestroy {
    isScreenSmall: boolean;
    navigation: Navigation;
    user: User;
    inboxCount = 0;
    currentNavigation: FuseNavigationItem[];
    config: FuseConfig;
    scheme: 'dark' | 'light';
    activeModule: 'main' = 'main';
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    modules = [
        { key: 'main', label: 'Main', icon: 'heroicons_outline:squares-2x2', link: '/main/dashboard' },
    ];

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _navigationService: NavigationService,
        private _userService: UserService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService,
        private _fuseConfigService: FuseConfigService,
        private _authService: AuthService
    ) { }

    get currentYear(): number {
        return new Date().getFullYear();
    }

    ngOnInit(): void {
        this._fuseConfigService.config$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((config: FuseConfig) => {
                this.config = config;
            });

        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
                // this.currentNavigation = navigation;
                this.resolveNavigationFromUrl(this._router.url);
            });

        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User) => {
                this.user = user;
            });

        this._router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntil(this._unsubscribeAll)
        )
            .subscribe((event: NavigationEnd) => {
                this.resolveNavigationFromUrl(event.urlAfterRedirects);
            });


        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });
    }

    private resolveNavigationFromUrl(url: string): void {
        this.activeModule = 'main';
        this.currentNavigation = this.navigation.default;
    }


    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    toggleNavigation(name: string): void {
        const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
            name
        );

        if (navigation) {
            navigation.toggle();
        }
    }

    toggleScheme(): void {
        const nextScheme: Scheme = this.config.scheme === 'dark' ? 'light' : 'dark';
        this._fuseConfigService.config = { scheme: nextScheme };
    }



}
