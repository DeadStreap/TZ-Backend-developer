import { getPrisma } from '../../config/prisma.js';

const prisma = getPrisma();
import { childLogger } from '../../lib/logger.js';
import {
  ORDER_STATUSES,
  type OrderStatus,
  type CreateOrderInput,
  type OrderResponse,
  VALID_TRANSITIONS,
} from './orders.types.js';

const log = childLogger({ module: 'orders' });

function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ord_${timestamp}${random}`;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderResponse> {
  const product = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (!product) {
    throw new Error(`Product with SKU ${input.sku} not found`);
  }

  const orderId = generateOrderId();
  const order = await prisma.order.create({
    data: {
      orderId,
      sku: input.sku,
      status: ORDER_STATUSES.CREATED,
      amount: product.price,
      currency: product.currency,
    },
  });

  log.info({ orderId, sku: input.sku }, 'Order created');

  return formatOrder(order);
}

export async function getOrder(orderId: string): Promise<OrderResponse | null> {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { key: true },
  });
  if (!order) return null;
  return formatOrder(order);
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) return false;

  const allowed = VALID_TRANSITIONS[order.status as OrderStatus];
  if (!allowed.includes(newStatus)) {
    log.warn({ orderId, from: order.status, to: newStatus }, 'Invalid status transition');
    return false;
  }

  await prisma.order.update({
    where: { orderId },
    data: { status: newStatus },
  });

  log.info({ orderId, from: order.status, to: newStatus }, 'Status updated');
  return true;
}

function formatOrder(order: any): OrderResponse {
  return {
    orderId: order.orderId,
    sku: order.sku,
    status: order.status,
    amount: Number(order.amount),
    currency: order.currency,
    key: order.key?.code,
    createdAt: order.createdAt?.toISOString?.() ?? order.createdAt,
  };
}
