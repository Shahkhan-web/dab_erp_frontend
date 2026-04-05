import { Route } from '@angular/router';
import { moduleWriteGuard } from 'app/core/auth/guards/module-write.guard';
import { LoanFormComponent } from './loan-form.component';
import { LoansListComponent } from './loans-list.component';

export const loansRoutes: Route[] = [
    { path: '', component: LoansListComponent },
    {
        path: 'new',
        canActivate: [moduleWriteGuard('loan', '/main/loans')],
        component: LoanFormComponent,
    },
];
