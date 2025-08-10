import { Prisma } from '../../generated/prisma/index.js';

export type LineInput = {
  productId: number;
  quantity: number;
  unitPrice: number; // in currency units
  taxRatePercent?: number; // e.g., 17 for 17%
};

export type TaxComputation = {
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};

export function computeTotals(lines: LineInput[], discount: number = 0): TaxComputation {
  const subtotal = lines
    .reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);

  const taxAmount = lines.reduce((acc, l) => {
    const lineSubtotal = l.quantity * l.unitPrice;
    const rate = l.taxRatePercent ? l.taxRatePercent / 100 : 0;
    return acc + lineSubtotal * rate;
  }, 0);

  const total = subtotal - discount + taxAmount;

  return {
    subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
    taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
    total: new Prisma.Decimal(total.toFixed(2)),
  };
}