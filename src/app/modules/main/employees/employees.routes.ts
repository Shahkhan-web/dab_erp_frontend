import { Route } from '@angular/router';
import { moduleWriteGuard } from 'app/core/auth/guards/module-write.guard';
import { EmployeesListComponent } from './employees-list.component';
import { EmployeeFormComponent } from './employee-form.component';

export const employeesRoutes: Route[] = [
    { path: '', component: EmployeesListComponent },
    {
        path: 'new',
        canActivate: [moduleWriteGuard('employee', '/main/employees')],
        component: EmployeeFormComponent,
    },
    {
        path: ':id/edit',
        canActivate: [moduleWriteGuard('employee', '/main/employees')],
        component: EmployeeFormComponent,
    },
];
