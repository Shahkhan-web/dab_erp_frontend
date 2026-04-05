import { Route } from '@angular/router';

export const talabatOccupationRatesRoutes: Route[] = [
    {
        path: '',
        loadComponent: () =>
            import('./talabat-occupation-rates-list.component').then(
                (m) => m.TalabatOccupationRatesListComponent,
            ),
    },
];
