import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const router = Router();

const customerSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  taxId: z.string().optional(),
  type: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

router.get('/', async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { id: 'desc' } });
  res.json(customers);
});

router.post('/', async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const created = await prisma.customer.create({ data: parsed.data });
  res.status(201).json(created);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return res.status(404).json({ error: 'Not found' });
  res.json(customer);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const updated = await prisma.customer.update({ where: { id }, data: parsed.data });
  res.json(updated);
});