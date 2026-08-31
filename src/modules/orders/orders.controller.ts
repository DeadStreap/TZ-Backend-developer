import type { FastifyInstance } from 'fastify';
import { createOrder, getOrder } from './orders.service.js';
import { CreateOrderSchema, OrderParamsSchema } from './orders.schema.js';

export async function ordersRoutes(app: FastifyInstance) {
  app.post('/orders', async (request, reply) => {
    const parsed = CreateOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues[0].message);
    }

    try {
      const order = await createOrder(parsed.data);
      return reply.status(201).send(order);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.notFound(error.message);
      }
      throw error;
    }
  });

  app.get('/orders/:orderId', async (request, reply) => {
    const parsed = OrderParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues[0].message);
    }

    const order = await getOrder(parsed.data.orderId);
    if (!order) {
      return reply.notFound('Order not found');
    }
    return order;
  });
}
