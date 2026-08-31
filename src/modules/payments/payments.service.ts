import { getPrisma } from '../../config/prisma.js';
import { childLogger } from '../../lib/logger.js';
import { ORDER_STATUSES } from '../orders/orders.types.js';
import type { PaymentWebhookEvent, WebhookResult } from './payments.types.js';

const prisma = getPrisma();

const log = childLogger({ module: 'payments' });

export async function handlePaymentWebhook(event: PaymentWebhookEvent): Promise<WebhookResult> {
  log.info({ eventId: event.event_id, orderId: event.order_id }, 'Webhook received');

  const existing = await prisma.payment.findUnique({ where: { eventId: event.event_id } });
  if (existing) {
    log.info({ eventId: event.event_id }, 'Duplicate (already in DB)');
    return { status: 'duplicate', eventId: event.event_id };
  }

  const order = await prisma.order.findUnique({ where: { orderId: event.order_id } });
  if (!order) {
    log.warn({ orderId: event.order_id }, 'Order not found');
    return { status: 'order_not_found', orderId: event.order_id };
  }

  if (order.status === ORDER_STATUSES.DELIVERED || order.status === ORDER_STATUSES.PAYMENT_FAILED) {
    log.info({ orderId: event.order_id, status: order.status }, 'Already final');
    return { status: 'ok', orderId: event.order_id };
  }

  const newStatus = event.status === 'paid' ? ORDER_STATUSES.PAID : ORDER_STATUSES.PAYMENT_FAILED;

  try {
    await prisma.$transaction([
      prisma.payment.create({
        data: { eventId: event.event_id, orderId: event.order_id, status: event.status, amount: event.amount },
      }),
      prisma.order.update({ where: { orderId: event.order_id }, data: { status: newStatus } }),
    ]);
    log.info({ orderId: event.order_id, newStatus }, 'Payment recorded, order status updated');
  } catch (error: any) {
    if (error.code === 'P2002' || error.message?.includes('UNIQUE constraint failed')) {
      log.info({ eventId: event.event_id }, 'Duplicate (race condition caught by constraint)');
      return { status: 'duplicate', eventId: event.event_id };
    }
    throw error;
  }

  return { status: 'ok', orderId: event.order_id };
}

export async function saveIssuedCode(requestId: string, code: string, orderId: string, sku: string, supplier: string): Promise<void> {
  await prisma.deliveryAttempt.upsert({
    where: { requestId },
    update: { code, status: 'ok' },
    create: { requestId, orderId, sku, code, supplier, status: 'ok' },
  });
}

export async function getIssuedCode(requestId: string): Promise<string | null> {
  const entry = await prisma.deliveryAttempt.findUnique({ where: { requestId } });
  if (!entry || entry.status !== 'ok' || !entry.code) return null;
  return entry.code;
}

export async function recordDeliveryAttempt(requestId: string, orderId: string, sku: string, supplier: string, status: string): Promise<void> {
  await prisma.deliveryAttempt.upsert({
    where: { requestId },
    update: { status },
    create: { requestId, orderId, sku, supplier, status },
  });
}
