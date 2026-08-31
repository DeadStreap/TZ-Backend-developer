import type { FastifyInstance } from 'fastify';
import { deliverOrder } from './delivery.service.js';
import { createSupplier } from './suppliers.js';
import { getPrisma } from '../../config/prisma.js';

const prisma = getPrisma();

const suppliers = [
  createSupplier('supplier_a', { errorRate: 0.2, timeoutRate: 0.1 }),
  createSupplier('supplier_b', { errorRate: 0.05, timeoutRate: 0.02 }),
];

export async function deliveryRoutes(app: FastifyInstance) {
  app.post<{ Params: { orderId: string } }>('/delivery/:orderId', async (request, reply) => {
    const { orderId } = request.params;

    const order = await prisma.order.findFirst({ where: { orderId } });
    if (!order) return reply.notFound('Order not found');
    if (order.status !== 'paid') return reply.badRequest(`Cannot deliver order in status: ${order.status}`);

    const result = await deliverOrder(orderId, suppliers);
    return { orderId, status: result.status, code: result.code, supplier: result.supplier, attempts: result.attempts };
  });
}
