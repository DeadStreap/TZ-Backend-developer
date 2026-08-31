import { getPrisma } from '../../config/prisma.js';

const prisma = getPrisma();
import { childLogger } from '../../lib/logger.js';
import { ORDER_STATUSES } from '../orders/orders.types.js';
import { saveIssuedCode, getIssuedCode, recordDeliveryAttempt } from '../payments/payments.service.js';
import type { Supplier } from './suppliers.js';

const log = childLogger({ module: 'delivery' });

interface DeliveryResult {
  status: 'delivered' | 'out_of_stock' | 'delivery_failed';
  code?: string;
  supplier?: string;
  attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class TimeoutError extends Error {}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new TimeoutError('timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function deliverOrder(
  orderId: string,
  suppliers: Supplier[],
  timeoutMs = 5000,
  maxRetriesPerSupplier = 1,
): Promise<DeliveryResult> {
  const order = await prisma.order.findFirst({ where: { orderId } });
  if (!order) throw new Error(`Order ${orderId} not found`);

  if (order.status !== ORDER_STATUSES.PAID) {
    if (order.status === ORDER_STATUSES.DELIVERED) {
      const existingKey = await prisma.key.findFirst({ where: { orderId, status: 'issued' } });
      return { status: 'delivered', code: existingKey?.code, supplier: 'cached', attempts: 0 };
    }
    log.warn({ orderId, status: order.status }, 'Cannot deliver: order not in paid status');
    return { status: 'delivery_failed', attempts: 0 };
  }


  const updated = await prisma.order.updateMany({
    where: { orderId, status: ORDER_STATUSES.PAID },
    data: { status: ORDER_STATUSES.DELIVERING },
  });
  if (updated.count === 0) {
    log.warn({ orderId }, 'Race: another request already transitioned order');
    return { status: 'delivery_failed', attempts: 0 };
  }


  const availableKey = await prisma.key.findFirst({
    where: { sku: order.sku, status: 'available' },
  });
  if (!availableKey) {
    await prisma.order.update({ where: { orderId }, data: { status: ORDER_STATUSES.OUT_OF_STOCK } });
    log.warn({ orderId, sku: order.sku }, 'Out of stock');
    return { status: 'out_of_stock', attempts: 0 };
  }

  let totalAttempts = 0;

  for (const supplier of suppliers) {
    for (let attempt = 0; attempt <= maxRetriesPerSupplier; attempt++) {
      totalAttempts++;
      const requestId = `${orderId}-${attempt}`;

      try {
        const result = await withTimeout(
          supplier.issueCode({ request_id: requestId, sku: order.sku, order_id: orderId }),
          timeoutMs,
        );

        if (result.status === 'ok') {
          await saveIssuedCode(requestId, result.code, orderId, order.sku, supplier.name);

          const claimed = await claimKey(orderId, order.sku);
          if (claimed) {
            log.info({ orderId, code: result.code, supplier: supplier.name }, 'Delivered');
            return { status: 'delivered', code: result.code, supplier: supplier.name, attempts: totalAttempts };
          }
        }

        if (result.status === 'error' && result.reason === 'out_of_stock') break;
      } catch (error) {
        if (error instanceof TimeoutError) {
          await recordDeliveryAttempt(requestId, orderId, order.sku, supplier.name, 'timeout');
          const existingCode = await getIssuedCode(requestId);
          if (existingCode) {
            log.info({ orderId, requestId }, 'Timeout recovered from DB');
            await claimKey(orderId, order.sku);
            return { status: 'delivered', code: existingCode, supplier: supplier.name, attempts: totalAttempts };
          }
          break;
        }
      }

      await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500);
    }
  }

  await prisma.order.update({ where: { orderId }, data: { status: ORDER_STATUSES.DELIVERY_FAILED } });
  return { status: 'delivery_failed', attempts: totalAttempts };
}

async function claimKey(orderId: string, sku: string): Promise<boolean> {
  const key = await prisma.key.findFirst({
    where: { sku, status: 'available' },
  });
  if (!key) {
    await prisma.order.update({ where: { orderId }, data: { status: ORDER_STATUSES.OUT_OF_STOCK } });
    return false;
  }

  const result = await prisma.key.updateMany({
    where: { id: key.id, status: 'available' },
    data: { status: 'issued', orderId, issuedAt: new Date() },
  });

  if (result.count === 0) {
    await prisma.order.update({ where: { orderId }, data: { status: ORDER_STATUSES.OUT_OF_STOCK } });
    return false;
  }

  await prisma.order.update({
    where: { orderId },
    data: { status: ORDER_STATUSES.DELIVERED, keyId: key.id },
  });
  return true;
}

export async function retryDelivery(orderId: string, suppliers: Supplier[]): Promise<DeliveryResult> {
  return deliverOrder(orderId, suppliers);
}
