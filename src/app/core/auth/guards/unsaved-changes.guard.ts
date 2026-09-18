import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ConfirmLeaveDialogComponent } from 'app/core/components/confirm-leave-dialog/confirm-leave-dialog.component';

/** Implemented by any routed component that can hold unsaved user input. */
export interface HasUnsavedChanges {
    hasUnsavedChanges(): boolean;
}

/**
 * Confirms before a route change throws away entered data. Covers in-app navigation
 * (sidebar, back button, links); leaving the tab entirely is handled by the
 * component's own `beforeunload` listener, which the router never sees.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
    if (!component?.hasUnsavedChanges?.()) return true;

    const dialog = inject(MatDialog);
    const ref = dialog.open(ConfirmLeaveDialogComponent, {
        width: '420px',
        disableClose: true,
        autoFocus: false,
    });
    return (await lastValueFrom(ref.afterClosed())) === true;
};
