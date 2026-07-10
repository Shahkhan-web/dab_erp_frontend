import { Route } from '@angular/router';
import { moduleReadGuard } from 'app/core/auth/guards/module-read.guard';

export const assetsRoutes: Route[] = [
    {
        path: '',
        canActivate: [moduleReadGuard('asset', '/main/dashboard')],
        loadComponent: () => import('./assets-list.component').then(m => m.AssetsListComponent),
    },
    {
        path: ':id',
        canActivate: [moduleReadGuard('asset', '/main/dashboard')],
        loadComponent: () => import('./asset-detail.component').then(m => m.AssetDetailComponent),
    },
];
