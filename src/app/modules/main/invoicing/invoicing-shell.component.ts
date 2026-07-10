import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BackButtonComponent } from 'app/core/components/back-button/back-button.component';

@Component({
    selector: 'app-invoicing-shell',
    standalone: true,
    imports: [
        CommonModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        MatButtonModule,
        MatIconModule,
        BackButtonComponent,
    ],
    templateUrl: './invoicing-shell.component.html',
})
export class InvoicingShellComponent {
    readonly tabs = [
        { path: '/main/invoicing/insights', label: 'Insights', exact: true },
        { path: '/main/invoicing/invoices', label: 'Invoices', exact: false },
        { path: '/main/invoicing/bills', label: 'Bills', exact: false },
        { path: '/main/invoicing/parties', label: 'Parties', exact: true },
        { path: '/main/invoicing/ledger', label: 'Ledger', exact: true },
    ];
}
