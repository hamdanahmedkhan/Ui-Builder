import { prisma } from './prisma.js';
import { Prisma } from '../generated/prisma/index.js';

async function main() {
  const salesTax = await prisma.taxRate.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Sales Tax', type: 'SALES_TAX', rate: new Prisma.Decimal('17.000'), isDefault: true },
  });

  await prisma.category.upsert({ where: { id: 1 }, update: {}, create: { name: 'General' } });

  const prodCount = await prisma.product.count();
  if (prodCount === 0) {
    await prisma.product.create({
      data: {
        sku: 'SKU-001',
        name: 'Sample Item',
        description: 'Demo product',
        categoryId: 1,
        price: new Prisma.Decimal('100.00'),
        cost: new Prisma.Decimal('70.00'),
        taxRateId: salesTax.id,
        inventoryQuantity: 100,
      },
    });
  }

  const custCount = await prisma.customer.count();
  if (custCount === 0) {
    await prisma.customer.create({ data: { name: 'Walk-in Customer' } });
  }

  await prisma.setting.upsert({ where: { key: 'currency' }, update: { value: 'PKR' }, create: { key: 'currency', value: 'PKR' } });

  // eslint-disable-next-line no-console
  console.log('Seed completed');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });