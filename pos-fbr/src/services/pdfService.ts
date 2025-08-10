import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

export type InvoicePdfInput = {
  number: string;
  date: string;
  customerName?: string;
  lines: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  qrText?: string;
};

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<string> {
  const storageDir = path.resolve('storage', 'invoices');
  fs.mkdirSync(storageDir, { recursive: true });
  const filePath = path.join(storageDir, `${input.number}.pdf`);

  const doc = new PDFDocument({ margin: 40 });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(18).text(env.store.name, { align: 'left' });
  doc.fontSize(10).text(env.store.address);
  if (env.store.phone) doc.text(`Phone: ${env.store.phone}`);

  doc.moveDown();
  doc.fontSize(14).text(`Invoice #${input.number}`);
  doc.fontSize(10).text(`Date: ${input.date}`);
  if (input.customerName) doc.text(`Customer: ${input.customerName}`);

  doc.moveDown();
  doc.fontSize(12).text('Items');
  doc.moveDown(0.5);

  // Table header
  doc.fontSize(10).text('Name', { continued: true, width: 220 });
  doc.text('Qty', { continued: true, width: 60 });
  doc.text('Price', { continued: true, width: 100 });
  doc.text('Total');

  input.lines.forEach((l) => {
    doc.text(l.name, { continued: true, width: 220 });
    doc.text(String(l.quantity), { continued: true, width: 60 });
    doc.text(l.unitPrice.toFixed(2), { continued: true, width: 100 });
    doc.text(l.lineTotal.toFixed(2));
  });

  doc.moveDown();
  doc.text(`Subtotal: ${input.subtotal.toFixed(2)}`);
  if (input.discount) doc.text(`Discount: ${input.discount.toFixed(2)}`);
  doc.text(`Tax: ${input.taxAmount.toFixed(2)}`);
  doc.fontSize(12).text(`Total: ${input.total.toFixed(2)}`);

  if (input.qrText) {
    const qrDataUrl = await QRCode.toDataURL(input.qrText, { margin: 1, width: 128 });
    const base64 = qrDataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    doc.image(buf, { fit: [128, 128] });
    doc.moveDown();
    doc.fontSize(8).text(input.qrText);
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', () => resolve());
    writeStream.on('error', (e) => reject(e));
  });

  return filePath;
}