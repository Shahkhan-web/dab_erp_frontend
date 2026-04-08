import { Route } from '@angular/router';
import { moduleWriteGuard } from 'app/core/auth/guards/module-write.guard';
import { SalarySlipFormComponent } from './salary-slip-form.component';
import { SalarySlipsListComponent } from './salary-slips-list.component';

export const salarySlipsRoutes: Route[] = [
    { path: '', component: SalarySlipsListComponent },
    {
        path: 'new',
        canActivate: [moduleWriteGuard('salarySlip', '/main/salary-slips')],
        component: SalarySlipFormComponent,
    },
    {
        path: 'employee/:employeeId/salary-slips/:salarySlipId/edit',
        canActivate: [moduleWriteGuard('salarySlip', '/main/salary-slips')],
        component: SalarySlipFormComponent,
    },
];
