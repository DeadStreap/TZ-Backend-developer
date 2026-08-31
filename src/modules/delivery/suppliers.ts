import { childLogger } from '../../lib/logger.js';

const log = childLogger({ module: 'supplier' });

export interface SupplierRequest {
  request_id: string;
  sku: string;
  order_id: string;
}

export type SupplierResponse =
  | { status: 'ok'; request_id: string; code: string }
  | { status: 'error'; request_id: string; reason: 'out_of_stock' | 'internal_error' | 'timeout' };

export interface Supplier {
  name: string;
  issueCode(req: SupplierRequest): Promise<SupplierResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

export function createSupplier(name: string, opts: {
  errorRate?: number;
  timeoutRate?: number;
  timeoutMs?: number;
  minDelayMs?: number;
} = {}): Supplier {
  const errorRate = opts.errorRate ?? 0.1;
  const timeoutRate = opts.timeoutRate ?? 0.05;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const minDelayMs = opts.minDelayMs ?? 50;


  const issuedCodes = new Map<string, string>();

  return {
    name,
    async issueCode(req: SupplierRequest): Promise<SupplierResponse> {
      log.info({ requestId: req.request_id, sku: req.sku }, 'Processing');

      await sleep(minDelayMs + Math.random() * 500);


      const existingCode = issuedCodes.get(req.request_id);
      if (existingCode) {
        log.info({ requestId: req.request_id, code: existingCode }, 'Returning cached code (idempotent)');
        return { status: 'ok', request_id: req.request_id, code: existingCode };
      }

      if (Math.random() < timeoutRate) {
        log.warn({ requestId: req.request_id }, 'Timeout');
        await sleep(timeoutMs);
        return { status: 'error', request_id: req.request_id, reason: 'timeout' };
      }

      if (Math.random() < errorRate) {
        log.error({ requestId: req.request_id }, 'Error');
        return { status: 'error', request_id: req.request_id, reason: 'internal_error' };
      }

      const code = generateCode();
      issuedCodes.set(req.request_id, code);
      log.info({ requestId: req.request_id, code }, 'Issued');
      return { status: 'ok', request_id: req.request_id, code };
    },
  };
}
