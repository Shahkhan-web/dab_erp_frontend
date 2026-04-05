import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';

export const appRoutes: Route[] = [
    {path: '', pathMatch : 'full', redirectTo: 'main/dashboard'},
    {path: 'signed-in-redirect', pathMatch : 'full', redirectTo: 'main/dashboard'},
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            // {path: 'confirmation-required', loadChildren: () => import('app/modules/auth/confirmation-required/confirmation-required.routes').then(m => m.confirmationRequiredRoutes)},
            // {path: 'forgot-password', loadChildren: () => import('app/modules/auth/forgot-password/forgot-password.routes').then(m => m.forgotPasswordRoutes)},
            // {path: 'reset-password', loadChildren: () => import('app/modules/auth/reset-password/reset-password.routes').then(m => m.resetPasswordRoutes)},
            {path: 'sign-in', loadComponent: () => import('app/modules/auth/sign-in/sign-in.component').then(m => m.AuthSignInComponent)},
            // {path: 'sign-up', loadChildren: () => import('app/modules/auth/sign-up/sign-up.routes').then(m => m.signUpRoutes)},
            // {path: 'select-branch', loadChildren: () => import('app/modules/auth/select-branch/select-branch.routes').then(m => m.selectBranchRoutes)}
        ]
    },
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'sign-out', loadComponent: () => import('app/modules/auth/sign-out/sign-out.component').then(m => m.AuthSignOutComponent)},
            // {path: 'unlock-session', loadChildren: () => import('app/modules/auth/unlock-session/unlock-session.routes').then(m => m.unlockSessionRoutes)}
        ]
    },

    {
        path: '',
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            // {path: 'home', loadChildren: () => import('app/modules/landing/home/home.routes')},
        ]
    },

    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            {path: 'main', loadChildren: () => import('app/modules/main/main.routes').then(m => m.mainRoutes)},
        ]
    }
];
