import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { setup, teardown, getTestPrisma, createTestOrder, cleanupDb } from '../helpers/test-utils.js';
import { createSupplier } from '../../src/modules/delivery/suppliers.js';
import { deliverOrder } from '../../src/modules/delivery/delivery.service.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  await setup();
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await cleanupDb();
});

describe('Delivery & Fallback Tests', () => {
  it('Supplier A fails → fallback to Supplier B → exactly 1 delivery', async () => {
    const { orderId } = await createTestOrder('STEAM-TOPUP-500');
    await getTestPrisma().order.update({ where: { orderId }, data: { status: 'paid' } });

    const alwaysFailingA = createSupplier('a', { errorRate: 1, timeoutRate: 0 });
    const alwaysSuccessB = createSupplier('b', { errorRate: 0, timeoutRate: 0 });

    const result = await deliverOrder(orderId, [alwaysFailingA, alwaysSuccessB], 5000);

    expect(result.status).toBe('delivered');
    expect(result.supplier).toBe('b');
    expect(result.code).toBeDefined();

    const key = await getTestPrisma().key.findFirst({ where: { orderId, status: 'issued' } });
    expect(key).toBeDefined();
    expect(result.code).toBeDefined();
  });

  it('both suppliers fail → delivery_failed', async () => {
    const { orderId } = await createTestOrder('STEAM-TOPUP-500');
    await getTestPrisma().order.update({ where: { orderId }, data: { status: 'paid' } });

    const failingA = createSupplier('a', { errorRate: 1, timeoutRate: 0 });
    const failingB = createSupplier('b', { errorRate: 1, timeoutRate: 0 });

    const result = await deliverOrder(orderId, [failingA, failingB], 5000);

    expect(result.status).toBe('delivery_failed');

    const order = await getTestPrisma().order.findFirst({ where: { orderId } });
    expect(order?.status).toBe('delivery_failed');
  });
});
