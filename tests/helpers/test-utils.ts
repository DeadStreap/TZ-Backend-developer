import { getPrisma } from '../../src/config/prisma.js';
import { execSync } from 'child_process';

function prisma() { return getPrisma(); }

const products = [
  { sku: 'STEAM-TOPUP-500', name: 'Пополнение Steam 500 ₽', type: 'topup', price: 500, currency: 'RUB' },
  { sku: 'STEAM-TOPUP-1000', name: 'Пополнение Steam 1000 ₽', type: 'topup', price: 1000, currency: 'RUB' },
  { sku: 'STEAM-TOPUP-2500', name: 'Пополнение Steam 2500 ₽', type: 'topup', price: 2500, currency: 'RUB' },
  { sku: 'KEY-CS2-PRIME', name: 'CS2 Prime Status ключ', type: 'key', price: 1290, currency: 'RUB' },
  { sku: 'KEY-GTA5', name: 'GTA V ключ активации', type: 'key', price: 1990, currency: 'RUB' },
  { sku: 'KEY-EFT', name: 'Escape from Tarkov ключ', type: 'key', price: 3490, currency: 'RUB' },
  { sku: 'SUB-DISCORD-1M', name: 'Discord Nitro 1 месяц', type: 'subscription', price: 399, currency: 'RUB' },
  { sku: 'SUB-YT-3M', name: 'YouTube Premium 3 месяца', type: 'subscription', price: 1490, currency: 'RUB' },
  { sku: 'SUB-SPOTIFY-1M', name: 'Spotify Premium 1 месяц', type: 'subscription', price: 299, currency: 'RUB' },
  { sku: 'GIFT-PSN-1000', name: 'PlayStation Store карта 1000 ₽', type: 'giftcard', price: 1000, currency: 'RUB' },
  { sku: 'GIFT-XBOX-1500', name: 'Xbox Gift Card 1500 ₽', type: 'giftcard', price: 1500, currency: 'RUB' },
  { sku: 'GIFT-ROBLOX-800', name: 'Roblox 800 Robux', type: 'giftcard', price: 890, currency: 'RUB' },
];

export async function seedTestData() {
  const p = prisma();
  for (const product of products) {
    await p.product.upsert({ where: { sku: product.sku }, update: product, create: product });
  }
  for (const product of products) {
    for (let i = 0; i < 4; i++) {
      const code = `TST-${product.sku.slice(0, 6)}-${i}`;
      await p.key.upsert({ where: { code }, update: {}, create: { sku: product.sku, code, status: 'available' } });
    }
  }
}

export async function cleanupDb() {
  const p = prisma();
  await p.payment.deleteMany();
  await p.key.updateMany({ data: { status: 'available', orderId: null, issuedAt: null } });
  await p.order.deleteMany();
}

export async function setup() {
  execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
    env: { ...process.env },
    stdio: 'pipe',
  });
  await seedTestData();
  await cleanupDb();
}

export async function teardown() {
  await getPrisma().$disconnect();
}

export async function createTestOrder(sku: string = 'STEAM-TOPUP-500') {
  const p = prisma();
  const orderId = `test_ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const product = await p.product.findUnique({ where: { sku } });
  const order = await p.order.create({
    data: { orderId, sku, status: 'created', amount: product?.price ?? 500, currency: 'RUB' },
  });
  return { orderId, order };
}

export function getTestPrisma() { return prisma(); }
