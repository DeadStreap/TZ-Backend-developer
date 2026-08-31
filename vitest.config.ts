import { defineConfig } from 'vitest/config';
import path from 'path';

const testDbPath = path.resolve(__dirname, 'prisma/test.db');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    env: {
      DATABASE_URL: `file:${testDbPath}?timeout=30000&journal_mode=WAL`,
      PORT: '3001',
      LOG_LEVEL: 'warn',
    },
  },
});
