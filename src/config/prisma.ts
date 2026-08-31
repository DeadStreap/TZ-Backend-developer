import { PrismaClient } from '@prisma/client';

let _instance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_instance) {
    _instance = new PrismaClient({
      log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error', 'warn'],
    });
  }
  return _instance;
}
