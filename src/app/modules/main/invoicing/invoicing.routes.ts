import { Route } from '@angular/router';
import { moduleReadGuard } from 'app/core/auth/guards/module-read.guard';
import { moduleWriteGuard } from 'app/core/auth/guards/module-write.guard';
import { InvoicingShellComponent } from './invoicing-shell.component';

export const invoicingRoutes: Route[] = [
    {
        path: '',
        component: InvoicingShellComponent,
        canActivate: [moduleReadGuard('invoice', '/main/dashboard')],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'insights' },
            {
                path: 'insights',
                loadComponent: () =>
                    import('./insights/invoicing-insights.component').then((m) => m.InvoicingInsightsComponent),
            },
            {
                path: 'invoices',
                loadComponent: () =>
                    import('./invoices/invoices-list.component').then((m) => m.InvoicesListComponent),
                data: { direction: 'receivable' },
            },
            {
                path: 'bills',
                loadComponent: () =>
                    import('./invoices/invoices-list.component').then((m) => m.InvoicesListComponent),
                data: { direction: 'payable' },
            },
            {
                path: 'invoices/new',
                canActivate: [moduleWriteGuard('invoice', '/main/invoicing/invoices')],
                loadComponent: () =>
                    import('./invoices/invoice-form.component').then((m) => m.InvoiceFormComponent),
                data: { direction: 'receivable' },
            },
            {
                path: 'bills/new',
                canActivate: [moduleWriteGuard('invoice', '/main/invoicing/bills')],
                loadComponent: () =>
                    import('./invoices/invoice-form.component').then((m) => m.InvoiceFormComponent),
                data: { direction: 'payable' },
            },
            {
                path: 'invoices/:id',
                loadComponent: () =>
                    import('./invoices/invoice-detail.component').then((m) => m.InvoiceDetailComponent),
                data: { direction: 'receivable' },
            },
            {
                path: 'bills/:id',
                loadComponent: () =>
                    import('./invoices/invoice-detail.component').then((m) => m.InvoiceDetailComponent),
                data: { direction: 'payable' },
            },
            {
                path: 'invoices/:id/edit',
                canActivate: [moduleWriteGuard('invoice', '/main/invoicing/invoices')],
                loadComponent: () =>
                    import('./invoices/invoice-form.component').then((m) => m.InvoiceFormComponent),
                data: { direction: 'receivable' },
            },
            {
                path: 'bills/:id/edit',
                canActivate: [moduleWriteGuard('invoice', '/main/invoicing/bills')],
                loadComponent: () =>
                    import('./invoices/invoice-form.component').then((m) => m.InvoiceFormComponent),
                data: { direction: 'payable' },
            },
            {
                path: 'parties',
                loadComponent: () =>
                    import('./parties/parties-list.component').then((m) => m.PartiesListComponent),
            },
            {
                path: 'ledger',
                loadComponent: () =>
                    import('./ledger/ledger-list.component').then((m) => m.LedgerListComponent),
            },
        ],
    },
];
