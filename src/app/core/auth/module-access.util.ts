/** Keys sent to / accepted from the users API (matches backend moduleAccess). */
export const USER_FORM_MODULE_KEYS = [
    'employee',
    'loan',
    'salarySlip',
    'payComponent',
    'talabatOccupationRate',
    'invoice',
    'asset',
] as const;

export type UserFormModuleKey = (typeof USER_FORM_MODULE_KEYS)[number];

export type ModuleAccessFlags = { read: boolean; write: boolean };

export type ModuleAccess = Partial<Record<UserFormModuleKey, ModuleAccessFlags>>;

export const USER_FORM_MODULE_LABELS: Record<UserFormModuleKey, string> = {
    employee: 'Employee',
    loan: 'Loan',
    salarySlip: 'Salary slip',
    payComponent: 'Pay component',
    talabatOccupationRate: 'Talabat occupation rate',
    invoice: 'Invoice',
    asset: 'Asset & Fleet',
};

/** Fuse nav `id` → moduleAccess key (for hiding items from managers). */
export const NAV_ID_TO_MODULE_KEY: Record<string, UserFormModuleKey> = {
    employees: 'employee',
    loans: 'loan',
    'pay-components': 'payComponent',
    'salary-slips': 'salarySlip',
    'talabat-occupation-rates': 'talabatOccupationRate',
    invoice: 'invoice',
    assets: 'asset',
};

/** auth/me returns `access`; user records may still use `moduleAccess`. */
export function getModuleAccessFromProfile(profile: any): ModuleAccess | undefined {
    const a = profile?.access ?? profile?.moduleAccess;
    if (!a || typeof a !== 'object') return undefined;
    return a as ModuleAccess;
}

export function isAdminProfile(profile: any): boolean {
    return profile?.role === 'admin';
}

/** Admins always have read; managers need `access[moduleKey].read`. */
export function hasModuleRead(profile: any, moduleKey: UserFormModuleKey): boolean {
    if (isAdminProfile(profile)) {
        return true;
    }
    const access = getModuleAccessFromProfile(profile);
    return access?.[moduleKey]?.read === true;
}

/** Admins always have write; managers need `access[moduleKey].write`. */
export function hasModuleWrite(profile: any, moduleKey: UserFormModuleKey): boolean {
    if (isAdminProfile(profile)) {
        return true;
    }
    const access = getModuleAccessFromProfile(profile);
    return access?.[moduleKey]?.write === true;
}

/** Admin configures all modules; manager only rows where they have write on that module. */
export function getUserFormVisibleModuleKeys(profile: any): UserFormModuleKey[] {
    if (isAdminProfile(profile)) {
        return [...USER_FORM_MODULE_KEYS];
    }
    const access = getModuleAccessFromProfile(profile);
    if (!access) return [];
    return USER_FORM_MODULE_KEYS.filter((k) => access[k]?.write === true);
}

export function defaultModuleAccess(): ModuleAccess {
    const m: ModuleAccess = {};
    for (const k of USER_FORM_MODULE_KEYS) {
        m[k] = { read: false, write: false };
    }
    return m;
}

export function mergeModuleAccess(partial: unknown): ModuleAccess {
    const base = defaultModuleAccess();
    if (!partial || typeof partial !== 'object') return base;
    for (const k of USER_FORM_MODULE_KEYS) {
        const row = (partial as ModuleAccess)[k];
        if (row && typeof row === 'object') {
            base[k] = {
                read: !!row.read,
                write: !!row.write,
            };
        }
    }
    return base;
}
