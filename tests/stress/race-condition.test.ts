import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { setup, teardown, getTestPrisma, createTestOrder, cleanupDb } from '../helpers/test-utils.js';
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

describe('Race Condition Tests', () => {
  it('50 parallel webhooks → exactly 1 payment in DB, no duplicates', async () => {
    const { orderId } = await createTestOrder('STEAM-TOPUP-500');
    const eventId = `evt_race_${Date.now()}`;

    console.log(`Testing 50 parallel webhooks for order ${orderId}`);

    const promises = Array.from({ length: 50 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/webhook/payment',
        payload: {
          event_id: eventId,
          order_id: orderId,
          status: 'paid',
          amount: 500,
          currency: 'RUB',
          created_at: new Date().toISOString(),
        },
      })
    );

    await Promise.all(promises);

    const prisma = getTestPrisma();
    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1);
    expect(payments[0].eventId).toBe(eventId);

    const order = await prisma.order.findFirst({ where: { orderId } });
    expect(order?.status).toBe('paid');

    console.log(`✓ 50 parallel webhooks → 1 payment in DB`);
  });

  it('10 parallel webhooks with different event_ids → exactly 10 payments', async () => {
    const { orderId } = await createTestOrder('STEAM-TOPUP-500');
    const eventIds = Array.from({ length: 10 }, (_, i) => `evt_unique_${Date.now()}_${i}`);

    const promises = eventIds.map((eventId) =>
      app.inject({
        method: 'POST',
        url: '/webhook/payment',
        payload: {
          event_id: eventId,
          order_id: orderId,
          status: 'paid',
          amount: 500,
          currency: 'RUB',
          created_at: new Date().toISOString(),
        },
      })
    );

    await Promise.all(promises);

    const prisma = getTestPrisma();
    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(10);

    console.log(`✓ 10 parallel webhooks with unique event_ids → 10 payments`);
  });

  it('repeated webhook with same event_id → idempotent', async () => {
    const { orderId } = await createTestOrder('STEAM-TOPUP-500');
    const eventId = 'evt_repeated_1';

    const first = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        event_id: eventId,
        order_id: orderId,
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString(),
      },
    });
    expect(first.statusCode).toBe(200);

    const repeats = Array.from({ length: 10 }, () =>
      app.inject({
        method: 'POST',
        url: '/webhook/payment',
        payload: {
          event_id: eventId,
          order_id: orderId,
          status: 'paid',
          amount: 500,
          currency: 'RUB',
          created_at: new Date().toISOString(),
        },
      })
    );

    await Promise.all(repeats);

    const prisma = getTestPrisma();
    const payments = await prisma.payment.findMany({ where: { eventId } });
    expect(payments.length).toBe(1);

    console.log(`✓ Repeated webhook with same event_id → idempotent`);
  });

  it('webhook before order exists → handled gracefully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        event_id: 'evt_before_order',
        order_id: 'ord_nonexistent',
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(404);

    const prisma = getTestPrisma();
    const payments = await prisma.payment.findMany({ where: { eventId: 'evt_before_order' } });
    expect(payments.length).toBe(0);

    console.log(`✓ Webhook before order exists → handled gracefully`);
  });

  it('concurrent webhooks for different orders → no cross-contamination', async () => {
    const order1 = await createTestOrder('STEAM-TOPUP-500');
    const order2 = await createTestOrder('STEAM-TOPUP-1000');
    const event1 = `evt_ord1_${Date.now()}`;
    const event2 = `evt_ord2_${Date.now()}`;

    const promises = [
      ...Array.from({ length: 25 }, () =>
        app.inject({
          method: 'POST',
          url: '/webhook/payment',
          payload: {
            event_id: event1,
            order_id: order1.orderId,
            status: 'paid',
            amount: 500,
            currency: 'RUB',
            created_at: new Date().toISOString(),
          },
        })
      ),
      ...Array.from({ length: 25 }, () =>
        app.inject({
          method: 'POST',
          url: '/webhook/payment',
          payload: {
            event_id: event2,
            order_id: order2.orderId,
            status: 'paid',
            amount: 1000,
            currency: 'RUB',
            created_at: new Date().toISOString(),
          },
        })
      ),
    ];

    await Promise.all(promises);

    const prisma = getTestPrisma();
    const payments1 = await prisma.payment.findMany({ where: { orderId: order1.orderId } });
    const payments2 = await prisma.payment.findMany({ where: { orderId: order2.orderId } });

    expect(payments1.length).toBe(1);
    expect(payments2.length).toBe(1);

    console.log(`✓ Concurrent webhooks for different orders → no cross-contamination`);
  });
});
