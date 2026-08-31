import type { FastifyInstance } from 'fastify';
import { getCatalog, getStock } from './catalog.service.js';

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/catalog', async () => {
    const products = await getCatalog();
    return { products, total: products.length };
  });

  app.get<{ Params: { sku: string } }>('/catalog/:sku/stock', async (request) => {
    const stock = await getStock(request.params.sku);
    return { sku: request.params.sku, stock };
  });
}
