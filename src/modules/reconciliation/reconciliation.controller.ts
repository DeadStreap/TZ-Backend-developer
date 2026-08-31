import type { FastifyInstance } from 'fastify';
import { fullReconciliation, getAuditTrail, getStuckOrders, recoverStuckOrders } from './reconciliation.service.js';

export async function reconciliationRoutes(app: FastifyInstance) {
  app.get('/reconciliation', async () => fullReconciliation());

  app.get('/audit-trail', async (request) => {
    const limit = Number((request.query as any)?.limit ?? 100);
    return getAuditTrail(limit);
  });

  app.get('/stuck-orders', async (request) => {
    const minutes = Number((request.query as any)?.minutes ?? 5);
    return getStuckOrders(minutes);
  });

  app.post('/recover-stuck', async (request) => {
    const minutes = Number((request.body as any)?.minutes ?? 5);
    return recoverStuckOrders(minutes);
  });
}
