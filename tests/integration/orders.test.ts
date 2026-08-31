import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { setup, teardown, createTestOrder, cleanupDb } from '../helpers/test-utils.js';
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

describe('Orders API', () => {
  it('POST /orders creates an order', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { sku: 'STEAM-TOPUP-500' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.orderId).toBeDefined();
    expect(body.sku).toBe('STEAM-TOPUP-500');
    expect(body.status).toBe('created');
    expect(body.amount).toBe(500);
  });

  it('POST /orders returns 404 for unknown SKU', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { sku: 'UNKNOWN-SKU' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /orders/:orderId returns order', async () => {
    const { orderId } = await createTestOrder();

    const response = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.orderId).toBe(orderId);
    expect(body.status).toBe('created');
  });

  it('GET /orders/:orderId returns 404 for unknown order', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /webhook/payment processes payment', async () => {
    const { orderId } = await createTestOrder();

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        event_id: 'evt_test_1',
        order_id: orderId,
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);

    // Проверяем статус заказа
    const orderResponse = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
    });
    const order = JSON.parse(orderResponse.body);
    expect(order.status).toBe('paid');
  });

  it('POST /webhook/payment is idempotent', async () => {
    const { orderId } = await createTestOrder();

    // Первый webhook
    await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        event_id: 'evt_idempotent_1',
        order_id: orderId,
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString(),
      },
    });

    // Повторный webhook с тем же event_id
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        event_id: 'evt_idempotent_1',
        order_id: orderId,
        status: 'paid',
        amount: 500,
        currency: 'RUB',
        created_at: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);

    // Статус не должен измениться
    const orderResponse = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
    });
    const order = JSON.parse(orderResponse.body);
    expect(order.status).toBe('paid');
  });

  it('GET /catalog returns products', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/catalog',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.products).toBeDefined();
    expect(body.products.length).toBeGreaterThan(0);
  });

  it('GET /catalog/:sku/stock returns stock count', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/catalog/STEAM-TOPUP-500/stock',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sku).toBe('STEAM-TOPUP-500');
    expect(body.stock).toBeGreaterThanOrEqual(0);
  });

  it('GET /reconciliation returns discrepancy report', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/reconciliation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.paidNotDelivered).toBeDefined();
    expect(body.deliveredNotPaid).toBeDefined();
    expect(body.totalDiscrepancies).toBeDefined();
  });
});
