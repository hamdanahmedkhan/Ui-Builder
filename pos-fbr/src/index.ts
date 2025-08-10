import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { json, urlencoded } from 'express';
import { router as productRouter } from './routes/products.js';
import { router as customerRouter } from './routes/customers.js';
import { router as invoiceRouter } from './routes/invoices.js';

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(json({ limit: '2mb' }));
app.use(urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pos-fbr', time: new Date().toISOString() });
});

app.use('/api/products', productRouter);
app.use('/api/customers', customerRouter);
app.use('/api/invoices', invoiceRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`POS server listening on http://localhost:${PORT}`);
});