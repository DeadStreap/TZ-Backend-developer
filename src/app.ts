import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { ordersRoutes } from './modules/orders/orders.controller.js';
import { paymentsRoutes } from './modules/payments/payments.controller.js';
import { catalogRoutes } from './modules/catalog/catalog.controller.js';
import { deliveryRoutes } from './modules/delivery/delivery.controller.js';
import { reconciliationRoutes } from './modules/reconciliation/reconciliation.controller.js';
import { env } from './config/env.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.LOG_LEVEL === 'debug'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors);
  await app.register(sensible);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(ordersRoutes);
  await app.register(paymentsRoutes);
  await app.register(catalogRoutes);
  await app.register(deliveryRoutes);
  await app.register(reconciliationRoutes);

  return app;
}
