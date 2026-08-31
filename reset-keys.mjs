import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
await p.key.updateMany({ data: { status: 'available', orderId: null, issuedAt: null } });
console.log('Keys reset to available');
await p.$disconnect();
