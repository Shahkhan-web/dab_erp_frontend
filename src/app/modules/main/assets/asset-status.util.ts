import { Asset, AssetStatus } from './assets.service';

export const ASSET_STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
    { value: 'available', label: 'Available' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'under_maintenance', label: 'Under Maintenance' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'lost', label: 'Lost' },
    { value: 'retired', label: 'Retired' },
];

/** Statuses always available as manual PATCH targets (excluding assign/return pair). */
const MANUAL_STATUS_TARGETS: AssetStatus[] = ['under_maintenance', 'damaged', 'lost', 'retired'];

export function getAssetStatusLabel(status: AssetStatus | undefined): string {
    if (!status) return '';
    return ASSET_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function getAssetStatusClass(status: AssetStatus | undefined): string {
    if (!status) return '';
    switch (status) {
        case 'available':
            return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
        case 'assigned':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300';
        case 'under_maintenance':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
        case 'damaged':
        case 'lost':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300';
        case 'retired':
            return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300';
        default:
            return 'bg-zinc-100 text-zinc-800';
    }
}

export function isAssetLinkedToEmployee(asset: Asset): boolean {
    if (typeof asset.assignedToEmployeeId === 'string' && asset.assignedToEmployeeId.trim()) {
        return true;
    }
    if (asset.assignedToEmployee && typeof asset.assignedToEmployee === 'object') {
        return true;
    }
    if (asset.currentAssignment && !asset.currentAssignment.returnedAt) {
        return true;
    }
    return !!asset.assignments?.some((assignment) => !assignment.returnedAt);
}

/**
 * Allowed target statuses for PATCH /assets/:id/status.
 * `available` ↔ `assigned` for new assignment/return use assign/return endpoints,
 * except restoring `assigned` after maintenance when still linked to an employee.
 */
export function getAllowedManualStatusTargets(asset: Asset): AssetStatus[] {
    const current = asset.status;
    const linked = isAssetLinkedToEmployee(asset);

    if (current === 'available' || current === 'assigned') {
        return [...MANUAL_STATUS_TARGETS];
    }

    const targets: AssetStatus[] = [...MANUAL_STATUS_TARGETS];
    if (linked) {
        targets.push('assigned');
    } else {
        targets.push('available');
    }
    return targets;
}

/** Dropdown options: current status plus allowed manual transition targets. */
export function getAssetStatusDropdownOptions(asset: Asset): { value: AssetStatus; label: string }[] {
    const targets = getAllowedManualStatusTargets(asset);
    const seen = new Set<AssetStatus>();
    const options: { value: AssetStatus; label: string }[] = [];

    const add = (status: AssetStatus): void => {
        if (seen.has(status)) return;
        seen.add(status);
        options.push({ value: status, label: getAssetStatusLabel(status) });
    };

    add(asset.status);
    for (const status of targets) {
        add(status);
    }

    return options;
}

export function canChangeAssetStatusViaDropdown(asset: Asset): boolean {
    return getAllowedManualStatusTargets(asset).some((status) => status !== asset.status);
}

export function isAssetLinkedButNotAssigned(asset: Asset): boolean {
    return asset.status !== 'assigned' && isAssetLinkedToEmployee(asset);
}
