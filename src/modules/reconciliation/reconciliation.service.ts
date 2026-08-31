import { getPrisma } from '../../config/prisma.js';

const prisma = getPrisma();
import { childLogger } from '../../lib/logger.js';
import { ORDER_STATUSES } from '../orders/orders.types.js';

const log = childLogger({ module: 'reconciliation' });

export async function fullReconciliation() {
  const [paidNotDelivered, deliveredNotPaid] = await Promise.all([
    prisma.$queryRaw`
      SELECT o."orderId" as orderId, o.sku, o.status, o.amount
      FROM "Order" o
      LEFT JOIN "Key" k ON k."orderId" = o."orderId" AND k.status = 'issued'
      WHERE o.status IN ('paid', 'delivering', 'delivery_failed') AND k.id IS NULL
    `.then((r) => (r as any[]).map((x) => ({ ...x, type: 'paid_not_delivered' as const, amount: Number(x.amount) }))),

    prisma.$queryRaw`
      SELECT o."orderId" as orderId, o.sku, o.status, o.amount
      FROM "Order" o
      LEFT JOIN "Payment" p ON p."orderId" = o."orderId" AND p.status = 'paid'
      WHERE o.status = 'delivered' AND p.id IS NULL
    `.then((r) => (r as any[]).map((x) => ({ ...x, type: 'delivered_not_paid' as const, amount: Number(x.amount) }))),
  ]);

  return {
    paidNotDelivered,
    deliveredNotPaid,
    totalDiscrepancies: paidNotDelivered.length + deliveredNotPaid.length,
    timestamp: new Date().toISOString(),
  };
}

export async function getAuditTrail(limit = 100) {
  const payments = await prisma.payment.findMany({
    orderBy: { processedAt: 'desc' },
    take: limit,
  });

  let balance = 0;
  const trail = payments.map((p) => {
    const amount = Number(p.amount);
    balance += p.status === 'paid' ? amount : -amount;
    return {
      eventId: p.eventId,
      orderId: p.orderId,
      status: p.status,
      amount,
      balance,
      processedAt: p.processedAt,
    };
  });

  return { trail, finalBalance: balance };
}

export async function getStuckOrders(minutesStuck = 5) {
  const cutoff = new Date(Date.now() - minutesStuck * 60 * 1000);
  return prisma.order.findMany({
    where: {
      status: { in: ['delivering', 'delivery_failed', 'out_of_stock'] },
      updatedAt: { lt: cutoff },
    },
  });
}

export async function recoverStuckOrders(minutesStuck = 5, suppliers?: any[]) {
  const stuck = await getStuckOrders(minutesStuck);
  const results = [];

  for (const order of stuck) {
    try {
      if (order.status === 'delivering') {
        const key = await prisma.key.findFirst({ where: { orderId: order.orderId, status: 'issued' } });
        if (key) {
          await prisma.order.update({
            where: { orderId: order.orderId },
            data: { status: ORDER_STATUSES.DELIVERED, keyId: key.id },
          });
          results.push({ orderId: order.orderId, action: 'recovered_delivered', key: key.code });
        } else {
          await prisma.order.update({
            where: { orderId: order.orderId },
            data: { status: ORDER_STATUSES.DELIVERY_FAILED },
          });
          results.push({ orderId: order.orderId, action: 'marked_delivery_failed' });
        }
      } else if (order.status === 'delivery_failed' || order.status === 'out_of_stock') {
        results.push({ orderId: order.orderId, action: 'skipped', reason: order.status });
      }
    } catch (error: any) {
      log.error({ orderId: order.orderId, error: error.message }, 'Recovery failed');
      results.push({ orderId: order.orderId, action: 'error', error: error.message });
    }
  }

  log.info({ recovered: results.length, stuck: stuck.length }, 'Stuck orders recovery completed');
  return { stuck: stuck.length, recovered: results.length, results };
}
