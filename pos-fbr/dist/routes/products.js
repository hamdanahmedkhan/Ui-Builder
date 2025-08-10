import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
export const router = Router();
const productSchema = z.object({
    sku: z.string(),
    name: z.string(),
    description: z.string().optional(),
    categoryId: z.number().int().optional(),
    price: z.number().nonnegative(),
    cost: z.number().nonnegative().optional(),
    taxRateId: z.number().int().optional(),
    inventoryQuantity: z.number().int().nonnegative().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
router.get('/', async (_req, res) => {
    const products = await prisma.product.findMany({
        include: { category: true, taxRate: true },
        orderBy: { id: 'desc' },
    });
    res.json(products);
});
router.post('/', async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const created = await prisma.product.create({ data: parsed.data });
    res.status(201).json(created);
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product)
        return res.status(404).json({ error: 'Not found' });
    res.json(product);
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const updated = await prisma.product.update({ where: { id }, data: parsed.data });
    res.json(updated);
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.status(204).end();
});
