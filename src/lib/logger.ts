import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.LOG_LEVEL === 'debug'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export function childLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
