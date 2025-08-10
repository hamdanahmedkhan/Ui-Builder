import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../prisma.js';
import { computeTotals } from '../services/taxService.js';
import { submitInvoice } from '../services/fbrService.js';
import { generateInvoicePdf } from '../services/pdfService.js';
import { Prisma } from '../../generated/prisma/index.js';

export const router = Router();

const lineSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

const invoiceSchema = z.object({
  customerId: z.number().int().optional(),
  discount: z.number().nonnegative().optional().default(0),
  lines: z.array(lineSchema).min(1),
  payments: z.array(z.object({ method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET']), amount: z.number().nonnegative() })).optional(),
});

router.get('/', async (_req, res) => {
  const receipts = await prisma.receipt.findMany({ orderBy: { id: 'desc' }, include: { items: true, payments: true, customer: true } });
  res.json(receipts);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { items: { include: { product: true } }, payments: true, customer: true } });
  if (!receipt) return res.status(404).json({ error: 'Not found' });
  res.json(receipt);
});

router.post('/', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { customerId, discount, lines, payments } = parsed.data;

  // Fetch products and compute prices/taxes
  const productIds = lines.map((l) => l.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { taxRate: true } });
  const productMap = new Map(products.map((p) => [p.id, p] as const));

  const pricedLines = lines.map((l) => {
    const product = productMap.get(l.productId);
    if (!product) throw new Error(`Product ${l.productId} not found`);
    const unitPrice = l.unitPrice ?? Number(product.price);
    const taxRatePercent = product.taxRate ? Number(product.taxRate.rate) : 0;
    return { product, quantity: l.quantity, unitPrice, taxRatePercent };
  });

  const totals = computeTotals(
    pricedLines.map((pl) => ({ productId: pl.product.id, quantity: pl.quantity, unitPrice: pl.unitPrice, taxRatePercent: pl.taxRatePercent })),
    discount || 0,
  );

  // Create receipt + items + payments in a transaction
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.receipt.count();
    const number = `INV-${dayjs().format('YYYYMMDD')}-${String(count + 1).padStart(5, '0')}`;

    const receipt = await tx.receipt.create({
      data: {
        number,
        date: new Date(),
        customerId: customerId ?? null,
        subtotal: totals.subtotal,
        discount: new Prisma.Decimal((discount || 0).toFixed(2)),
        taxAmount: totals.taxAmount,
        total: totals.total,
        paymentStatus: 'UNPAID',
      },
    });

    // Items and stock movement
    for (const pl of pricedLines) {
      const lineTotal = pl.unitPrice * pl.quantity;
      await tx.receiptItem.create({
        data: {
          receiptId: receipt.id,
          productId: pl.product.id,
          quantity: pl.quantity,
          unitPrice: new Prisma.Decimal(pl.unitPrice.toFixed(2)),
          lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
          taxRateId: pl.product.taxRateId ?? null,
        },
      });

      await tx.product.update({
        where: { id: pl.product.id },
        data: { inventoryQuantity: { decrement: pl.quantity } },
      });

      await tx.stockMovement.create({ data: { productId: pl.product.id, quantity: -pl.quantity, type: 'SALE', note: `Receipt ${receipt.number}` } });
    }

    // Payments
    if (payments && payments.length > 0) {
      for (const p of payments) {
        await tx.payment.create({ data: { receiptId: receipt.id, method: p.method, amount: new Prisma.Decimal(p.amount.toFixed(2)) } });
      }
      const paid = payments.reduce((a, b) => a + b.amount, 0);
      let status: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
      if (paid >= Number(totals.total)) status = 'PAID';
      else if (paid > 0) status = 'PARTIAL';
      await tx.receipt.update({ where: { id: receipt.id }, data: { paymentStatus: status } });
    }

    return receipt;
  });

  // FBR Submission (async but awaited here)
  const fbrPayload = {
    invoiceNumber: created.number,
    date: created.date.toISOString(),
    subtotal: Number(totals.subtotal),
    taxAmount: Number(totals.taxAmount),
    total: Number(totals.total),
    items: pricedLines.map((pl) => ({ productId: pl.product.id, name: pl.product.name, quantity: pl.quantity, unitPrice: pl.unitPrice, taxPercent: pl.taxRatePercent })),
  };

  const fbrResult = await submitInvoice(fbrPayload);
  await prisma.receipt.update({ where: { id: created.id }, data: { fbrInvoiceId: fbrResult.invoiceId || null, fbrStatus: fbrResult.statusText || null, fbrQrText: fbrResult.qrText || null } });
  await prisma.fbrLog.create({ data: { receiptId: created.id, success: fbrResult.success, statusCode: fbrResult.success ? 200 : 500, requestBody: fbrPayload as any, responseBody: fbrResult.raw as any } });

  // PDF
  const customer = created.customerId ? await prisma.customer.findUnique({ where: { id: created.customerId } }) : null;
  const pdfPath = await generateInvoicePdf({
    number: created.number,
    date: created.date.toISOString(),
    customerName: customer?.name,
    lines: pricedLines.map((pl) => ({ name: pl.product.name, quantity: pl.quantity, unitPrice: pl.unitPrice, lineTotal: pl.unitPrice * pl.quantity })),
    subtotal: Number(totals.subtotal),
    discount: discount || 0,
    taxAmount: Number(totals.taxAmount),
    total: Number(totals.total),
    qrText: fbrResult.qrText,
  });
  await prisma.receipt.update({ where: { id: created.id }, data: { pdfPath } });

  const full = await prisma.receipt.findUnique({ where: { id: created.id }, include: { items: { include: { product: true } }, payments: true, customer: true } });

  res.status(201).json(full);
});