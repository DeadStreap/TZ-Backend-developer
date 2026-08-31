import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export const env = envSchema.parse(process.env);
