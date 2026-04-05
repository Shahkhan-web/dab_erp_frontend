import { Injectable } from '@angular/core';

export interface ChargeEngineLine {
  id?: string;
  productId: string;
  quantity: number;
  grossQuantity?: number;
  netQuantity?: number;
  unitPrice: number;
  pricePerQuantity?: number | null;
  amount?: number;
}

export interface ChargeLinePayload {
  chargeTypeId: string;
  effect: number;
  isTax: boolean;
  level: number;
  amount: number;
  baseAmount?: number | null;
  baseQuantity?: number | null;
  lineId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ChargeEngineService {

  calculateForGrn(
    grnHeader: any,
    lines: ChargeEngineLine[],
    chargeTypes: any[],
    chargeRules: any[]
  ): { chargeLines: ChargeLinePayload[]; adjustedLines: ChargeEngineLine[] } {
    const purchaseChargeTypes = (chargeTypes || []).filter((ct: any) =>
      this.isForPurchase(ct) && Number(ct?.postOn) === 1
    );
    const relevantRules = (chargeRules || []).filter((r: any) =>
      this.isRuleActive(r) && this.matchesGrnDocumentType(r)
    );

    return this.applyChargesInternal('GRN', grnHeader, lines, purchaseChargeTypes, relevantRules);
  }

  calculateForSupplierInvoice(
    invoiceHeader: any,
    lines: ChargeEngineLine[],
    chargeTypes: any[],
    chargeRules: any[]
  ): { chargeLines: ChargeLinePayload[]; adjustedLines: ChargeEngineLine[] } {
    const hasGrnSource =
      !!invoiceHeader?.grnReceiptId ||
      (Array.isArray(invoiceHeader?.grnReceiptIds) && invoiceHeader.grnReceiptIds.length > 0);

    const purchaseChargeTypes = (chargeTypes || []).filter((ct: any) => {
      if (!this.isForPurchase(ct)) return false;
      const postOn = Number(ct?.postOn) || 0;

      // Always include explicit invoice charges
      if (postOn === 2) return true;

      // Also include GRN-based charges when invoice is created from GRN(s)
      if (postOn === 1 && hasGrnSource) return true;

      return false;
    });

    const relevantRules = (chargeRules || []).filter((r: any) =>
      this.isRuleActive(r) && this.matchesSupplierInvoiceDocumentType(r)
    );

    return this.applyChargesInternal('SupplierInvoice', invoiceHeader, lines, purchaseChargeTypes, relevantRules);
  }

  private applyChargesInternal(
    docType: 'GRN' | 'SupplierInvoice',
    header: any,
    lines: ChargeEngineLine[],
    chargeTypes: any[],
    rules: any[]
  ): { chargeLines: ChargeLinePayload[]; adjustedLines: ChargeEngineLine[] } {
    const safeLines: ChargeEngineLine[] = (lines || []).map(l => ({
      ...l,
      quantity: Number(l.quantity) || 0,
      grossQuantity: l.grossQuantity != null ? Number(l.grossQuantity) || 0 : undefined,
      netQuantity: l.netQuantity != null ? Number(l.netQuantity) || 0 : undefined,
      unitPrice: Number(l.unitPrice) || 0,
      pricePerQuantity: l.pricePerQuantity != null ? Number(l.pricePerQuantity) || 0 : null,
      amount: l.amount != null ? Number(l.amount) || 0 : undefined
    }));

    const chargeLines: ChargeLinePayload[] = [];
    let adjustedLines = [...safeLines];

    const now = new Date();

    for (const ct of chargeTypes || []) {
      const ctId = String(ct?.id ?? '');
      if (!ctId) continue;

      const rulesForType = (rules || [])
        .filter((r: any) => String(r?.chargeTypeId ?? '') === ctId)
        .filter((r: any) => this.isRuleWithinDate(r, now))
        .sort((a: any, b: any) => (Number(a?.priority) || 0) - (Number(b?.priority) || 0));

      // If no explicit rules are defined for this charge type, still apply
      // a default "rule" that simply uses the charge type's own defaults.
      const effectiveRules = rulesForType.length ? rulesForType : [null];

      const applicableLevel = Number(ct?.applicableLevel) || 1;

      if (applicableLevel === 1) {
        const headerCharge = this.calculateHeaderCharge(docType, ct, effectiveRules, adjustedLines);
        if (headerCharge) {
          chargeLines.push(headerCharge);
        }
      } else if (applicableLevel === 2) {
        const lineResult = this.calculateLineCharges(docType, ct, effectiveRules, adjustedLines);
        adjustedLines = lineResult.adjustedLines;
        chargeLines.push(...lineResult.chargeLines);
      }
    }

    return { chargeLines, adjustedLines };
  }

  private isForPurchase(ct: any): boolean {
    const applicableTo = Number(ct?.applicableTo) || 0;
    return applicableTo === 1 || applicableTo === 3;
  }

  private isRuleActive(rule: any): boolean {
    if (!rule) return false;
    return true;
  }

  private isRuleWithinDate(rule: any, now: Date): boolean {
    if (!rule) return true;
    const from = rule.effectiveFrom ? new Date(rule.effectiveFrom) : null;
    const to = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
    if (from && now < from) return false;
    if (to && now > to) return false;
    return true;
  }

  private matchesSupplierInvoiceDocumentType(rule: any): boolean {
    const docType = rule?.documentType;
    if (docType == null || docType === '') return true;
    return Number(docType) === 2;
  }

  private matchesGrnDocumentType(rule: any): boolean {
    const docType = rule?.documentType;
    if (docType == null || docType === '') return true;
    if (Number(docType) === 1) return true;
    return false;
  }

  private calculateHeaderCharge(
    docType: 'GRN' | 'SupplierInvoice',
    ct: any,
    rules: any[],
    lines: ChargeEngineLine[]
  ): ChargeLinePayload | null {
    if (!lines.length) return null;

    const subtotal = lines.reduce((sum, l) => sum + this.safeAmount(l), 0);
    const totalQty = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const totalGross = lines.reduce((sum, l) => sum + (Number(l.grossQuantity ?? l.quantity) || 0), 0);
    const totalNet = lines.reduce((sum, l) => sum + (Number(l.netQuantity ?? l.quantity) || 0), 0);

    const rule = rules.find((r: any) => {
      const base = this.getHeaderBase(ct, subtotal, totalQty, totalGross, totalNet);
      if (base == null) return false;
      if (!r) return true; // default "rule" when no rules defined for this charge type
      const minBase = r?.minBaseAmount != null && r.minBaseAmount !== '' ? Number(r.minBaseAmount) : null;
      const maxBase = r?.maxBaseAmount != null && r.maxBaseAmount !== '' ? Number(r.maxBaseAmount) : null;
      if (minBase != null && base < minBase) return false;
      if (maxBase != null && base > maxBase) return false;
      return true;
    });

    // Only skip when no rule matched (undefined); null means "use charge type defaults"
    if (rule === undefined) return null;

    const base = this.getHeaderBase(ct, subtotal, totalQty, totalGross, totalNet);
    if (base == null || base === 0) return null;

    const rate = rule && rule.rateOrAmountOverride != null && rule.rateOrAmountOverride !== ''
      ? Number(rule.rateOrAmountOverride) || 0
      : Number(ct?.defaultRateOrAmount) || 0;

    const rawAmount = this.computeAmount(ct, rate, base);
    if (!rawAmount) return null;

    const effect = Number(ct?.effect) || 1;
    const signedAmount = effect === 2 ? -rawAmount : rawAmount;

    const nature = Number(ct?.chargeNature) || 1;

    return {
      chargeTypeId: String(ct.id),
      effect,
      isTax: !!ct?.isTax,
      level: 1,
      amount: this.roundMoney(signedAmount),
      baseAmount: nature === 1 ? base : null,
      baseQuantity: nature === 2 ? base : null,
      lineId: null
    };
  }

  private calculateLineCharges(
    docType: 'GRN' | 'SupplierInvoice',
    ct: any,
    rules: any[],
    lines: ChargeEngineLine[]
  ): { adjustedLines: ChargeEngineLine[]; chargeLines: ChargeLinePayload[] } {
    const adjustedLines: ChargeEngineLine[] = [];
    const chargeLines: ChargeLinePayload[] = [];

    const nature = Number(ct?.chargeNature) || 1;
    const calcType = Number(ct?.calculationType) || 1;
    const affectsStock = !!ct?.affectsStock;
    const affectsBilling = !!ct?.affectsBilling;
    const effect = Number(ct?.effect) || 1;

    for (const line of lines) {
      let updated: ChargeEngineLine = { ...line };

      const baseQtyGross = Number(line.grossQuantity ?? line.quantity) || 0;
      const baseQtyNet = Number(line.netQuantity ?? line.quantity) || 0;
      const lineAmount = this.safeAmount(line);

      const rule = rules.find((r: any) => {
        const base = this.getLineBase(ct, baseQtyGross, baseQtyNet, lineAmount);
        if (base == null) return false;
        if (!r) return true;
        const minBase = r?.minBaseAmount != null && r.minBaseAmount !== '' ? Number(r.minBaseAmount) : null;
        const maxBase = r?.maxBaseAmount != null && r.maxBaseAmount !== '' ? Number(r.maxBaseAmount) : null;
        if (minBase != null && base < minBase) return false;
        if (maxBase != null && base > maxBase) return false;
        return true;
      });

      if (rule !== undefined) {
        const base = this.getLineBase(ct, baseQtyGross, baseQtyNet, lineAmount);
        if (base != null && base !== 0) {
          const rate = rule && rule.rateOrAmountOverride != null && rule.rateOrAmountOverride !== ''
            ? Number(rule.rateOrAmountOverride) || 0
            : Number(ct?.defaultRateOrAmount) || 0;

          const rawAmount = this.computeAmount(ct, rate, base);
          if (rawAmount) {
            const signedAmount = effect === 2 ? -rawAmount : rawAmount;

            if (docType === 'GRN' && nature === 2 && calcType === 1 && affectsStock) {
              const deductionQty = rawAmount;
              const currentQty = Number(updated.netQuantity ?? updated.quantity) || 0;
              const newNet = Math.max(0, currentQty - deductionQty);
              updated = {
                ...updated,
                netQuantity: newNet
              };
              if (affectsBilling) {
                const unitPrice = Number(updated.unitPrice) || 0;
                updated.amount = this.roundMoney(newNet * unitPrice);
              }
            }

            const baseIsQuantity = nature === 2;

            chargeLines.push({
              chargeTypeId: String(ct.id),
              effect,
              isTax: !!ct?.isTax,
              level: 2,
              amount: this.roundMoney(signedAmount),
              baseAmount: baseIsQuantity ? null : base,
              baseQuantity: baseIsQuantity ? base : null,
              lineId: line.id ?? null
            });
          }
        }
      }

      adjustedLines.push(updated);
    }

    return { adjustedLines, chargeLines };
  }

  private getHeaderBase(
    ct: any,
    subtotal: number,
    totalQty: number,
    totalGross: number,
    totalNet: number
  ): number | null {
    const nature = Number(ct?.chargeNature) || 1;
    const calcType = Number(ct?.calculationType) || 1;
    const billingBasis = Number(ct?.billingBasis) || 0;

    if (nature === 1) {
      return subtotal;
    }

    if (calcType === 4) {
      if (billingBasis === 1) return totalGross || totalQty;
      if (billingBasis === 2) return totalNet || totalQty;
      return totalNet || totalGross || totalQty;
    }

    if (billingBasis === 1) return totalGross || totalQty;
    if (billingBasis === 2) return totalNet || totalQty;
    return totalQty || null;
  }

  private getLineBase(
    ct: any,
    baseQtyGross: number,
    baseQtyNet: number,
    lineAmount: number
  ): number | null {
    const calcType = Number(ct?.calculationType) || 1;
    const nature = Number(ct?.chargeNature) || 1;
    const stockBasis = Number(ct?.stockBasis) || 0;

    // PerWeight / per-unit calculation must use quantity (weight), not value
    if (calcType === 4 || calcType === 5) {
      if (stockBasis === 1) return baseQtyGross;
      if (stockBasis === 2) return baseQtyNet;
      return baseQtyNet || baseQtyGross || null;
    }

    if (nature === 1) {
      return lineAmount;
    }

    if (stockBasis === 1) return baseQtyGross;
    if (stockBasis === 2) return baseQtyNet;
    return baseQtyNet || baseQtyGross;
  }

  private computeAmount(ct: any, rate: number, base: number): number {
    const calcType = Number(ct?.calculationType) || 1;
    if (!base || !Number.isFinite(base)) return 0;
    if (!Number.isFinite(rate)) return 0;

    switch (calcType) {
      case 1:
        return base * (rate / 100);
      case 2:
        return rate;
      case 3:
      case 4:
        return base * rate;
      case 5:
        // PerQuantity: rate is percentage, amount = quantity × (rate / 100)
        return base * (rate / 100);
      default:
        return 0;
    }
  }

  private roundMoney(v: number): number {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  private safeAmount(line: ChargeEngineLine): number {
    if (line.amount != null && !Number.isNaN(Number(line.amount))) {
      return Number(line.amount) || 0;
    }
    const qty = Number(line.netQuantity ?? line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    return qty * price;
  }
}

