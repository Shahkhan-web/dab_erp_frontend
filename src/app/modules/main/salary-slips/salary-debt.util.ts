import { SalarySlipListItem } from './salary-slips.service';

/** Parse API money fields that may be number, numeric string, or wrapped objects. */
export function parseMoneyField(value: unknown): number {
    if (value == null) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Number(value.trim());
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

export function sumLoanDeductions(slip: SalarySlipListItem): number {
    return (slip.loanDeductions ?? []).reduce(
        (sum, ld) => sum + (Number(ld.loanDeductedAmount) || 0),
        0
    );
}

export function sumDeductionLines(slip: SalarySlipListItem): number {
    return (slip.lines ?? [])
        .filter((l) => (l.componentType ?? '').toLowerCase() === 'deduction')
        .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
}

/** Rider/Talabat fields that count toward total deduction (not earnings). */
export function sumRiderDeductionFields(slip: SalarySlipListItem): number {
    return (
        parseMoneyField(slip.codDeduction) +
        parseMoneyField(slip.inventoryDeduction) +
        parseMoneyField(slip.clawbackDeduction)
    );
}

export function visibleDeductionTotal(slip: SalarySlipListItem): number {
    return sumLoanDeductions(slip) + sumDeductionLines(slip) + sumRiderDeductionFields(slip);
}

/** Portion of totalDeduction not explained by visible line items (carried-forward salary debt). */
export function inferredCarriedDebtDeduction(slip: SalarySlipListItem): number {
    const total = Number(slip.totalDeduction) || 0;
    const visible = visibleDeductionTotal(slip);
    const diff = total - visible;
    return diff > 0.005 ? diff : 0;
}

/**
 * A negative net means the slip created carried-forward debt rather than a payment.
 * `netPayment` can arrive as a numeric string, so parse before comparing.
 */
export function createsSalaryDebt(slip: SalarySlipListItem): boolean {
    return parseMoneyField(slip?.netPayment) < 0;
}

export function shortSlipId(id: string | null | undefined): string {
    const s = String(id ?? '').trim();
    if (!s) return '—';
    return s.length <= 8 ? s : `${s.slice(0, 8)}…`;
}
