import { Route } from '@angular/router';
import { AdminGuard } from 'app/core/auth/guards/admin.guard';

export const mainRoutes: Route[] = [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', loadComponent: () => import('./dashboard/main-dashboard.component').then(m => m.MainDashboardComponent) },
    {
        path: 'companies',
        canActivate: [AdminGuard],
        loadComponent: () => import('./companies/companies-list.component').then(m => m.CompaniesListComponent),
    },
    {
        path: 'users',
        canActivate: [AdminGuard],
        loadComponent: () => import('./users/users-list.component').then(m => m.UsersListComponent),
    },
    { path: 'employees', loadChildren: () => import('./employees/employees.routes').then(m => m.employeesRoutes) },
    { path: 'loans', loadChildren: () => import('./loans/loans.routes').then(m => m.loansRoutes) },
    {
        path: 'pay-components',
        loadChildren: () => import('./pay-components/pay-components.routes').then(m => m.payComponentsRoutes),
    },
    {
        path: 'salary-slips',
        loadChildren: () => import('./salary-slips/salary-slips.routes').then(m => m.salarySlipsRoutes),
    },
    {
        path: 'talabat-occupation-rates',
        loadChildren: () => import('./talabat-occupation-rates/talabat-occupation-rates.routes').then(m => m.talabatOccupationRatesRoutes),
    },
];
