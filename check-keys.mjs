import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const keys = await p.key.groupBy({ by: ['sku', 'status'], _count: { id: true } });
console.log(JSON.stringify(keys, null, 2));
await p.$disconnect();
