import { getPrisma } from '../../config/prisma.js';

const prisma = getPrisma();

export async function getCatalog() {
  return prisma.product.findMany({ orderBy: { price: 'asc' } });
}

export async function getStock(sku: string): Promise<number> {
  const result = await prisma.$queryRaw`
    SELECT COUNT(*) as available FROM "Key" WHERE sku = ${sku} AND status = 'available'
  ` as { available: number }[];
  return Number(result[0].available);
}
