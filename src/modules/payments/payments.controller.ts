import type { FastifyInstance } from 'fastify';
import { handlePaymentWebhook } from './payments.service.js';
import { PaymentWebhookSchema } from './payments.schema.js';

export async function paymentsRoutes(app: FastifyInstance) {
  app.post('/webhook/payment', async (request, reply) => {
    const parsed = PaymentWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues[0].message);
    }

    const result = await handlePaymentWebhook(parsed.data);
    if (result.status === 'order_not_found') {
      return reply.notFound(`Order ${result.orderId} not found`);
    }

    return reply.status(200).send({ received: true });
  });
}
