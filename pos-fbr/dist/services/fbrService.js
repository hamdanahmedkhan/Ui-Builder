import axios from 'axios';
import { env } from '../config/env.js';
export function generateQrText(input) {
    const parts = [
        `INV:${input.invoiceNumber}`,
        `TOT:${input.total.toFixed(2)}`,
        `TAX:${input.taxAmount.toFixed(2)}`,
    ];
    if (input.ntn)
        parts.push(`NTN:${input.ntn}`);
    return parts.join('|');
}
export async function submitInvoice(payload) {
    if (!env.fbr.enabled) {
        return {
            success: true,
            invoiceId: `SIM-${payload.invoiceNumber}`,
            statusText: 'FBR disabled (simulated)',
            qrText: generateQrText({
                invoiceNumber: payload.invoiceNumber,
                total: payload.total,
                taxAmount: payload.taxAmount,
                ntn: env.fbr.ntn,
            }),
        };
    }
    try {
        const url = `${env.fbr.baseUrl}/invoices`;
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Id': env.fbr.clientId,
                'X-Client-Secret': env.fbr.clientSecret,
            },
            timeout: 15000,
        });
        const data = response.data || {};
        return {
            success: true,
            invoiceId: data.invoiceId || data.id || payload.invoiceNumber,
            statusText: 'SUBMITTED',
            qrText: data.qrText || generateQrText({
                invoiceNumber: payload.invoiceNumber,
                total: payload.total,
                taxAmount: payload.taxAmount,
                ntn: env.fbr.ntn,
            }),
            raw: data,
        };
    }
    catch (error) {
        return {
            success: false,
            statusText: error?.message || 'FBR submission failed',
            raw: error?.response?.data || null,
        };
    }
}
